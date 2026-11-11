// Reads private local settings; never logs environment values or API responses.
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {PostgresWorkspaces} from '../server/postgres.js';
process.loadEnvFile(join(dirname(dirname(fileURLToPath(import.meta.url))),'.env'));
const serviceId='srv-dbol6k3rjlhs73eld87g';
for(const name of ['RENDER_API_KEY','GROQ_API_KEY','DATABASE_URL'])if(!process.env[name]?.trim())throw Error(`Save ${name} in the private .env first.`);
const databaseUrl=new URL(process.env.DATABASE_URL);
if(!['postgres:','postgresql:'].includes(databaseUrl.protocol)||['localhost','127.0.0.1'].includes(databaseUrl.hostname))throw Error('Render needs a hosted PostgreSQL connection, not localhost.');
if(!['require','verify-ca','verify-full'].includes(databaseUrl.searchParams.get('sslmode')))throw Error('Keep sslmode=require or stricter in the cloud database connection string.');
const database=new PostgresWorkspaces(process.env.DATABASE_URL);
try{await database.ready;console.log('Hosted database connection verified.');}catch{throw Error('Hosted database connection failed. Check the private connection string.');}finally{await database.pool.end();}
async function render(path,method='GET',body){
 const r=await fetch(`https://api.render.com/v1/services/${serviceId}${path}`,{method,headers:{Authorization:`Bearer ${process.env.RENDER_API_KEY}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`Render request failed (HTTP ${r.status}).`);return r.json();
}
const service=await render('');
if(service.repo!=='https://github.com/Reet24-del/finish-with-me'||service.serviceDetails?.plan!=='free')throw Error('Unexpected Render repository or plan; configuration stopped.');
const existing=await render('/env-vars?limit=100');if(existing.length>=100)throw Error('Environment pagination requires review before updating.');
const settings=new Map(existing.map(row=>{const e=row.envVar||row;return [e.key,e.value];}));
for(const [key,value] of Object.entries({AI_BACKEND:'groq',GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL||'openai/gpt-oss-120b',DATABASE_URL:process.env.DATABASE_URL,HOSTED_DEMO:'true'}))settings.set(key,value);
await render('/env-vars','PUT',[...settings].map(([key,value])=>({key,value})));
console.log('Render settings saved on the existing free service. No credentials displayed.');
if(process.argv.includes('--deploy')){const deploy=await render('/deploys','POST',{clearCache:'do_not_clear'});console.log('Deploy requested: '+deploy.id);}else console.log('Settings take effect on the next deployment.');
