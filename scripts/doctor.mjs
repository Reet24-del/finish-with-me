import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
let missing=0;
function report(ok,label,help){console.log(`${ok?'READY':'NEEDED'}: ${label}${ok?'':` — ${help}`}`);if(!ok)missing++;}
const docker=spawnSync('docker',['--version'],{encoding:'utf8'});
report(docker.status===0,'Docker CLI','Install Docker Desktop for Apple Silicon and launch it.');
if(docker.status===0){
 const engine=spawnSync('docker',['info','--format','{{.ServerVersion}}'],{encoding:'utf8',timeout:10000});
 report(engine.status===0,'Docker engine','Open Docker Desktop and wait for it to start.');
 if(engine.status===0){const image=spawnSync('docker',['image','inspect',process.env.IRIS_IMAGE||'iris-community:2027.1.0AI.109.0'],{stdio:'ignore',timeout:10000});report(image.status===0,'AI Hub image','Download the EAP Community image, load it, and retag it as documented in README.');}
}
report(Boolean(process.env.OPENAI_API_KEY?.trim()),'OpenAI API key','Set OPENAI_API_KEY in the ignored .env file.');
report(Boolean(process.env.IRIS_PASSWORD&& !['SYS','ChangeThisPassword'].includes(process.env.IRIS_PASSWORD)),'IRIS password','Choose your private IRIS password in .env.');
const remote=spawnSync('git',['remote','get-url','origin'],{cwd:root,encoding:'utf8'});
report(remote.status===0,'Git remote','Create the project repository under Reet24-del and provide its URL.');
console.log('This checks prerequisites only. A real AI Hub investigation must still be run before submission.');
process.exitCode=missing?1:0;
