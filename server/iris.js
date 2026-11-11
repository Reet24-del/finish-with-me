import { groqDecision } from './groq.js';
import { hash, event } from './domain.js';
import { fingerprint, isGeneral, applyRouting, applyWork, applyAssessment } from './general.js';
import { applyIrisInvestigate, applyIrisCheck, applyIrisVerify, applyIrisAssessment, applyIrisHuman } from './decision.js';

async function postDecide(payload) {
  const base = process.env.IRIS_BASE_URL;
  if (!base) throw Error('Set IRIS_BASE_URL on the server to enable live AI Hub.');
  const headers = {'Content-Type':'application/json'};
  if (process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD) headers.Authorization = 'Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded) > 240000) throw Error('The combined context and previous work are too large. Use smaller excerpts.');
  const response = await fetch(new URL('decide', base.endsWith('/') ? base : base+'/'), {method:'POST', headers, body:encoded, signal:AbortSignal.timeout(120000)});
  if (!response.ok) {
    let detail = `IRIS returned HTTP ${response.status}. Check server configuration.`;
    try { const body = await response.json(); if (body.error) detail = body.error; } catch {}
    throw Error(detail);
  }
  const data = await response.json();
  if (data.provider !== 'InterSystems IRIS AI Hub' || typeof data.outcome !== 'string' || !data.gate) throw Error('IRIS did not return a production decision.');
  return data;
}

function snapshot(task, extra={}) {
  return {
    taskId:task.id,
    title:task.title,
    description:task.description||'',
    kind:extra.kind||task.kind,
    profile:extra.profile||task.profile,
    blocker:task.blocker||'',
    tried:task.tried||'',
    source:task.source||'',
    material:task.material||'',
    criteria:task.criteria||'',
    subject:task.subject||'',
    attempts:(task.attempts||[]).slice(-3),
    attemptCount:extra.attemptCount??0,
    contextHash:fingerprint(task),
    workflowTaskId:task.iris?.workflowTaskId||'',
    workflowRole:task.iris?.role||'',
    distributionToken:task.iris?.distributionToken||'',
    ...extra,
  };
}

function requiredTool(task) {
  if (task.profile === 'integration') return 'PrepareRepair';
  if (task.profile === 'project') return 'PrepareProject';
  if (task.profile === 'subject' || task.kind === 'study') return 'PrepareLesson';
  return 'PrepareCandidate';
}

export async function investigateWithIris(task) {
  if (process.env.AI_BACKEND === 'groq') return investigateWithGroq(task);
  if (isGeneral(task)) {
    if (task.kind === 'coding' && !(task.source||task.material||'').trim()) throw Error('Add relevant source files or project context before asking for a change.');
    if (task.kind === 'study' && !(task.material||'').trim()) throw Error('Add your notes or source material so the lesson is grounded in what you are studying.');
  }
  const data = await postDecide(snapshot(task, {action:'investigate', attemptCount:task.failedVerifications||0}));
  if (!Array.isArray(data.toolsUsed) || !data.toolsUsed.includes('InspectTask')) throw Error('IRIS did not return the required agent and tool evidence.');
  const route = data.gate?.route?.action;
  if (route !== 'hint' && route !== 'human' && data.outcome !== 'escalate' && !data.toolsUsed.includes(requiredTool(task))) throw Error('AI Hub did not prepare the required work. Try again.');
  applyIrisInvestigate(task, data);
}

async function investigateWithGroq(task) {
  const payload = {taskId:task.id,title:task.title,kind:task.kind,profile:task.profile,blocker:task.blocker,tried:task.tried,source:task.source,attempts:task.attempts.slice(-3),material:task.material,criteria:task.criteria,subject:task.subject,description:task.description};
  if (isGeneral(task)) {
    if (task.kind === 'coding' && !(task.source||task.material||'').trim()) throw Error('Add relevant source files or project context before asking for a change.');
    if (task.kind === 'study' && !(task.material||'').trim()) throw Error('Add your notes or source material so the lesson is grounded in what you are studying.');
    const data = await groqDecision(payload);
    if (applyRouting(task, data)) return;
    const required = task.profile === 'integration' ? 'PrepareRepair' : task.kind === 'coding' ? 'PrepareProject' : 'PrepareLesson';
    if (!data.toolsUsed.includes(required)) throw Error('The hosted model did not prepare the required work. Try again.');
    applyWork(task, data);
    return;
  }
  const data = await groqDecision(payload);
  if (applyRouting(task, data)) return;
  if (task.kind !== 'coding') throw Error('Live AI currently supports the coding workflow. Use the local study exercise.');
  const code = data.decision.code;
  if (typeof code !== 'string' || code.length > 12000) throw Error('The AI candidate is missing or too large.');
  task.proposal = {summary:data.decision.summary.slice(0,4000),nextAction:String(data.decision.nextAction||'Review the candidate and run checks.').slice(0,1000),code,hash:hash(code),sourceHash:hash(task.source),provider:data.provider,strategy:'Inspect task → choose a repair → independently check',toolsUsed:data.toolsUsed,usage:data.usage};
  task.stage = 'prepare';
  task.revision++;
  event(task, `${data.provider} returned a candidate. Checks have not run.`);
}

