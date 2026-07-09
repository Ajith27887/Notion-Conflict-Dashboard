import express from "express";
import type { Request, Response } from "express";
import { Client } from "@notionhq/client";
import { BotUserObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import prisma from "../PrismaClient.js";


const router = express.Router();
// Base URL of this server (== the frontend's API target). Configurable so the
// OAuth redirect matches whatever host the server is deployed on.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const redirectUri = `${API_BASE_URL}/auth/callback`

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

        const botDetails = (await authenticatedNotion.users.me({})) as BotUserObjectResponse;

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
			
				const newUser = await prisma.user.upsert({
					where :{ notionId: userProfile.id },
					update : {
						name: userName,
						email: userEmail,
						workspaceId:  workspaceId,
						avatar : userAvatar,
						accessToken : AccessToken
					},
					create : {
						name: userName,
						email: userEmail,
						workspaceId:  workspaceId,
						notionId: userProfile.id,
						avatar : userAvatar,
						accessToken : AccessToken
					}
				})
                console.log("Successfully extracted:", { workSpaceName,workspaceId, userName, userEmail });
                return res.redirect("http://localhost:3000/Dashboard");
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