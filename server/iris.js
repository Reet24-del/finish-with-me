import { hash, event } from './domain.js';

// This endpoint is implemented by iris/Finish/Api.cls. No credentials go to React.
export async function investigateWithIris(task) {
  const base=process.env.IRIS_BASE_URL;
  if(!base) throw Error('Set IRIS_BASE_URL on the server to enable live AI Hub.');
  const headers={'Content-Type':'application/json'};
  if(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD) headers.Authorization='Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
  const response=await fetch(new URL('investigate',base.endsWith('/')?base:base+'/'),{method:'POST',headers,body:JSON.stringify({taskId:task.id,title:task.title,kind:task.kind,profile:task.profile,blocker:task.blocker,tried:task.tried,source:task.source,attempts:task.attempts}),signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw Error(`IRIS returned HTTP ${response.status}. Check server configuration.`);
  const data=await response.json();
  if(data.provider!=='InterSystems IRIS AI Hub' || !data.decision || typeof data.decision.summary!=='string' || !Array.isArray(data.toolsUsed) || !data.toolsUsed.includes('InspectTask')) throw Error('IRIS did not return the required agent and tool evidence.');
  if(task.kind!=='coding') throw Error('Live AI Hub currently supports the coding workflow. Use the local study exercise.');
  const code=data.decision.code;
  if(typeof code!=='string'||code.length>12000) throw Error('The AI Hub candidate is missing or too large.');
  task.proposal={summary:data.decision.summary.slice(0,4000),nextAction:String(data.decision.nextAction||'Review the candidate and run checks.').slice(0,1000),code,hash:hash(code),sourceHash:hash(task.source),provider:data.provider,strategy:'Inspect task → choose a repair → independently check',toolsUsed:data.toolsUsed,usage:data.usage};
  task.stage='prepare';task.revision++;event(task,'AI Hub inspected the task and returned a candidate. Checks have not run.');
}
