import { groqDecision } from './groq.js';
import { hash, event } from './domain.js';
import { isGeneral, applyWork, applyAssessment, applyRouting } from './general.js';

// This endpoint is implemented by iris/Finish/Api.cls. No credentials go to React.
async function requestDecision(payload) {
  if(process.env.AI_BACKEND==='groq')return groqDecision(payload);
  const base=process.env.IRIS_BASE_URL;
  if(!base) throw Error('Set IRIS_BASE_URL on the server to enable live AI Hub.');
  const headers={'Content-Type':'application/json'};
  if(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD) headers.Authorization='Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
  const encoded=JSON.stringify(payload);
  if(Buffer.byteLength(encoded)>240000)throw Error('The combined context and previous work are too large. Use smaller excerpts.');
  const response=await fetch(new URL('investigate',base.endsWith('/')?base:base+'/'),{method:'POST',headers,body:encoded,signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw Error(`IRIS returned HTTP ${response.status}. Check server configuration.`);
  const data=await response.json();
  if(data.provider!=='InterSystems IRIS AI Hub' || !data.decision || !Array.isArray(data.toolsUsed) || !data.toolsUsed.includes('InspectTask')) throw Error('IRIS did not return the required agent and tool evidence.');
  return data;
}
export async function investigateWithIris(task) {
 const payload={taskId:task.id,title:task.title,kind:task.kind,profile:task.profile,blocker:task.blocker,tried:task.tried,source:task.source,attempts:task.attempts.slice(-3),material:task.material,criteria:task.criteria,subject:task.subject,description:task.description};
 if(isGeneral(task)){
  if(task.kind==='coding'&&!(task.source||task.material||'').trim())throw Error('Add relevant source files or project context before asking for a change.');
  if(task.kind==='study'&&!(task.material||'').trim())throw Error('Add your notes or source material so the lesson is grounded in what you are studying.');
  const data=await requestDecision(payload);
  if(applyRouting(task,data))return;
  const required=task.kind==='coding'?'PrepareProject':'PrepareLesson';
  if(!data.toolsUsed.includes(required))throw Error('AI Hub did not prepare the required work. Try again.');
  applyWork(task,data);return;
 }
 const data=await requestDecision(payload);
 if(applyRouting(task,data))return;
  if(task.kind!=='coding') throw Error('Live AI Hub currently supports the coding workflow. Use the local study exercise.');
  const code=data.decision.code;
  if(typeof code!=='string'||code.length>12000) throw Error('The AI Hub candidate is missing or too large.');
  task.proposal={summary:data.decision.summary.slice(0,4000),nextAction:String(data.decision.nextAction||'Review the candidate and run checks.').slice(0,1000),code,hash:hash(code),sourceHash:hash(task.source),provider:data.provider,strategy:'Inspect task → choose a repair → independently check',toolsUsed:data.toolsUsed,usage:data.usage};
  task.stage='prepare';task.revision++;event(task,`${data.provider} returned a candidate. Checks have not run.`);
}

export async function assessStudyWithIris(task,input) {
 if(!isGeneral(task)||task.kind!=='study'||!task.study||task.stage==='review'||task.status==='completed')throw Error('Prepare an active study lesson first.');
 if(typeof input!=='string'||!input.trim()||input.length>8000)throw Error('Enter your answer (up to 8,000 characters).');
 const phase=task.study.phase;
 const data=await requestDecision({kind:'study-review',profile:'assessment',title:task.title,subject:task.subject,material:task.material,question:phase==='guided'?task.study.guidedQuestion:task.study.transferQuestion,rubric:phase==='guided'?task.study.guidedRubric:task.study.transferRubric,answer:input.trim()});
 if(!data.toolsUsed.includes('AssessAnswer'))throw Error('The assessor did not return a tool-based assessment. Try again.');
 applyAssessment(task,input.trim(),data);
}
