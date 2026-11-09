import {writeFile} from 'node:fs/promises';
import { createTask, invalidate, runChecks, approve } from '../server/domain.js';
import { investigateWithIris } from '../server/iris.js';
process.loadEnvFile('.env');
process.env.IRIS_BASE_URL ||= 'http://127.0.0.1:52773/csp/user/finish/';
const task=createTask({kind:'coding',profile:'receipt-total',title:'Synthetic live verification: receipt total',blocker:'Numeric strings concatenate instead of adding.',tried:'Checked the incoming values.'});
const runs=[];
for(let attempt=1;attempt<=3;attempt++){
 invalidate(task);
 await investigateWithIris(task);
 runChecks(task);
 runs.push({attempt,provider:task.proposal.provider,toolsUsed:task.proposal.toolsUsed,usage:task.proposal.usage,candidate:task.proposal.code,checks:task.checks});
 console.log(`Live attempt ${attempt}: ${task.checks.filter(c=>c.passed).length}/${task.checks.length} checks passed; tools: ${task.proposal.toolsUsed.join(', ')}`);
 if(task.stage==='review'){approve(task,task.approvalToken);break;}
}
const result={at:new Date().toISOString(),build:'2027.1.0AI.109.0',provider:'Groq via IRIS AI Hub',model:process.env.AIHUB_MODEL,synthetic:true,status:task.status,runs};
await writeFile('docs/live-verification.json',JSON.stringify(result,null,2)+'\n');
if(task.status!=='completed')process.exitCode=1;
