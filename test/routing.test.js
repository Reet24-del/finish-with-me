import test from 'node:test';import assert from 'node:assert/strict';
import {createTask,approve,invalidate} from '../server/domain.js';import {applyRouting} from '../server/general.js';
test('hint and human routes cannot unlock completion and require real workflow evidence',()=>{
 const task=createTask({kind:'coding',title:'Needs review'});
 const result={provider:'InterSystems IRIS AI Hub',toolsUsed:['InspectTask','ChooseRoute'],traceSessionId:123,route:{action:'hint',reason:'Learner requested a nudge',hint:'Start with the return condition'}};
 assert(applyRouting(task,result));assert.equal(task.stage,'understand');assert.equal(task.proposal,undefined);assert.throws(()=>approve(task,'fake'),/evidence/);
 result.route={action:'human',reason:'Authorized maintainer needed'};assert.throws(()=>applyRouting(task,result),/workflow request/);
 result.route.workflowRequestId='85';assert(applyRouting(task,result));assert.equal(task.status,'active');assert.equal(task.routing.action,'human');invalidate(task);assert.equal(task.routing,undefined);
});
