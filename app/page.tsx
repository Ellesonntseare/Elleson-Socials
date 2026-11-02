import { redirect } from 'next/navigation';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home(){
 if(!await getChatGPTUser())redirect('/login');
 redirect('/planner/index.html');
}
