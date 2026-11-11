import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PostgresWorkspaces} from '../server/postgres.js';

test('Postgres persists across clients, rolls back failed writes and serializes concurrent clients', {skip:!process.env.TEST_DATABASE_URL}, async()=>{
 const key=randomBytes(24).toString('hex');
 const a=new PostgresWorkspaces(process.env.TEST_DATABASE_URL),b=new PostgresWorkspaces(process.env.TEST_DATABASE_URL);
 try{
  const first=await a.load(key);await first.mutate(d=>{d.tasks[0].title='Durable project';d.counter=0;});
  const independent=await b.load(key);assert.equal(independent.data.tasks[0].title,'Durable project');
  await Promise.all([first.mutate(async d=>{await new Promise(r=>setTimeout(r,40));d.counter++;}),independent.mutate(d=>{d.counter++;})]);
  await first.refresh();assert.equal(first.data.counter,2);
  await assert.rejects(first.mutate(d=>{d.counter=999;throw Error('rejected');}),/rejected/);
  await independent.refresh();assert.equal(independent.data.counter,2);
  await a.pool.end();
  const restarted=await b.load(key);assert.equal(restarted.data.tasks[0].title,'Durable project');assert(await b.exists(key));
 }finally{
  if(!a.pool.ended)await a.pool.end();await b.pool.end();
 }
});
