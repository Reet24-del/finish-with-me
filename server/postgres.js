import pg from 'pg';
import {createHash} from 'node:crypto';
import {seedTasks} from './domain.js';
const workspaceId=key=>createHash('sha256').update(key).digest('hex');
export class PostgresWorkspaces {
  constructor(connectionString){
    this.pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,query_timeout:100000});
    this.ready=this.initialize();
  }
  async initialize(){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(768143902)');
      await client.query(`CREATE TABLE IF NOT EXISTS finish_workspaces (
        id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async exists(key){await this.ready;const result=await this.pool.query('SELECT 1 FROM finish_workspaces WHERE id=$1',[workspaceId(key)]);return result.rowCount===1;}
  async load(key){
    await this.ready;const id=workspaceId(key);
    await this.pool.query('INSERT INTO finish_workspaces(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[id,JSON.stringify({version:1,tasks:seedTasks()})]);
    return new PostgresStore(this.pool,id).init();
  }
}
class PostgresStore {
  constructor(pool,id){this.pool=pool;this.id=id;this.queue=Promise.resolve();}
  async init(){await this.refresh();return this;}
  async refresh(){await this.queue;const result=await this.pool.query('SELECT data FROM finish_workspaces WHERE id=$1',[this.id]);if(!result.rows[0])throw Error('Workspace could not be loaded.');this.data=result.rows[0].data;}
  mutate(fn){
    const next=this.queue.then(async()=>{
      const client=await this.pool.connect();
      try{
        await client.query('BEGIN');
        const result=await client.query('SELECT data FROM finish_workspaces WHERE id=$1 FOR UPDATE',[this.id]);
        const data=result.rows[0]?.data;if(!data)throw Error('Workspace could not be loaded.');
        const value=await fn(data);
        await client.query('UPDATE finish_workspaces SET data=$2,updated_at=now() WHERE id=$1',[this.id,JSON.stringify(data)]);
        await client.query('COMMIT');this.data=data;return value;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    });this.queue=next.catch(()=>{});return next;
  }
}
