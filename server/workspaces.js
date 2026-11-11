import {randomBytes} from 'node:crypto';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {Store} from './store.js';

const validKey=key=>typeof key==='string'&&/^[a-f0-9]{48}$/.test(key);
export class Workspaces {
  constructor(directory,{secure=false,maxCached=200,backend=null}={}){
    this.directory=directory;this.backend=backend;this.secure=secure;this.maxCached=maxCached;this.cache=new Map();
  }
  cookie(req){return req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('finish_demo='))?.slice(12);}
  setCookie(res,key){res.setHeader('Set-Cookie',`finish_demo=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${this.secure?'; Secure':''}`);}
  async exists(key){
    if(!validKey(key))return false;
    if(this.backend)return this.backend.exists(key);
    try{await access(join(this.directory,key,'workspace.json'));return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}
  }
  load(key){
    // Keep one Store/queue per workspace. Removing one during an AI mutation could
    // allow a second instance to overwrite it with stale data.
    if(this.cache.has(key))return this.cache.get(key);
    if(this.cache.size>=this.maxCached)throw Error('Workspace capacity reached. Please try again later.');
    const ready=this.backend?this.backend.load(key):new Store(join(this.directory,key)).init();this.cache.set(key,ready);
    ready.catch(()=>this.cache.delete(key));return ready;
  }
  async get(req,res){
    let key=this.cookie(req);
    if(!validKey(key)||(!this.cache.has(key)&&!await this.exists(key)))key=randomBytes(24).toString('hex');
    const store=await this.load(key);this.setCookie(res,key);return {key,store};
  }
  async restore(key,res){
    if(!await this.exists(key))throw Error('That recovery key does not match a saved workspace.');
    const store=await this.load(key);this.setCookie(res,key);return {key,store};
  }
}
