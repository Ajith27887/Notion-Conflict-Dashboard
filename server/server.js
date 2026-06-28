import express from "express";
import auth from "./api/auth.ts"
import cors from "cors";

const app = express();
const PORT = 3001;

const corsOptions = {
	origin: "http://localhost:3000",
	method: "GET, POST",
	allowedHeaders: ['content-Typw', "Authorization"]
}

app.use(cors(corsOptions))
app.use("/auth", auth);

const server = app.listen(PORT, () => {
	console.log(`Server is listing to ${PORT}`);
})

// Keep an explicit reference so the listening server isn't garbage-collected
// (which would close the socket and let the process exit).
process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));