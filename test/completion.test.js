import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createTask, localInvestigate, runChecks, approve, invalidate, answerStudy, publicTask } from '../server/domain.js';
import { checkTotal, FIXED_TOTAL } from '../server/checker.js';
import { Store } from '../server/store.js';
import { api } from '../server/api.js';
const coding=()=>createTask({kind:'coding',title:'Repair totals',blocker:'String concatenation'});
test('only checked code can be approved, and edited code invalidates the evidence',()=>{
 const task=coding(); localInvestigate(task);
 assert.throws(()=>approve(task,'invented'),/evidence/);
 runChecks(task); assert.equal(task.checks.every(c=>c.passed),true);
 const token=task.approvalToken;task.proposal.code+=' ';
 assert.throws(()=>approve(task,token),/no longer matches/);
 runChecks(task);approve(task,task.approvalToken);
 assert.equal(task.status,'completed');assert.equal(task.source,FIXED_TOTAL+' ');
});
test('unsupported code cannot masquerade as expected input validation',()=>{
 const checks=checkTotal("export function total(prices) { return process.exit(); }");
 assert.equal(checks.some(c=>c.passed),false);
});
test('changing context requires a fresh investigation and checks',()=>{
 const task=coding();localInvestigate(task);runChecks(task);const token=task.approvalToken;
 invalidate(task);assert.equal(task.evidence,undefined);assert.equal(task.proposal,undefined);
 assert.throws(()=>approve(task,token),/evidence/);
});
test('study completion requires a correct independent transfer answer',()=>{
 const task=createTask({kind:'study',title:'Equations'});localInvestigate(task);
 assert.equal(publicTask(task).study.expected,undefined);
 answerStudy(task,'99');assert.equal(task.study.step,0);
 answerStudy(task,'3');answerStudy(task,'4');answerStudy(task,'4');
 assert.notEqual(task.stage,'review');assert.equal(task.evidence,undefined);
 answerStudy(task,'5');approve(task,task.approvalToken);assert.equal(task.status,'completed');
});
test('malformed task fields are rejected before persistence',()=>{
 assert.throws(()=>createTask({kind:'coding',title:'Task',blocker:{text:'bad'}}),/text/);
});
test('HTTP workflow rejects stale writes and persists checked completion across reload',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'finish-test-'));
 const store=await new Store(dir).init();const handler=api(store);
 const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 try{
  let task=(await post('/api/tasks',{kind:'coding',title:'API task',blocker:'Strings'})).data.task;
  const endpoint=`/api/tasks/${task.id}`;
  const premature=await post(endpoint+'/check',{revision:task.revision,code:FIXED_TOTAL});
  assert.equal(premature.status,400);assert.match(premature.data.error,/Investigate/);
  task=(await post(endpoint+'/investigate',{revision:task.revision,engine:'local'})).data.task;
  const stale=await post(endpoint+'/pause',{revision:0,breadcrumb:'Review next'});assert.equal(stale.status,400);
  task=(await post(endpoint+'/check',{revision:task.revision,code:FIXED_TOTAL})).data.task;
  task=(await post(endpoint+'/approve',{revision:task.revision,token:task.approvalToken})).data.task;
  assert.equal(task.status,'completed');
  const reloaded=await new Store(dir).init();assert.equal(reloaded.data.tasks.find(t=>t.id===task.id).status,'completed');
 }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