export async function checkWithIris(task, code) {
  if (task.decisionOwner !== 'iris' || task.profile !== 'receipt-total' || !task.proposal) throw Error('Investigate the coding task before checking it.');
  const candidate = typeof code === 'string' ? code : task.proposal.code;
  if (typeof candidate !== 'string' || candidate.length > 12000) throw Error('Candidate must be text up to 12,000 characters.');
  const data = await postDecide(snapshot(task, {
    action:'check',
    candidate,
    attemptCount:task.attempts.length,
    proposal:{...task.proposal, code:candidate, sourceHash:hash(task.source)},
  }));
  task.proposal.code = candidate;
  task.proposal.hash = hash(candidate);
  task.proposal.sourceHash = hash(task.source);
  applyIrisCheck(task, data);
}

export async function verifyWithIris(task, input) {
  if (!task.proposal) throw Error('Prepare a project proposal first.');
  const data = await postDecide(snapshot(task, {
    action:'verify',
    attemptCount:task.failedVerifications||0,
    proposal:{...task.proposal, contextHash:task.proposal.contextHash||fingerprint(task)},
    evidenceInput:{artifact:input.artifact, evidence:input.evidence, confirmed:input.confirmed===true, passed:input.passed===true},
  }));
  applyIrisVerify(task, input, data);
}

export async function assessStudyWithIris(task, input) {
  if (!isGeneral(task) || task.kind !== 'study' || !task.study || task.stage === 'review' || task.status === 'completed') throw Error('Prepare an active study lesson first.');
  if (typeof input !== 'string' || !input.trim() || input.length > 8000) throw Error('Enter your answer (up to 8,000 characters).');
  const phase = task.study.phase;
  if (process.env.AI_BACKEND === 'groq') {
    const data = await groqDecision({kind:'study-review',profile:'assessment',title:task.title,subject:task.subject,material:task.material,question:phase==='guided'?task.study.guidedQuestion:task.study.transferQuestion,rubric:phase==='guided'?task.study.guidedRubric:task.study.transferRubric,answer:input.trim()});
    if (!data.toolsUsed.includes('AssessAnswer')) throw Error('The assessor did not return a tool-based assessment. Try again.');
    applyAssessment(task, input.trim(), data);
    return;
  }
  const data = await postDecide(snapshot(task, {
    action:'assess',
    kind:'study-review',
    profile:'subject',
    phase,
    question:phase==='guided' ? task.study.guidedQuestion : task.study.transferQuestion,
    rubric:phase==='guided' ? task.study.guidedRubric : task.study.transferRubric,
    answer:input.trim(),
  }));
  if (!Array.isArray(data.toolsUsed) || !data.toolsUsed.includes('AssessAnswer')) throw Error('The assessor did not return a tool-based assessment. Try again.');
  applyIrisAssessment(task, input.trim(), data);
}

export async function approveWithIris(task, input) {
  if (task.decisionOwner !== 'iris') throw Error('This completion is decided by the IRIS production.');
  const human = input?.action === 'reject' ? 'reject' : 'approve';
  const prior = task.profile === 'receipt-total' ? 'check' : task.kind === 'study' ? 'assess' : 'verify';
  const transfer = task.evidence?.type === 'iris-gate-transfer';
  const data = await postDecide(snapshot(task, {
    action:human,
    humanAction:human,
    priorAction:prior,
    approvalToken:input?.token||task.approvalToken||'',
    attemptCount:0,
    candidate:task.proposal?.code,
    phase:task.study?.phase,
    question:task.evidence?.question||task.study?.transferQuestion||'',
    answer:task.evidence?.answer||'',
    proposal:task.kind === 'study'
      ? {tool:'AssessAnswer', passed:transfer, feedback:task.evidence?.feedback||task.study?.feedback||'Recorded assessment.'}
      : {...(task.proposal||{}), sourceHash:hash(task.source||''), contextHash:task.proposal?.contextHash||fingerprint(task)},
    toolsUsed:task.kind === 'study' ? ['InspectTask','AssessAnswer'] : (task.proposal?.toolsUsed||['InspectTask']),
    evidenceInput:prior === 'verify' ? {
      artifact:task.proposal?.artifact||'',
      evidence:task.verificationNotes||task.evidence?.notes||'',
      confirmed:task.verificationStatus==='passed',
      passed:task.verificationStatus==='passed',
    } : undefined,
  }));
  applyIrisHuman(task, data);
}
