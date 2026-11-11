import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Workspaces} from '../server/workspaces.js';
const request=key=>({headers:key?{cookie:`finish_demo=${key}`}:{}});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;}});
test('workspace ownership and saved changes survive process restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'finish-restart-'));
 try{
  const first=new Workspaces(directory,{secure:true});const res=response();
  const {key,store}=await first.get(request(),res);
  await store.mutate(data=>{data.tasks[0].title='Saved before restart';});
  assert.match(res.headers['Set-Cookie'],/HttpOnly.*Max-Age=31536000; Secure/);
  const restarted=new Workspaces(directory);
  const recovered=await restarted.get(request(key),response());
  assert.equal(recovered.key,key);assert.equal(recovered.store.data.tasks[0].title,'Saved before restart');
  const other=await restarted.get(request(),response());assert.notEqual(other.key,key);
  const restored=await restarted.restore(key,response());assert.equal(restored.store,recovered.store);
  await assert.rejects(restarted.restore('../workspace',response()),/recovery key/);
  await assert.rejects(restarted.restore('0'.repeat(48),response()),/recovery key/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('unknown cookies cannot choose a workspace and corrupt files are not overwritten',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'finish-restart-'));
 try{
  const manager=new Workspaces(directory);const unknown='0'.repeat(48);
  const {key,store}=await manager.get(request(unknown),response());assert.notEqual(key,unknown);
  await writeFile(store.file,'corrupt');
  await assert.rejects(new Workspaces(directory).get(request(key),response()),SyntaxError);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('concurrent mutations use the same workspace queue',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'finish-restart-'));
 try{
  const manager=new Workspaces(directory);const {key}=await manager.get(request(),response());
  const [a,b]=await Promise.all([manager.get(request(key),response()),manager.get(request(key),response())]);
  assert.equal(a.store,b.store);
  await Promise.all([a.store.mutate(d=>{d.counter=(d.counter||0)+1}),b.store.mutate(d=>{d.counter=(d.counter||0)+1})]);
  assert.equal((await new Workspaces(directory).get(request(key),response())).store.data.counter,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
