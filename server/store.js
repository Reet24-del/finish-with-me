import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedTasks } from './domain.js';
export class Store {
  constructor(directory) {this.directory=directory;this.file=join(directory,'workspace.json');this.queue=Promise.resolve();}
  async init() {
    await mkdir(this.directory,{recursive:true});
    try { this.data=JSON.parse(await readFile(this.file,'utf8')); }
    catch(error) {if(error.code!=='ENOENT') throw error;this.data={version:1,tasks:seedTasks()};await this.save();}
    return this;
  }
  async save() { const file=join(this.directory,`${randomUUID()}.tmp`);await writeFile(file,JSON.stringify(this.data,null,2),{mode:0o600});await rename(file,this.file); }
  mutate(fn) {
    const next=this.queue.then(async()=>{const before=structuredClone(this.data);try{const value=await fn(this.data);await this.save();return value;}catch(error){this.data=before;throw error;}});
    this.queue=next.catch(()=>{});return next;
  }
}
