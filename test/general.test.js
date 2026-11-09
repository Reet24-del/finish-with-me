import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask,publicTask,approve,invalidate,localInvestigate} from '../server/domain.js';
import {applyWork,recordProjectEvidence,applyAssessment} from '../server/general.js';
const project=()=>createTask({kind:'coding',title:'Fix Python pagination',source:'def page(items, start, limit): return items[start:limit]',blocker:'Second page ends too early.',criteria:'Return limit items starting at start.'});
const work={provider:'InterSystems IRIS AI Hub',toolsUsed:['InspectTask','PrepareProject'],decision:{summary:'Fix the slice endpoint.',nextAction:'Apply the change and run pagination tests.',artifact:'def page(items, start, limit): return items[start:start+limit]',verification:'Check page([0,1,2,3],2,2) == [2,3]'}};
test('new tasks use own-context profiles and never silently return example answers',()=>{
 const p=project();assert.equal(p.profile,'project');assert.throws(()=>localInvestigate(p),/Connect IRIS/);
 const s=createTask({kind:'study',title:'Biology'});assert.equal(s.profile,'subject');assert.equal(s.source,'');assert.throws(()=>createTask({kind:'study',title:'Invalid',profile:'project'}),/profile/);
});
test('general project requires user evidence and matching artifact/context for approval',()=>{
 const p=project();applyWork(p,work);assert.throws(()=>approve(p,'fake'),/evidence/);
 assert.throws(()=>recordProjectEvidence(p,{artifact:work.decision.artifact,evidence:'looks fine',confirmed:true,passed:true}),/meaningful/);
 assert.throws(()=>recordProjectEvidence(p,{artifact:work.decision.artifact,evidence:'pytest pagination: 8 passed; inspected the second page.',passed:true}),/Confirm/);
 recordProjectEvidence(p,{artifact:work.decision.artifact,evidence:'pytest pagination: 8 passed; inspected the second page.',confirmed:true,passed:true});
 assert.equal(p.evidence.type,'user-reported-project-verification');const token=p.approvalToken;
 p.proposal.artifact+='\n# changed';assert.throws(()=>approve(p,token),/no longer matches/);p.proposal.artifact=work.decision.artifact;
 p.criteria='A different contract';assert.throws(()=>approve(p,token),/context changed/);
});
test('general study hides rubrics, requires independent assessment, and invalidates on context changes',()=>{
 const s=createTask({kind:'study',title:'Photosynthesis',material:'Plants convert light energy into chemical energy.'});
 applyWork(s,{provider:'InterSystems IRIS AI Hub',toolsUsed:['InspectTask','PrepareLesson'],decision:{sourceQuote:'Plants convert light energy into chemical energy.',explanation:'Plants store energy from light.',guidedQuestion:'What conversion occurs?',guidedRubric:'Light to chemical energy',transferQuestion:'What happens to stored energy without light?',transferRubric:'No further light-driven conversion'}});
 assert.equal(publicTask(s).study.guidedRubric,undefined);assert.equal(publicTask(s).study.transferRubric,undefined);assert.equal(publicTask(s).study.transferQuestion,undefined);
 applyAssessment(s,'irrelevant',{provider:'AI',decision:{passed:false,feedback:'Explain the energy conversion.'}});assert.equal(s.study.phase,'guided');assert.equal(s.evidence,undefined);
 applyAssessment(s,'Light to chemical',{provider:'AI',decision:{passed:true,feedback:'Correct conversion.'}});assert.equal(s.study.phase,'transfer');assert.equal(s.evidence,undefined);assert(publicTask(s).study.transferQuestion);
 applyAssessment(s,'It stops storing new light energy',{provider:'AI',decision:{passed:true,feedback:'Correct application.'}});assert.equal(s.evidence.type,'ai-assessed-independent-transfer');approve(s,s.approvalToken);assert.equal(s.status,'completed');invalidate(s);assert.equal(s.study,undefined);assert.equal(s.evidence,undefined);
});

test('reported failing checks do not unlock approval and feed the next revision',()=>{
 const p=project();applyWork(p,work);recordProjectEvidence(p,{artifact:work.decision.artifact,evidence:'pytest: test_second_page still fails with an empty result.',confirmed:true,passed:false});
 assert.equal(p.stage,'check');assert.equal(p.evidence,undefined);assert.throws(()=>approve(p,'invented'),/evidence/);
 invalidate(p);assert.match(p.attempts.at(-1).verification,/still fails/);assert.equal(p.attempts.at(-1).outcome,'failed');
 applyWork(p,work);assert.equal(p.verificationNotes,undefined);
});
