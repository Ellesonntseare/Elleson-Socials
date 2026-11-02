import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('public/planner');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) {res.writeHead(403).end(); return;}
    const file = path === root ? resolve(root,'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
