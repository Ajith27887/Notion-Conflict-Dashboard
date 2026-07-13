import express from "express";
import type { Request, Response } from "express";
import { Client } from "@notionhq/client";
import { BotUserObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import prisma from "../PrismaClient.js";
import { signHandoffToken } from "../lib/authToken.js";


const router = express.Router();
// Base URL of this server (== the frontend's API target). Configurable so the
// OAuth redirect matches whatever host the server is deployed on.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const redirectUri = `${API_BASE_URL}/auth/callback`
// Base URL of the Next frontend. After OAuth we redirect the browser here with a
// short-lived handoff token, and the Next /auth/complete route sets the first-party
// session cookie. Defaults to the deployed Vercel URL so a forgotten env var on the
// server host fails toward prod (not localhost); local dev overrides APP_BASE_URL to
// http://localhost:3000 in .env.
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "https://notion-conflict-dashboard.vercel.app").replace(/\/$/, "")

router.get("/", (req: Request, res: Response) => {
	const clientId = process.env.CLIENT_ID;
	const authorization = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`
	res.redirect(authorization)
})

router.get("/callback",async (req: Request, res: Response) => {
	const code = req.query.code as string;

	if (!code) {
		 res.status(400).send("Authorization code missing")
		 return;
	}

	try {
		const notion = new Client();
		const response = await notion.oauth.token({
			client_id : process.env.CLIENT_ID || "",
			client_secret: process.env.CLIENT_SECERT || "",
			code : code || "",
			redirect_uri : redirectUri || "",
			grant_type : "authorization_code"
		})

		const AccessToken = response.access_token;
		const workspaceId = response.workspace_id;

		const authenticatedNotion = new Client({ auth : AccessToken });

        // users.me() returns the full UserObjectResponse — id lives on the common
        // base. Keep that typed reference for the bot user id, and narrow to the bot
        // variant for the workspace/owner fields (BotUserObjectResponse omits id).
        const selfUser = await authenticatedNotion.users.me({});
        const botDetails = selfUser as BotUserObjectResponse;

		const workSpaceName = botDetails.bot.workspace_name;

        if (botDetails.bot.owner && botDetails.bot.owner.type === "user") {
        	const userProfile = botDetails.bot.owner.user;
            
            // Fix: Check if it is a full user profile by verifying 'name' exists in the object
            if ("name" in userProfile) {
                const userName = userProfile.name;
                const userAvatar = userProfile.avatar_url;
                
                let userEmail: string | null = null;
                if ("person" in userProfile && userProfile.person) {
                    userEmail = userProfile.person.email ?? null;
                }

                if (!userEmail) {
                    return res.status(400).send("User email missing from Notion profile.");
                }
                if (!workspaceId) {
                    return res.status(400).send("Workspace ID missing from Notion response.");
                }
			
				// selfUser.id is the integration's bot user id for this workspace —
				// the same id Notion stamps on last_edited_by for the app's own
				// write-back edits. Persist it so detection can suppress those edits
				// as write-back landings rather than flagging them as new conflicts
				// (bug-001 anti-loop).
				const botId = selfUser.id;

				const newUser = await prisma.user.upsert({
					where :{ notionId: userProfile.id },
					update : {
						name: userName,
						email: userEmail,
						workspaceId:  workspaceId,
						avatar : userAvatar,
						accessToken : AccessToken,
						botId : botId
					},
					create : {
						name: userName,
						email: userEmail,
						workspaceId:  workspaceId,
						notionId: userProfile.id,
						avatar : userAvatar,
						accessToken : AccessToken,
						botId : botId
					}
				})
                console.log("Successfully extracted:", { workSpaceName,workspaceId, userName, userEmail });

                // Hand off to the Next frontend with a short-lived signed token
                // carrying this user's id + workspace. /auth/complete verifies it and
                // sets the first-party httpOnly session cookie, then lands the user on
                // /Dashboard. The token (not the access token) is what crosses the
                // redirect; it expires in ~60s.
                const handoff = signHandoffToken({ userId: newUser.id, workspaceId });
                return res.redirect(`${APP_BASE_URL}/auth/complete?token=${encodeURIComponent(handoff)}`);
            } else {
                return res.status(400).send("Incomplete user profile received from Notion.");
            }
        } else {
            return res.status(400).send("Unauthorized owner type.");
        }
        

	} catch (error) {
		console.error("OAuth callback error:", error)
		res.status(400).json({ message: "AccessToken fetch error", error: error instanceof Error ? error.message : String(error) })
	}


})

export default router;