import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Login(){
 const user=await getChatGPTUser();
 return <main className="login-screen"><section className="login-card">
  <a className="login-brand" href="/">elleson<span>socials</span></a>
  <p className="login-eyebrow">YOUR CONTENT HAS A HOME</p>
  <h1>{user?'Welcome back.':'Sign in to your workspace.'}</h1>
  <p>Keep your drafts, images and posting plans together. Use the same account each time to return to your saved work.</p>
  {user?<p className="login-account">Signed in as <strong>{user.email}</strong></p>:null}
  <a className="login-button" href={user?'/planner/index.html':chatGPTSignInPath('/planner/index.html')} target="_top">{user?'Open my workspace':'Continue with ChatGPT'} <span>↗</span></a>
  <div className="login-detail"><strong>One account. Private cloud storage.</strong><p>Sign-in is managed by ChatGPT. This app has no separate temporary password. Manage your sign-in and account recovery through your ChatGPT account.</p></div>
  <p className="login-foot">Your administrator workspace includes saved post versions and a downloadable backup. Export a copy from More → Admin & recovery.</p>
 </section><aside className="login-art" aria-hidden="true"><span>CREATE.<br/>PLAN.<br/>COME BACK<br/>TO IT.</span><i>✳</i></aside></main>;
}
