import 'node:process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Store } from './store.js';
import { api } from './api.js';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
const store=await new Store(process.env.DATA_DIR||join(root,'.data')).init();
const isBuilt=existsSync(join(root,'dist/index.html'));
let vite;
if(!isBuilt){const {createServer:createVite}=await import('vite');vite=await createVite({root,server:{middlewareMode:true},appType:'spa'});}
const handle=api(store);
const server=createServer((req,res)=>handle(req,res,()=>{
  if(vite)return vite.middlewares(req,res,()=>{res.statusCode=404;res.end('Not found');});
  const path=new URL(req.url,'http://localhost').pathname;
  const safe=path.startsWith('/assets/') && /^\/assets\/[\w.-]+$/.test(path);
  const file=safe?join(root,'dist',path):join(root,'dist/index.html');
  try{const content=readFileSync(file);const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';res.writeHead(200,{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(content);}catch{res.statusCode=404;res.end('Not found');}
}));
const port=Number(process.env.PORT||4318);
server.listen(port,'0.0.0.0',()=>console.log(`Finish with me: http://127.0.0.1:${port} (${isBuilt?'built':'development'})`));
process.on('SIGTERM',()=>server.close());
