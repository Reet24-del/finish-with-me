import { isGeneral, approveGeneral } from './general.js';
import { createHash, randomUUID } from 'node:crypto';
import { checkTotal, FIXED_TOTAL } from './checker.js';
export const INITIAL_SOURCE = `export function total(prices) {\n  return prices.reduce((sum, price) => sum + price, 0);\n}`;
export const hash = source => createHash('sha256').update(source).digest('hex');
export const contract = ['Numeric totals', 'Empty input returns zero', 'Invalid prices are rejected'];
export function event(task, message, type='info') { task.events.push({id:randomUUID(),at:new Date().toISOString(),message,type}); }
export function createTask(input) {
  if (!['coding','study'].includes(input.kind) || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120) throw Error('Choose a task type and a title up to 120 characters.');
  for (const key of ['description','blocker','tried','source','material','criteria','subject']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 32000)) throw Error('Task fields must be text up to 32,000 characters.');
  const study = input.kind === 'study';
  const profile=input.profile||(study?'subject':'project');
  if(!(study?['subject','linear-equations']:['project','receipt-total','integration']).includes(profile))throw Error('Choose a supported task profile.');
  const task = {id:randomUUID(),title:input.title.trim(),kind:input.kind,profile,material:input.material||'',criteria:input.criteria||'',subject:input.subject||'',description:input.description || '',blocker:input.blocker || '',tried:input.tried || '',source:input.source||(profile==='receipt-total'?INITIAL_SOURCE:''),stage:'understand',status:'active',events:[],attempts:[],createdAt:new Date().toISOString(),revision:0};
  event(task, 'Task ready to investigate.'); return task;
}
export function seedTasks() {
  return [createTask({kind:'coding', profile:'receipt-total', title:'Example: Fix receipt total',description:'The total becomes 01020 instead of 30.',blocker:'Adding prices joins the values instead of summing them.',tried:'I checked the input values.'}),createTask({kind:'study',profile:'linear-equations',title:'Example: Understand linear equations',description:'Find the first step, then solve a fresh question yourself.',blocker:'I can follow an example, but I get stuck when solving on my own.',tried:'I reread my notes.'}),createTask({kind:'coding',profile:'integration',title:'Example: Stuck transform',description:'A record message failed in the interoperability transform because RequiredField was empty.',blocker:'Message 1042 is stuck in error status after Finish.RecordToTarget.',tried:'I opened the message trace and saw the transform error.',subject:'IRIS interoperability',criteria:'Replay the message after RequiredField is populated. Do not mark it complete until the replay result is recorded.',source:'ERROR #5001: Transform Finish.RecordToTarget failed\nSource message id: 1042\nClass: Finish.Record\nField RequiredField is empty\nTarget class Finish.Target was not created\nLast action: DTL Set target.RequiredField = source.RequiredField\n'})];
}
export function invalidate(task) {
  if(isGeneral(task)&&task.kind==='coding'&&task.proposal?.artifact){task.attempts.push({at:new Date().toISOString(),artifact:task.proposal.artifact,verification:task.verificationNotes||'',outcome:task.verificationStatus||'not-verified'});task.attempts=task.attempts.slice(-8);}
  delete task.routing; delete task.proposal; delete task.checks; delete task.baseline; delete task.study; delete task.evidence; delete task.approvalToken;
  task.stage='understand';task.status='active';task.revision++;
}
export function localInvestigate(task) {
  if(isGeneral(task))throw Error('Connect IRIS AI Hub to work on your own projects and study material. The built-in examples remain available without AI.');
  if (task.kind === 'study') {
    task.study={step:0,failures:0,attempts:[],instruction:'Start with 2x + 3 = 11. What do you subtract from both sides to isolate 2x?',prompt:'Number to subtract',expected:3};
    task.proposal={summary:'Let’s work through one equation together, then check a new one independently.',nextAction:'Subtract the constant from both sides. You choose the number.',strategy:'Guided practice → independent transfer',provider:'Local guided exercise'};
  } else {
    task.baseline=checkTotal(task.source);
    const allGood=task.baseline.every(c=>c.passed);
    task.proposal={summary:allGood?'Your function already meets the agreed checks. Review the evidence before finishing.':'The current source fails the receipt-total contract. The proposed function converts each price to a number and rejects blank or invalid input.',nextAction:'Inspect the proposed change, then run the agreed checks.',code:allGood?task.source:FIXED_TOTAL,strategy:'Reproduce → prepare a bounded repair → check',provider:'Local rule-based repair',sourceHash:hash(task.source)};
    task.proposal.hash=hash(task.proposal.code);
  }
  task.stage='prepare';task.revision++;event(task,task.kind==='study'?'Prepared a guided equation exercise.':'Checked the original function and prepared a candidate.');
}
export function runChecks(task,nativeResult=null) {
  if(isGeneral(task))throw Error('Run the proposed checks in your project, then record their results.');
  if (task.kind !== 'coding' || !task.proposal?.code) throw Error('Investigate the coding task before checking it.');
  if (task.proposal.sourceHash !== hash(task.source)) throw Error('Source changed. Investigate again.');
  task.checks=nativeResult?nativeResult.checks:checkTotal(task.proposal.code);
  task.attempts.push({at:new Date().toISOString(),hash:hash(task.proposal.code),checks:task.checks});
  if (task.checks.every(c=>c.passed)) {
    task.stage='review';task.approvalToken=randomUUID();
    task.evidence={engine:nativeResult?.provider||'Local bounded JavaScript interpreter',hash:hash(task.proposal.code),count:task.checks.length,checkedAt:new Date().toISOString()};
    event(task,`${task.checks.length} contract checks passed. Ready for your review.`,'success');
  } else {task.stage='check';delete task.approvalToken;delete task.evidence;event(task,'The candidate did not pass. Keep the task open and revise it.','warning');}
  task.revision++;
}
export function approve(task, token) {
  if(isGeneral(task))return approveGeneral(task,token);
  if(task.status==='completed') throw Error('This task is already complete.');
  if(task.stage!=='review' || !token || token!==task.approvalToken || !task.evidence) throw Error('Current passing evidence and review approval are required.');
  if(task.kind==='coding') {
    if(task.evidence.hash!==hash(task.proposal.code) || task.proposal.sourceHash!==hash(task.source)) throw Error('The evidence no longer matches this source. Check it again.');
    task.source=task.proposal.code;
  }
  task.status='completed';task.completedAt=new Date().toISOString();delete task.approvalToken;task.revision++;
  event(task,task.kind==='coding'?'Approved and saved the checked function in this workspace.':'Confirmed: you solved the transfer exercise.','success');
}
export function answerStudy(task, input) {
  if(task.kind!=='study' || !task.study || task.stage==='review' || task.status==='completed') throw Error('Start an active study exercise first.');
  const raw=String(input).trim();
  if(!/^-?\d+(?:\.\d+)?$/.test(raw)) throw Error('Enter a number for this step.');
  const study=task.study, correct=Number(raw)===study.expected;
  study.attempts.push({step:study.step,answer:raw,correct});
  if(!correct) {
    study.failures++;
    study.feedback=study.step===0 ? 'Look at the +3 beside 2x. Undo addition using subtraction.' : study.step===1 ? 'After subtracting 3, the equation is 2x = 8. Divide both sides by 2.' : 'Work from 3x + 2 = 17: subtract 2 first, then divide by 3.';
    event(task, 'That attempt needs another look. A more explicit hint is ready.','warning');
  } else {
    study.failures=0;study.feedback='That step is correct.';study.step++;
    if(study.step===1) Object.assign(study,{instruction:'Now 2x = 8. What is x?',prompt:'Value of x',expected:4});
    else if(study.step===2) Object.assign(study,{instruction:'Your turn, without a worked solution: solve 3x + 2 = 17.',prompt:'Value of x',expected:5});
    else {
      task.stage='review';task.evidence={type:'independent-transfer',question:'3x + 2 = 17',answer:5,checkedAt:new Date().toISOString()};task.approvalToken=randomUUID();
      event(task,'Transfer check passed: your answer satisfies the new equation.','success');
    }
  }
  task.revision++;
}
export function publicTask(task) {
  const copy=structuredClone(task);
  if(copy.study) {delete copy.study.expected;delete copy.study.guidedRubric;delete copy.study.transferRubric;if(copy.study.phase==='guided')delete copy.study.transferQuestion;}
  return copy;
}
