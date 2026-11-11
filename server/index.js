import 'node:process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Workspaces } from './workspaces.js';
import { PostgresWorkspaces } from './postgres.js';
import { Store } from './store.js';
import { api } from './api.js';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
const dataDirectory=process.env.DATA_DIR||join(root,'.data');
const hosted=process.env.HOSTED_DEMO==='true';
const store=hosted?null:await new Store(dataDirectory).init();
const database=process.env.DATABASE_URL?new PostgresWorkspaces(process.env.DATABASE_URL):null;
if(database)await database.ready;
const workspaces=new Workspaces(dataDirectory,{backend:database,secure:(process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL)?.startsWith('https:')});
async function workspace(req,res){return hosted?(await workspaces.get(req,res)).store:store;}
async function recovery(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(!hosted){res.writeHead(400);return res.end(JSON.stringify({error:'Recovery is available for hosted workspaces.'}));}
  if(req.method==='GET'){
    const {key}=await workspaces.get(req,res);
    return res.end(JSON.stringify({recoveryKey:key}));
  }
  if(req.method!=='POST'){res.writeHead(405);return res.end(JSON.stringify({error:'Method not allowed.'}));}
  const origin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://${req.headers.host}`;
  if(req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json')){
    res.writeHead(403);return res.end(JSON.stringify({error:'Use the recovery form on this website.'}));
  }
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024){res.writeHead(413);return res.end(JSON.stringify({error:'Request too large.'}));}}
  try{await workspaces.restore(JSON.parse(body).recoveryKey,res);return res.end(JSON.stringify({ok:true}));}
  catch{res.writeHead(400);return res.end(JSON.stringify({error:'That recovery key does not match a saved workspace.'}));}
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
    if(req.url==='/api/workspace/recovery')return await recovery(req,res);
    if(req.url==='/api/health')return api(store,{database})(req,res,()=>{});
    return await api(await workspace(req,res))(req,res,()=>staticFiles(req,res));
  }catch(error){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
const port=Number(process.env.PORT||4318);
server.listen(port,'0.0.0.0',()=>console.log(`Finish with me: http://127.0.0.1:${port} (${isBuilt?'built':'development'})`));
process.on('SIGTERM',()=>server.close(async()=>{await database?.pool.end();await vite?.close();}));
