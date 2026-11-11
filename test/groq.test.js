import test from 'node:test';
import assert from 'node:assert/strict';
import {groqDecision} from '../server/groq.js';

test('hosted Groq uses a bounded tool, keeps the key server-side and labels the provider honestly',async()=>{
 const before={backend:process.env.AI_BACKEND,key:process.env.GROQ_API_KEY};
 process.env.AI_BACKEND='groq';process.env.GROQ_API_KEY='synthetic-test-key';
 try{
  const result=await groqDecision({profile:'project',source:'sample.py',blocker:'Fix slicing'},{fetcher:async(url,opts)=>{
   assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
   const body=JSON.parse(opts.body);assert.equal(body.tool_choice.function.name,'PrepareProject');assert.equal(body.tools.length,1);
   assert(!opts.body.includes('synthetic-test-key'));assert.equal(opts.headers.Authorization,'Bearer synthetic-test-key');
   return {ok:true,json:async()=>({choices:[{message:{tool_calls:[{function:{name:'PrepareProject',arguments:JSON.stringify({summary:'Fix',nextAction:'Review',artifact:'sample.py\npass',verification:'Run project checks'})}}]}}]})};
  }});
  assert.equal(result.provider,'Groq (hosted)');assert.deepEqual(result.toolsUsed,['PrepareProject']);
  await assert.rejects(groqDecision({kind:'study-review',rubric:'stored rubric'},{fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{tool_calls:[{function:{name:'AssessAnswer',arguments:'{"passed":"true","feedback":"yes"}'}}]}}]})})}),/incomplete work/);
  await assert.rejects(groqDecision({profile:'project'},{fetcher:async()=>({ok:false,status:429})}),/allowance/);
 }finally{for(const [k,v] of [['AI_BACKEND',before.backend],['GROQ_API_KEY',before.key]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
