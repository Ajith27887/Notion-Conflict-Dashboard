"use client"
import "./login.scss"

const Login = () => {
	const loginNotion =  async () => {
		window.location.href = "http://localhost:3001/auth/";
	}
	return (
		<div className="login-wrap-box">
			<h2>Sign in to your workspace</h2>
			<p className="mt-2">Connect Concord to Notion to start detecting edit conflicts across your team's pages.</p>
			<button onClick={loginNotion} className=" mt-3 bg-black p-5 border-l-4 w-full rounded-2xl font-bold cursor-pointer text-white" >Continue with Notion</button>
			<p className="mt-3">By continuing you authorize Concord to read your workspace pages and members.</p>
		</div>
	)
}

export default Login;