import { event, hash } from './domain.js';
import { applyRouting, applyWork } from './general.js';

export function applyIrisInvestigate(task, data) {
  assertDecision(data);
  if (data.outcome === 'reject') throw Error(irisError(data));
  const route = data.gate?.route;
  if (route?.action && data.toolsUsed?.includes('ChooseRoute')) {
    const routed = applyRouting(task, {...data, route:{...route, workflowRequestId:data.workflowTaskId||route.workflowRequestId, workflowRole:data.role||route.workflowRole}, traceSessionId:data.sessionId});
    remember(task, data);
    if (routed) return;
  }
  if (data.outcome !== 'escalate') {
    if (task.profile === 'receipt-total') applyReceipt(task, data);
    else applyWork(task, data);
  }
  remember(task, data);
  if (data.outcome === 'escalate') {
    task.stage = 'check';
    task.escalated = true;
    task.revision++;
  } else if (data.outcome === 'pending-approval') {
    openReview(task, data);
  }
  event(task, irisLine(data), data.outcome === 'needs-evidence' ? 'info' : 'warning');
}

export function applyIrisCheck(task, data) {
  assertDecision(data);
  if (data.outcome === 'complete') throw Error('IRIS cannot complete a candidate before workflow approval.');
  if (data.outcome === 'reject') throw Error(irisError(data));
  const checks = data.gate?.checks;
  if (!Array.isArray(checks) || checks.length !== 8) throw Error('IRIS gate did not return the eight receipt checks.');
  task.checks = checks;
  task.attempts.push({at:new Date().toISOString(), hash:hash(task.proposal.code), checks});
  remember(task, data);
  delete task.approvalToken;
  delete task.evidence;
  if (data.outcome === 'pending-approval') {
    openReview(task, data);
    event(task, irisLine(data), 'success');
  } else {
    task.stage = 'check';
    task.escalated = data.outcome === 'escalate';
    event(task, irisLine(data), 'warning');
  }
  task.revision++;
}

export function applyIrisVerify(task, input, data) {
  assertDecision(data);
  if (data.outcome === 'complete') throw Error('IRIS cannot complete recorded evidence before workflow approval.');
  if (data.outcome === 'reject') throw Error(irisError(data));
  task.proposal.artifact = input.artifact;
  task.verificationNotes = input.evidence;
  task.verificationStatus = input.passed ? 'passed' : 'failed';
  remember(task, data);
  delete task.approvalToken;
  delete task.evidence;
  if (data.outcome === 'pending-approval') {
    openReview(task, data);
    event(task, irisLine(data), 'info');
  } else {
    task.stage = 'check';
    task.escalated = data.outcome === 'escalate';
    if (data.outcome === 'needs-evidence' || data.outcome === 'escalate') task.failedVerifications = (task.failedVerifications||0)+1;
    event(task, irisLine(data), 'warning');
  }
  task.revision++;
}

export function applyIrisAssessment(task, answer, data) {
  assertDecision(data);
  if (data.outcome === 'complete') throw Error('IRIS cannot complete a study answer before workflow approval.');
  if (data.outcome === 'reject') throw Error(irisError(data));
  if (typeof data.decision?.passed !== 'boolean' || typeof data.decision.feedback !== 'string' || !data.decision.feedback.trim()) {
    throw Error('IRIS did not return an assessment.');
  }
  const feedback = data.decision.feedback.trim();
  const phase = task.study.phase;
  task.study.attempts.push({phase, answer, passed:data.decision.passed, feedback, at:new Date().toISOString()});
  task.study.feedback = feedback;
  task.study.assessment = {passed:data.decision.passed, provider:data.provider, toolsUsed:data.toolsUsed};
  remember(task, data);
  delete task.approvalToken;
  delete task.evidence;
  if (data.gate?.advance === 'transfer') {
    task.study.phase = 'transfer';
    task.study.feedback = 'Guided answer accepted. Now solve the independent question without the worked explanation.';
    task.study.assessment = null;
  } else if (data.outcome === 'pending-approval') {
    openReview(task, data);
  }
  event(task, irisLine(data), data.decision.passed ? 'success' : 'warning');
  task.revision++;
}

export function applyIrisHuman(task, data) {
  assertDecision(data);
  remember(task, data);
  if (data.outcome === 'complete') {
    if (task.kind === 'coding' && task.profile === 'receipt-total' && typeof task.proposal?.code === 'string') task.source = task.proposal.code;
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    delete task.approvalToken;
    task.revision++;
    event(task, irisLine(data), 'success');
    return;
  }
  delete task.approvalToken;
  task.status = 'active';
  task.stage = task.proposal ? 'check' : 'prepare';
  task.revision++;
  event(task, irisLine(data), 'warning');
}

function applyReceipt(task, data) {
  const code = data.decision?.code;
  if (typeof code !== 'string' || !code.trim() || code.length > 12000) throw Error('The AI Hub candidate is missing or too large.');
  task.proposal = {
    summary:String(data.decision.summary||'Prepared a repair for independent checks.').slice(0,4000),
    nextAction:String(data.decision.nextAction||'Review the candidate and run the agreed checks.').slice(0,1000),
    code,
    hash:hash(code),
    sourceHash:hash(task.source),
    provider:data.provider,
    strategy:'Inspect task → choose a repair → IRIS gate',
    toolsUsed:data.toolsUsed,
    usage:data.usage,
  };
  task.stage = 'prepare';
  task.revision++;
  event(task, 'AI Hub inspected the task and returned a candidate. The IRIS gate has not run checks.');
}

function openReview(task, data) {
  if (!data.approvalToken || !data.workflowTaskId || !data.gate?.evidence?.type) throw Error('IRIS did not open a Workflow Engine approval.');
  task.stage = 'review';
  task.approvalToken = data.approvalToken;
  task.evidence = data.gate.evidence;
  task.escalated = false;
}

function remember(task, data) {
  task.decisionOwner = 'iris';
  task.iris = {
    sessionId:String(data.sessionId||''),
    outcome:data.outcome,
    reason:String(data.reason||''),
    workflowTaskId:String(data.workflowTaskId||''),
    role:String(data.role||''),
    distributionToken:String(data.distributionToken||''),
    model:data.model||'',
    inputTokens:Number(data.inputTokens||0),
    outputTokens:Number(data.outputTokens||0),
    latencyMs:Number(data.latencyMs||0),
  };
}

function assertDecision(data) {
  if (data?.provider !== 'InterSystems IRIS AI Hub' || typeof data?.outcome !== 'string' || !data.gate || typeof data.gate !== 'object') {
    throw Error('IRIS did not return a production decision.');
  }
}

function irisLine(data) {
  const session = data.sessionId ? ` Session ${data.sessionId}.` : '';
  const role = data.role ? ` ${data.role}.` : '';
  return `IRIS ${data.outcome}.${role} ${data.reason||''}${session}`.replace(/\s+/g,' ').trim();
}

function irisError(data) {
  const session = data.sessionId ? ` (session ${data.sessionId})` : '';
  return `IRIS gate rejected this step${session}: ${data.reason||'The production did not accept it.'}`;
}
