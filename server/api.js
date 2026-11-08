import { createTask, invalidate, localInvestigate, runChecks, approve, answerStudy, publicTask, event, hash } from './domain.js';
import { investigateWithIris } from './iris.js';
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw Error('Send application/json.');
  let bytes=0,text='';for await(const chunk of req){bytes+=chunk.length;if(bytes>64000)throw Error('Request is too large.');text+=chunk;}
  return JSON.parse(text||'{}');
}
export function api(store) {
  return async(req,res,next)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(!path.startsWith('/api/'))return next();
    try {
      if(req.method==='GET'&&path==='/api/health'){
        let irisVerified=false;
        if(process.env.IRIS_BASE_URL)try{
          const headers={};if(process.env.IRIS_USERNAME&&process.env.IRIS_PASSWORD)headers.Authorization='Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
          const response=await fetch(new URL('health',process.env.IRIS_BASE_URL.endsWith('/')?process.env.IRIS_BASE_URL:process.env.IRIS_BASE_URL+'/'),{headers,signal:AbortSignal.timeout(1800)});
          irisVerified=response.ok&&(await response.json()).provider==='InterSystems IRIS AI Hub';
        }catch{}
        return json(res,200,{ok:true,mode:process.env.IRIS_BASE_URL?'iris-configured':'local',irisVerified,capabilities:['receipt-total','linear-equations'],message:irisVerified?'IRIS AI Hub is responding.':'Local guided completion is ready; configure AI Hub for live project investigations.'});
      }
      if(req.method==='GET'&&path==='/api/tasks'){await store.queue;return json(res,200,{tasks:store.data.tasks.map(publicTask)});}
      if(req.method!=='POST')return json(res,404,{error:'Route not found.'});
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)return json(res,403,{error:'Cross-origin changes are not allowed.'});
      const input=await body(req);
      const result=await store.mutate(async data=>{
        if(path==='/api/tasks'){
          if(data.tasks.length>=50)throw Error('This local workspace supports up to 50 tasks.');
          const task=createTask(input);data.tasks.unshift(task);return {task:publicTask(task)};
        }
        const match=path.match(/^\/api\/tasks\/([a-f0-9-]+)\/(update|investigate|candidate|check|approve|answer|pause|reopen)$/);
        if(!match)throw Error('Route not found.');
        const task=data.tasks.find(t=>t.id===match[1]);if(!task)throw Error('Task not found.');
        if(input.revision!==task.revision)throw Error('This task changed. Reload it before continuing.');
        const action=match[2];
        if(task.status==='completed'&&action!=='reopen')throw Error('Reopen this task before changing it.');
        if(action==='update'){
          for(const key of ['blocker','tried','source']) if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>12000))throw Error('Fields must be text up to 12,000 characters.');
          const changed=['blocker','tried','source'].some(key=>input[key]!==undefined&&input[key]!==task[key]);
          if(changed){invalidate(task);for(const key of ['blocker','tried','source'])if(input[key]!==undefined)task[key]=input[key];event(task,'Saved your context. Previous checks were cleared.');}
        } else if(action==='investigate'){
          for(const key of ['blocker','tried','source']) if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>12000))throw Error('Fields must be text up to 12,000 characters.');
          const changed=['blocker','tried','source'].some(key=>input[key]!==undefined&&input[key]!==task[key]);
          if(changed)for(const key of ['blocker','tried','source'])if(input[key]!==undefined)task[key]=input[key];
          if(!task.blocker.trim())throw Error('Describe the blocker first.');
          invalidate(task);
          if(input.engine==='iris')await investigateWithIris(task);else localInvestigate(task);
        } else if(action==='candidate'){
          if(task.kind!=='coding'||!task.proposal)throw Error('Investigate first.');
          if(typeof input.code!=='string'||input.code.length>12000)throw Error('Candidate must be text up to 12,000 characters.');
          task.proposal.code=input.code;task.proposal.hash=hash(input.code);task.stage='prepare';delete task.checks;delete task.evidence;delete task.approvalToken;task.revision++;event(task,'Candidate edited. Run checks again.');
        } else if(action==='check'){
          if(task.kind!=='coding'||!task.proposal)throw Error('Investigate the coding task before checking it.');
          if(input.code!==undefined){if(typeof input.code!=='string'||input.code.length>12000)throw Error('Candidate must be text up to 12,000 characters.');task.proposal.code=input.code;task.proposal.hash=hash(input.code);}
          runChecks(task);
        }
        else if(action==='approve')approve(task,input.token);
        else if(action==='answer')answerStudy(task,input.answer);
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
