import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createTask, approve } from '../server/domain.js';
import { fingerprint } from '../server/general.js';
import { applyIrisInvestigate, applyIrisCheck, applyIrisVerify, applyIrisHuman } from '../server/decision.js';
import { FIXED_TOTAL } from '../server/checker.js';

const gate = (outcome, extra={}) => ({provider:'InterSystems IRIS AI Hub', outcome, reason:'Gate reason', sessionId:'42', workflowTaskId: outcome==='pending-approval'||outcome==='escalate'?'9':'', role:outcome==='escalate'?'Finish.Supervisor':outcome==='pending-approval'?'Finish.Reviewer':'', approvalToken:outcome==='pending-approval'?'token-from-iris':'', gate:{outcome, reason:'Gate reason', checks:extra.checks, evidence:extra.evidence, advance:extra.advance||''}, ...extra});

test('the node fingerprint matches the IRIS gate context hash', () => {
  const task = createTask({kind:'coding', title:'Fix "quotes"', description:'line\nbreak', blocker:'stuck', source:'a/b', material:'café', criteria:'ok', subject:'Py'});
  const py = spawnSync('python3', ['-c', 'import json,sys\nsys.path.insert(0,"iris/gate")\nfrom engine import context_hash\nprint(context_hash(json.load(sys.stdin)))'], {input:JSON.stringify({title:task.title,description:task.description,blocker:task.blocker,tried:task.tried,source:task.source,material:task.material,criteria:task.criteria,subject:task.subject}), encoding:'utf8'});
  assert.equal(py.status, 0, py.stderr);
  assert.equal(py.stdout.trim(), fingerprint(task));
});

test('an IRIS proposal does not complete the task, and only a complete outcome does', () => {
  const task = createTask({kind:'coding', title:'Fix Python pagination', source:'def page():\n    return items', blocker:'The slice is short.', criteria:'Return the page.'});
  const proposal = {provider:'InterSystems IRIS AI Hub', toolsUsed:['InspectTask','PrepareProject'], decision:{summary:'Fix the slice.', nextAction:'Run the check.', artifact:'def page():\n    return items[start:start+limit]', verification:'pytest pagination: expect two items.'}};
  applyIrisInvestigate(task, gate('needs-evidence', proposal));
  assert.equal(task.status, 'active');
  assert.equal(task.stage, 'prepare');
  assert.equal(task.decisionOwner, 'iris');
  assert.equal(task.iris.sessionId, '42');
  assert.throws(() => approve(task, 'token-from-iris'), /evidence/);
  applyIrisVerify(task, {artifact:proposal.decision.artifact, evidence:'pytest pagination: 8 passed; inspected the second page.', confirmed:true, passed:true}, gate('pending-approval', {evidence:{type:'iris-gate-verification', notes:'pytest pagination: 8 passed; inspected the second page.'}}));
  assert.equal(task.status, 'active');
  assert.equal(task.stage, 'review');
  assert.equal(task.approvalToken, 'token-from-iris');
  applyIrisHuman(task, gate('reject'));
  assert.equal(task.status, 'active');
  applyIrisHuman(task, gate('complete'));
  assert.equal(task.status, 'completed');
});

test('receipt checks stay inside the IRIS outcome and a gate rejection is not approval', () => {
  const task = createTask({kind:'coding', profile:'receipt-total', title:'Totals', blocker:'Strings'});
  task.proposal = {code:FIXED_TOTAL, hash:'x'};
  const checks = Array.from({length:8}, (_,i) => ({name:`check ${i}`, passed:i<7, actual:'0', expected:'1'}));
  applyIrisCheck(task, gate('needs-evidence', {checks}));
  assert.equal(task.stage, 'check');
  assert.equal(task.approvalToken, undefined);
  const passed = checks.map(item => ({...item, passed:true}));
  applyIrisCheck(task, gate('pending-approval', {checks:passed, evidence:{type:'iris-gate-checks', count:8}}));
  assert.equal(task.stage, 'review');
  assert.notEqual(task.status, 'completed');
  assert.throws(() => applyIrisCheck(task, gate('complete', {checks:passed})), /workflow approval/);
});

test('integration profile is a real task and still refuses a local decision', async () => {
  const {localInvestigate} = await import('../server/domain.js');
  const task = createTask({kind:'coding', profile:'integration', title:'Stuck transform', blocker:'Message failed', source:'ERROR Transform failed\nField RequiredField is empty\n'});
  assert.equal(task.profile, 'integration');
  assert.throws(() => localInvestigate(task), /Connect IRIS/);
});
