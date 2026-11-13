import {checkWithIris as checkReceiptAst,importedIssues} from './native-checker.js';
import { groqConfigured } from './groq.js';
import { createTask, invalidate, localInvestigate, runChecks, approve, answerStudy, publicTask, event, hash } from './domain.js';
import { isGeneral, recordProjectEvidence, applyRouting, applyWork } from './general.js';
import { investigateWithIris, assessStudyWithIris, checkWithIris, verifyWithIris, approveWithIris } from './iris.js';
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw Error('Send application/json.');
  let bytes=0,text='';for await(const chunk of req){bytes+=chunk.length;if(bytes>160000)throw Error('Request is too large.');text+=chunk;}
  return JSON.parse(text||'{}');
}
export function api(store,{database=null}={}) {
  return async(req,res,next)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(!path.startsWith('/api/'))return next();
    try {
      if(req.method==='GET'&&path==='/api/health'){
        let irisVerified=false,storageVerified=!process.env.DATABASE_URL;
        if(database)try{await database.pool.query({text:'SELECT 1',query_timeout:2500});storageVerified=true;}catch{}
        if(process.env.AI_BACKEND!=='groq'&&process.env.IRIS_BASE_URL)try{
          const headers={};if(process.env.IRIS_USERNAME&&process.env.IRIS_PASSWORD)headers.Authorization='Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
          const response=await fetch(new URL('health',process.env.IRIS_BASE_URL.endsWith('/')?process.env.IRIS_BASE_URL:process.env.IRIS_BASE_URL+'/'),{headers,signal:AbortSignal.timeout(1800)});
          irisVerified=response.ok&&(await response.json()).provider==='InterSystems IRIS AI Hub';
        }catch{}
        return json(res,storageVerified?200:503,{ok:storageVerified,storageVerified,mode:process.env.AI_BACKEND==='groq'?'groq-configured':process.env.IRIS_BASE_URL?'iris-configured':'local',aiReady:irisVerified||groqConfigured(),aiProvider:groqConfigured()?'Groq (hosted)':irisVerified?'InterSystems IRIS AI Hub':null,irisVerified,hostedDemo:process.env.HOSTED_DEMO==='true',storage:process.env.DATABASE_URL?'postgres':process.env.RENDER?'ephemeral':'local-disk',capabilities:['project','subject','integration','receipt-total','linear-equations'],message:groqConfigured()?'Hosted Groq is configured; the IRIS production is a separate local mode.':irisVerified?'IRIS production Finish.Production is responding. Completion is decided there.':'Local guided completion is ready; configure AI Hub for live decisions.'});
      }
      if(req.method==='GET'&&path==='/api/tasks'){await store.queue;if(store.refresh)await store.refresh();return json(res,200,{tasks:store.data.tasks.map(publicTask)});}
      if(req.method!=='POST')return json(res,404,{error:'Route not found.'});
      if(req.headers.origin && req.headers.origin!==(process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://${req.headers.host}`))return json(res,403,{error:'Cross-origin changes are not allowed.'});
      const input=await body(req);
      const imports=path==='/api/import-github'?await importedIssues():null;
      const result=await store.mutate(async data=>{
        if(imports){
          let count=0;
          for(const issue of imports){
            const key=`${issue.repository}#${issue.number}`;
            if(data.tasks.some(t=>t.githubIssue?.key===key))continue;
            if(data.tasks.length>=50)break;
            const task=createTask({kind:'coding',title:String(issue.title).slice(0,120),blocker:String(issue.body||'Review this imported issue').slice(0,12000),source:`GitHub issue ${issue.url}\n${String(issue.body||'').slice(0,16000)}`});
            task.githubIssue={key,url:issue.url};
            if(issue.agentResult){try{if(!applyRouting(task,issue.agentResult)&&issue.agentResult.outcome==='needs-evidence'&&issue.agentResult.decision)applyWork(task,issue.agentResult);}catch{/* keep the imported issue open for a fresh investigation */}}
            data.tasks.unshift(task);count++;
          }
          return {imported:count};
        }
        if(path==='/api/tasks'){
          if(data.tasks.length>=50)throw Error('This local workspace supports up to 50 tasks.');
          const task=createTask(input);data.tasks.unshift(task);return {task:publicTask(task)};
        }
        const match=path.match(/^\/api\/tasks\/([a-f0-9-]+)\/(update|investigate|candidate|check|approve|answer|verify|pause|reopen)$/);
        if(!match)throw Error('Route not found.');
        const task=data.tasks.find(t=>t.id===match[1]);if(!task)throw Error('Task not found.');
        if(input.revision!==task.revision)throw Error('This task changed. Reload it before continuing.');
        const action=match[2];
        if(task.status==='completed'&&action!=='reopen')throw Error('Reopen this task before changing it.');
        if(process.env.AI_BACKEND==='groq'&&(action==='answer'||action==='investigate'&&input.engine!=='local')){
          const hour=Math.floor(Date.now()/3600000);if(data.aiUsage?.hour!==hour)data.aiUsage={hour,count:0};
          if(data.aiUsage.count>=30)throw Error('This workspace has reached its hourly AI allowance. Try again later.');
          data.aiUsage.count++;
        }
        if(action==='update'){
          for(const key of ['blocker','tried','source','material','criteria','subject','description']) if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>32000))throw Error('Fields must be text up to 32,000 characters.');
          const changed=['blocker','tried','source','material','criteria','subject','description'].some(key=>input[key]!==undefined&&input[key]!==task[key]);
          if(changed){invalidate(task);for(const key of ['blocker','tried','source','material','criteria','subject','description'])if(input[key]!==undefined)task[key]=input[key];event(task,'Saved your context. Previous checks were cleared.');}
        } else if(action==='investigate'){
          for(const key of ['blocker','tried','source','material','criteria','subject','description']) if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>32000))throw Error('Fields must be text up to 32,000 characters.');
          const changed=['blocker','tried','source','material','criteria','subject','description'].some(key=>input[key]!==undefined&&input[key]!==task[key]);
          if(changed)for(const key of ['blocker','tried','source','material','criteria','subject','description'])if(input[key]!==undefined)task[key]=input[key];
          if(!task.blocker.trim())throw Error('Describe the blocker first.');
          invalidate(task);
          if(['iris','groq','ai'].includes(input.engine))await investigateWithIris(task);else localInvestigate(task);
        } else if(action==='candidate'){
          if(task.kind!=='coding'||!task.proposal)throw Error('Investigate first.');
          if(typeof input.code!=='string'||input.code.length>12000)throw Error('Candidate must be text up to 32,000 characters.');
          task.proposal.code=input.code;task.proposal.hash=hash(input.code);task.stage='prepare';delete task.checks;delete task.evidence;delete task.approvalToken;task.revision++;event(task,'Candidate edited. Run checks again.');
        } else if(action==='check'){
          if(task.decisionOwner==='iris')await checkWithIris(task,input.code);
          else {
            if(task.kind!=='coding'||!task.proposal)throw Error('Investigate the coding task before checking it.');
            if(input.code!==undefined){if(typeof input.code!=='string'||input.code.length>12000)throw Error('Candidate must be text up to 12,000 characters.');task.proposal.code=input.code;task.proposal.hash=hash(input.code);}
            const native=process.env.IRIS_BASE_URL&&process.env.AI_BACKEND!=='groq'?await checkReceiptAst(task.proposal.code):null;
            runChecks(task,native);
          }
        }
        else if(action==='approve'){if(task.decisionOwner==='iris')await approveWithIris(task,input);else approve(task,input.token);}
        else if(action==='answer'){if(isGeneral(task))await assessStudyWithIris(task,input.answer);else answerStudy(task,input.answer);}
        else if(action==='verify'){if(task.decisionOwner==='iris'||process.env.IRIS_BASE_URL)await verifyWithIris(task,input);else recordProjectEvidence(task,input);}
        else if(action==='pause'){
          if(typeof input.breadcrumb!=='string'||!input.breadcrumb.trim()||input.breadcrumb.length>2000)throw Error('Leave a short next step before pausing.');
          task.breadcrumb=input.breadcrumb.trim();task.paused=true;task.revision++;event(task,'Saved your return point.');
        } else if(action==='reopen'){
          invalidate(task);task.paused=false;delete task.completedAt;event(task,'Reopened. Completion needs fresh evidence.');
        }
        return {task:publicTask(task)};
      });
      return json(res,200,result);
    }catch(error){return json(res,400,{error:error instanceof SyntaxError?'Invalid JSON.':error.message});}
  };
}
