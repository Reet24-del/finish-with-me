import 'node:process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Store } from './store.js';
import { api } from './api.js';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
const dataDirectory=process.env.DATA_DIR||join(root,'.data');
const hosted=process.env.HOSTED_DEMO==='true';
const store=hosted?null:await new Store(dataDirectory).init();
const sessions=new Map();
async function workspace(req,res){
  if(!hosted)return store;
  const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('finish_demo='))?.slice(12);
  if(cookie&&sessions.has(cookie))return sessions.get(cookie);
  if(sessions.size>=200)throw Error('Demo capacity reached. Please try again after the next service restart.');
  const id=randomBytes(24).toString('hex');
  const ready=new Store(join(dataDirectory,id)).init();sessions.set(id,ready);
  res.setHeader('Set-Cookie',`finish_demo=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${(process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL)?.startsWith('https:')?'; Secure':''}`);
  try{return await ready;}catch(error){sessions.delete(id);throw error;}
}
const isBuilt=existsSync(join(root,'dist/index.html'));
let vite;
if(!isBuilt){const {createServer:createVite}=await import('vite');vite=await createVite({root,server:{middlewareMode:true},appType:'spa'});}
const staticFiles=(req,res)=>{
  if(vite)return vite.middlewares(req,res,()=>{res.statusCode=404;res.end('Not found');});
  const path=new URL(req.url,'http://localhost').pathname;
  const safe=path.startsWith('/assets/') && /^\/assets\/[\w.-]+$/.test(path);
  const file=safe?join(root,'dist',path):join(root,'dist/index.html');
  try{const content=readFileSync(file);const extension=file.split('.').pop();const type=({js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',ttf:'font/ttf',woff2:'font/woff2',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg'})[extension]||'text/html; charset=utf-8';res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':safe?'public, max-age=31536000, immutable':'no-cache'});res.end(content);}catch{res.statusCode=404;res.end('Not found');}
};
const server=createServer(async(req,res)=>{
  try{
    if(!req.url.startsWith('/api/'))return staticFiles(req,res);
    if(req.url==='/api/health')return api(store)(req,res,()=>{});
    return await api(await workspace(req,res))(req,res,()=>staticFiles(req,res));
  }catch(error){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
const port=Number(process.env.PORT||4318);
server.listen(port,'0.0.0.0',()=>console.log(`Finish with me: http://127.0.0.1:${port} (${isBuilt?'built':'development'})`));
process.on('SIGTERM',()=>server.close());
