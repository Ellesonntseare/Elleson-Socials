import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Login(){
 const user=await getChatGPTUser();
 return <main className="login-screen"><section className="login-card">
  <a className="login-brand" href="/">elleson<span>socials</span></a>
  <p className="login-eyebrow">ELLESON SOCIALS</p>
  <h1>{user?'Welcome back.':'Sign in.'}</h1>
  <p></p>
  {user?<p className="login-account">Signed in as <strong>{user.email}</strong></p>:null}
  <a className="login-button" href={user?'/planner/index.html':chatGPTSignInPath('/planner/index.html')} target="_top">{user?'Open my posts':'Continue with ChatGPT'} <span>↗</span></a>
 </section><aside className="login-art" aria-hidden="true"><span>YOUR<br/>SOCIALS.<br/>ONE PLACE.</span><i>✳</i></aside></main>;
}
