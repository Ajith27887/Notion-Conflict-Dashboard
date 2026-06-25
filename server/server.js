import express from "express";
import auth from "./api/auth.ts"

const app = express();
const PORT = 3001;

app.route("/auth", auth);

app.listen(PORT, () => {
	console.log(`Server is listing to ${PORT}`);
})