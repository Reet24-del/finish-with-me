import { createHash, randomUUID } from 'node:crypto';
export const isGeneral=t=>['project','subject','integration'].includes(t.profile);
export const fingerprint=t=>createHash('sha256').update(JSON.stringify([t.title,t.description,t.blocker,t.tried,t.source,t.material,t.criteria,t.subject])).digest('hex');
const text=(v,max=24000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('The AI response is incomplete or too large. Try again with a smaller task.');return v.trim();};
export function applyWork(task,data){
 const d=data.decision;
 delete task.evidence;delete task.approvalToken;delete task.verificationNotes;delete task.verificationStatus;
 if(task.kind==='coding'){
  task.proposal={summary:text(d.summary,6000),nextAction:text(d.nextAction,3000),artifact:text(d.artifact,32000),verification:text(d.verification,8000),provider:data.provider,toolsUsed:data.toolsUsed,usage:data.usage,contextHash:fingerprint(task),strategy:'Inspect your context → prepare a bounded change → verify in your project'};
 }else{
  const sourceQuote=text(d.sourceQuote,2000);
  if(!task.material.includes(sourceQuote))throw Error('The lesson did not cite an exact passage from your material. Try again.');
  task.study={sourceQuote,explanation:text(d.explanation,12000),guidedQuestion:text(d.guidedQuestion,4000),guidedRubric:text(d.guidedRubric,6000),transferQuestion:text(d.transferQuestion,4000),transferRubric:text(d.transferRubric,6000),phase:'guided',attempts:[],feedback:'',assessment:null,contextHash:fingerprint(task)};
  if(task.study.guidedQuestion===task.study.transferQuestion)throw Error('The independent question must differ from the guided question. Try again.');
  task.proposal={summary:'A lesson and two exercises were prepared from your material.',nextAction:'Explain your answer to the guided question, then tackle the independent question.',provider:data.provider,toolsUsed:data.toolsUsed,usage:data.usage,strategy:'Your material → guided explanation → independent practice',contextHash:fingerprint(task)};
 }
 task.stage='prepare';task.revision++;
 task.events.push({id:randomUUID(),at:new Date().toISOString(),message:'AI Hub inspected your supplied context and prepared the next piece of work.',type:'info'});
}
export function recordProjectEvidence(task,input){
 if(task.kind!=='coding'||!isGeneral(task)||!task.proposal)throw Error('Prepare a project proposal first.');
 if(task.proposal.contextHash!==fingerprint(task))throw Error('Context changed. Investigate again.');
 const artifact=text(input.artifact,32000),evidence=text(input.evidence,16000);
 if(typeof input.passed!=='boolean')throw Error('Choose whether the verification passed or needs more work.');
 if(input.confirmed!==true)throw Error('Confirm that you ran the relevant checks in your own project.');
 if(evidence.length<30)throw Error('Add meaningful results: the command or check, outcome, and relevant output (at least 30 characters).');
 task.proposal.artifact=artifact;task.verificationNotes=evidence;task.verificationStatus=input.passed?'passed':'failed';
 if(!input.passed){task.stage='check';delete task.evidence;delete task.approvalToken;task.revision++;task.events.push({id:randomUUID(),at:new Date().toISOString(),message:'Recorded checks that still need work. Revise using these results before completing.',type:'warning'});return;}
 task.evidence={type:'user-reported-project-verification',contextHash:fingerprint(task),artifactHash:createHash('sha256').update(artifact).digest('hex'),notes:evidence,checkedAt:new Date().toISOString()};
 task.stage='review';task.approvalToken=randomUUID();task.revision++;
 task.events.push({id:randomUUID(),at:new Date().toISOString(),message:'Recorded your project verification. These checks were run by you, not by the server.',type:'info'});
}
export function approveGeneral(task,token){
 if(task.status==='completed'||task.stage!=='review'||!token||token!==task.approvalToken||!task.evidence)throw Error('Current evidence and explicit approval are required.');
 if(task.evidence.contextHash!==fingerprint(task))throw Error('Your context changed. Generate fresh evidence.');
 if(task.kind==='coding'&&task.evidence.artifactHash!==createHash('sha256').update(task.proposal.artifact).digest('hex'))throw Error('The change no longer matches the recorded evidence.');
 if(task.kind==='study'&&(!task.study?.assessment?.passed||task.study.phase!=='transfer'))throw Error('Pass the independent question first.');
 task.status='completed';task.completedAt=new Date().toISOString();delete task.approvalToken;task.revision++;
 task.events.push({id:randomUUID(),at:new Date().toISOString(),message:task.kind==='coding'?'Approved the proposed work with your recorded verification.':'Approved completion after an AI-assessed independent answer.',type:'success'});
}
export function applyAssessment(task,answer,data){
 if(task.study.contextHash!==fingerprint(task))throw Error('Study material changed. Prepare a new lesson.');
 const d=data.decision;if(typeof d.passed!=='boolean')throw Error('The assessor did not return a valid result. Try again.');
 const feedback=text(d.feedback,6000);const phase=task.study.phase;
 task.study.attempts.push({phase,answer,passed:d.passed,feedback,at:new Date().toISOString()});task.study.feedback=feedback;task.study.assessment={passed:d.passed,provider:data.provider,toolsUsed:data.toolsUsed};
 if(d.passed&&phase==='guided'){task.study.phase='transfer';task.study.feedback='Guided answer accepted. Now solve the independent question without the worked explanation.';task.study.assessment=null;}
 else if(d.passed){task.stage='review';task.approvalToken=randomUUID();task.evidence={type:'ai-assessed-independent-transfer',contextHash:fingerprint(task),question:task.study.transferQuestion,answer,feedback,checkedAt:new Date().toISOString()};}
 task.events.push({id:randomUUID(),at:new Date().toISOString(),message:`AI assessment of ${phase} answer: ${d.passed?'accepted':'try again'}.`,type:d.passed?'success':'warning'});
 task.revision++;
}
