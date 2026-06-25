import express from "express";
import type { Request, Response } from "express";
import { Client } from "@notionhq/client";
import { BotUserObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { Prisma } from "@/app/generated/prisma/browser";
import { PrismaClient } from "@prisma/client/extension";
import prisma from "../PrismaClient";


const router = express.Router();
const redirectUri = "http://localhost:3000/auth/callback"

router.get("/", (req: Request, res: Response) => {
	const clientId = process.env.CLIENT_ID;
	const authorization = `https://notion.com${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}`
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
                
                let userEmail = null;
                if ("person" in userProfile && userProfile.person) {
                    userEmail = userProfile.person.email;
                }
				const newUser = await prisma.user.create({
					data : {
						name: userName,
						email: userProfile.person.email,
						workspaceId:  workspaceId,
						notionId:""
					}
				}) 
                console.log("Successfully extracted:", { workSpaceName,workspaceId, userName, userEmail });

                return res.json({ workSpaceName,workspaceId, userName, userEmail });
            } else {
                return res.status(400).send("Incomplete user profile received from Notion.");
            }
        } else {
            return res.status(400).send("Unauthorized owner type.");
        }
        

	} catch (error) {
		res.status(400).send("AccessToken fetch error")
	}


})

export default router;