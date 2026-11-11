import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {TOTAL_CHECKS} from './checker.js';
export async function checkWithIris(source){
 if(typeof source!=='string'||source.length>12000)throw Error('Source must be at most 12,000 characters.');
 const astJSON=JSON.stringify(parse(source,{ecmaVersion:2022,sourceType:'module'}));
 const encoded=JSON.stringify({astJSON});if(Buffer.byteLength(encoded)>195000)throw Error('This candidate AST is too large for independent checks.');
 const base=process.env.IRIS_BASE_URL;if(!base)throw Error('The native checker needs an IRIS connection.');
 const headers={'Content-Type':'application/json'};
 if(process.env.IRIS_USERNAME&&process.env.IRIS_PASSWORD)headers.Authorization='Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64');
 const r=await fetch(new URL('check',base.endsWith('/')?base:base+'/'),{method:'POST',headers,body:encoded,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`Native checker returned HTTP ${r.status}. No passing evidence was recorded.`);
 const result=await r.json();
 if(result.provider!=='InterSystems Embedded Python'||result.astHash!==createHash('sha256').update(astJSON).digest('hex')||!Array.isArray(result.checks)||result.checks.length!==TOTAL_CHECKS.length||result.checks.some((c,i)=>c.name!==TOTAL_CHECKS[i].name||typeof c.passed!=='boolean'))throw Error('The native checker returned mismatched evidence.');
 return result;
}
export async function importedIssues(){
 if(process.env.HOSTED_DEMO==='true')throw Error('Shared native issue imports are available only in the private local workspace.');
 const base=process.env.IRIS_BASE_URL;if(!base)throw Error('Connect the native IRIS adapter first.');
 const headers={Authorization:'Basic '+Buffer.from(`${process.env.IRIS_USERNAME}:${process.env.IRIS_PASSWORD}`).toString('base64')};
 const r=await fetch(new URL('imports',base.endsWith('/')?base:base+'/'),{headers,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Could not read native issue imports.');
 const data=await r.json();if(!Array.isArray(data)||data.length>50)throw Error('Invalid issue import response.');return data;
}
