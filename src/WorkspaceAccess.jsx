import React,{useState} from 'react';
export default function WorkspaceAccess({health,onRestore}){
 const [key,setKey]=useState(''),[input,setInput]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const request=async(body)=>{setBusy(true);setMessage('');try{
  const res=await fetch('/api/workspace/recovery',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await res.json();if(!res.ok)throw Error(data.error);
  if(body){setKey('');setInput('');await onRestore();setMessage('Your saved workspace is open.');}else setKey(data.recoveryKey);
 }catch(e){setMessage(e.message);}finally{setBusy(false);}};
 if(!health.hostedDemo)return null;
 return <details className="workspace-access"><summary>Keep access to your work <span>↗</span></summary><div className="workspace-access-content"><p>{health.storage==='postgres'?'Tasks are saved in the database across service restarts.':'This deployment still uses temporary storage. A recovery key cannot restore tasks after the server’s files are erased.'} Save your private recovery key to reopen this workspace in another browser. Anyone with the key can access and change your tasks.</p><button className="button secondary small" disabled={busy} onClick={()=>request()}>Show my recovery key</button>{key&&<label>Private recovery key<input readOnly value={key} onFocus={e=>e.target.select()}/></label>}<form onSubmit={e=>{e.preventDefault();request({recoveryKey:input.trim()});}}><label htmlFor="recover-workspace">Open a saved workspace</label><div><input id="recover-workspace" autoComplete="off" spellCheck={false} type="password" value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste your private recovery key"/><button className="button primary small" disabled={busy||!input.trim()}>Open workspace</button></div></form>{message&&<p role="status">{message}</p>}</div></details>;
}
