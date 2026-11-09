import {writeFile} from 'node:fs/promises';
const base=process.env.APP_BASE_URL||'http://127.0.0.1:4318';
async function request(path,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(95000)});
 const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;
}
const health=await request('/api/health');if(!health.irisVerified)throw Error('Container cannot reach authenticated IRIS');
const tasks=(await request('/api/tasks')).tasks;
let task=tasks.find(t=>t.title==='Docker installation verification (synthetic)'&&t.status==='active')||(await request('/api/tasks',{kind:'coding',profile:'receipt-total',title:'Docker installation verification (synthetic)',blocker:'Numeric strings concatenate instead of adding.'})).task;
const trace=[];
for(let i=0;i<3;i++){
 task=(await request(`/api/tasks/${task.id}/investigate`,{revision:task.revision,engine:'iris'})).task;
 task=(await request(`/api/tasks/${task.id}/check`,{revision:task.revision,code:task.proposal.code})).task;
 trace.push({attempt:i+1,passed:task.checks.filter(c=>c.passed).length,total:task.checks.length,toolsUsed:task.proposal.toolsUsed});
 if(task.stage==='review'){task=(await request(`/api/tasks/${task.id}/approve`,{revision:task.revision,token:task.approvalToken})).task;break;}
}
const evidence={at:new Date().toISOString(),synthetic:true,health,taskId:task.id,status:task.status,trace};
await writeFile('docs/docker-verification.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence));if(task.status!=='completed')process.exitCode=1;
