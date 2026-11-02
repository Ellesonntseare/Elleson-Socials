import {env} from 'cloudflare:workers';
import {handleAPI} from '../../../lib/backend.mjs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handleAPI(request,env);
export const POST=GET;
export const PUT=GET;
export const DELETE=GET;
