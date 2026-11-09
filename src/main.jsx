import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Code2, Compass, Flame, Leaf, LoaderCircle, Pause, Plus, RotateCcw, Sparkles, Terminal, X } from 'lucide-react';
import './style.css';
import GeneralWorkspace from './GeneralWorkspace.jsx';
import {useRoute} from './navigation.js';
import LandingPage from './pages/LandingPage.jsx';
import FeaturesPage from './pages/FeaturesPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import NewTaskPage from './pages/NewTaskPage.jsx';
import GuidePage from './pages/GuidePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const call = async (url, body) => {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type':'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Something went wrong.'); return data;
};
const steps = ['understand','prepare','check','review'];
function App(){
  const {route,navigate,link}=useRoute();
  const [loaded,setLoaded]=useState(false);
  const selected=route.pathname.match(/^\/workspace\/([a-f0-9-]+)$/)?.[1]||null;
  const setSelected=id=>navigate(id?`/workspace/${id}`:'/workspace');
  const setModal=open=>navigate(open?'/new':'/workspace');
  const [showCompleted,setShowCompleted]=useState(false),[busyAction,setBusyAction]=useState(null);
  const [tasks,setTasks]=useState([]),[health,setHealth]=useState({mode:'checking'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[form,setForm]=useState({kind:'coding',title:'',description:''}),[answer,setAnswer]=useState(''),[breadcrumb,setBreadcrumb]=useState('');
  const startTask=kind=>{setForm({kind,title:'',description:''});navigate('/new?kind='+kind);};
  const active=tasks.find(t=>t.id===selected)||null;
  async function refresh(keep=true){const [r,h]=await Promise.all([call('/api/tasks'),call('/api/health')]);setTasks(r.tasks);setHealth(h);setLoaded(true);}
  useEffect(()=>{refresh(false).catch(e=>{setError(e.message);setLoaded(true);});},[]);
  useEffect(()=>{if(route.pathname==='/new'){const kind=new URLSearchParams(route.search).get('kind');if(['coding','study'].includes(kind))setForm(f=>({...f,kind}));}setError('');setNotice('');setAnswer('');setBreadcrumb('');const names={'/':'Finish With Me — one task, a real result','/features':'The approach — Finish With Me','/workspace':'Your workspace — Finish With Me','/new':'Start a task — Finish With Me','/guide':'Getting started — Finish With Me'};document.title=names[route.pathname]||(selected?'Your task — Finish With Me':'Page not found — Finish With Me');},[route.pathname,route.search]);
  const done=tasks.filter(t=>t.status==='completed').length;
  const save=async(path,payload={})=>{if(!active)return;setBusyAction(path);setBusy(true);setError('');setNotice('');try{const r=await call(`/api/tasks/${active.id}/${path}`,{...payload,revision:active.revision});setTasks(old=>old.map(t=>t.id===r.task.id?r.task:t));if(path==='approve')setNotice('That piece is finished. The proof is saved here.');if(path==='update')setNotice('Context saved. You can return to it later.');}catch(e){setError(e.message);await refresh();}finally{setBusy(false);setBusyAction(null);}};
  const create=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await call('/api/tasks',form);setTasks(old=>[r.task,...old]);setSelected(r.task.id);setForm({kind:'coding',title:'',description:''});}catch(e){setError(e.message);}finally{setBusy(false);}};
  const update=async patch=>{if(!active)return;setBusy(true);try{const r=await call(`/api/tasks/${active.id}/update`,{...patch,revision:active.revision});setTasks(old=>old.map(t=>t.id===r.task.id?r.task:t));}catch(e){setError(e.message);await refresh();}finally{setBusy(false);}};
  const editContext=(key,value)=>setTasks(ts=>ts.map(t=>{if(t.id!==active.id)return t;const next={...t,[key]:value,stage:'understand'};for(const field of ['proposal','checks','baseline','study','evidence','approvalToken'])delete next[field];return next;}));
  const cards=useMemo(()=>tasks.filter(t=>showCompleted?t.status==='completed':t.status!=='completed'),[tasks,showCompleted]);
  const badge=(kind)=><span className={`kind ${kind}`}>{kind==='coding'?<Code2 size={13}/>:<BookOpen size={13}/>} {kind==='coding'?'PROJECT':'STUDY'}</span>;
  return <div className="app">
    <header className="topbar">
      <button className="brand" aria-label="Finish With Me home" onClick={()=>navigate('/')}><span className="brand-mark" aria-hidden="true">f<span>↗</span></span><span className="wordmark">finish<span>with me.</span></span></button>
      <nav className="topnav" aria-label="Main navigation"><a aria-current={route.pathname==='/features'?'page':undefined} href="/features" onClick={link('/features')}><sup>01</sup> The idea <ArrowRight size={16}/></a><a aria-current={route.pathname.startsWith('/workspace')?'page':undefined} href="/workspace" onClick={link('/workspace')}><sup>02</sup> Your workspace <ArrowRight size={16}/></a><a aria-current={route.pathname==='/guide'?'page':undefined} href="/guide" onClick={link('/guide')}><sup>03</sup> Start here</a></nav>
      <div className="top-right"><span className={`system ${health.irisVerified?'live':''}`}><i/>{health.irisVerified?'IRIS connected':'Local mode'}</span><button className="header-start" onClick={()=>setModal(true)}>Start something <Plus size={19}/></button></div>
    </header>
    <main className={['/','/features'].includes(route.pathname)?'shell landing-shell':'shell'}>
      {health.hostedDemo&&<div className="notice">Hosted demo · your workspace is separate from other visitors. Tasks reset when this free service restarts. {health.irisVerified?'Live IRIS AI Hub is connected.':'Coding and study use the local guided demo; watch the video for the live IRIS run.'}</div>}
      {active? <>
        <button className="back" onClick={()=>{setSelected(null);setError('');setNotice('')}}><ArrowLeft size={15}/> All tasks</button>
        <div className="detail-head"><div>{badge(active.kind)}<h1>{active.title}</h1><p className="sub">{active.description||'A small piece of work, carried through to a checkable result.'}</p></div><div className="detail-actions">{active.status==='completed'?<span className="complete-pill"><CheckCircle2 size={15}/> Completed</span>:<button className="quiet" onClick={()=>setModal(true)}><Plus size={15}/> New task</button>}</div></div>
        <div className="stepper">{steps.map((s,i)=><div key={s} className={`step ${active.stage===s?'current':''} ${steps.indexOf(active.stage)>i||active.status==='completed'?'passed':''}`}><span>{steps.indexOf(active.stage)>i||active.status==='completed'?<Check size={13}/>:`0${i+1}`}</span>{['Understand','Make a move','Check it','Finish'][i]}</div>)}</div>
        {error&&<div className="alert"><CircleHelp size={16}/>{error}<button onClick={()=>setError('')}><X size={14}/></button></div>}{notice&&<div className="notice"><CheckCircle2 size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
        {['project','subject'].includes(active.profile)?<GeneralWorkspace task={active} save={save} busy={busy} busyAction={busyAction} health={health}/>:<><section className="work-card">
          {active.status==='completed'? <div className="finished"><div className="finish-icon"><CheckCircle2 size={25}/></div><div><div className="eyebrow">A real result, with proof</div><h2>Closed the loop.</h2><p>{active.kind==='coding'?'The checked version was saved as your current function.':'You solved a fresh problem independently.'} This task is done.</p><div className="evidence">{active.evidence?.count?`${active.evidence.count} checks passed · `:'Transfer answer checked · '} {new Date(active.completedAt).toLocaleString()}</div></div></div>:
          <>
            <div className="work-title"><div><span className="eyebrow">YOUR NEXT MOVE</span><h2>{active.stage==='understand'?'Let’s see where it catches.':active.stage==='prepare'?'A concrete move is ready.':active.stage==='check'?'Keep working the failing check.':'You have evidence. Make it yours.'}</h2></div><span className="step-tag">{active.stage==='understand'?'START HERE':active.stage.toUpperCase()}</span></div>
            <label className="field-label">What are you stuck on?</label><textarea value={active.blocker||''} onChange={e=>editContext('blocker',e.target.value)} placeholder="Describe the exact point where you got stuck…" rows="2"/>
            <label className="field-label spaced">What have you tried?</label><textarea value={active.tried||''} onChange={e=>editContext('tried',e.target.value)} placeholder="Even ‘I reread the instructions’ is useful context…" rows="2"/>
            {active.kind==='coding'&&<><label className="field-label spaced">The code in front of you</label><textarea className="code-input" spellCheck="false" value={active.source||''} onChange={e=>editContext('source',e.target.value)} rows="7"/></>}
            {active.proposal&&<div className="proposal"><div className="proposal-head"><span className="ai-icon"><Sparkles size={15}/></span><div><strong>{active.proposal.provider||'Completion plan'}</strong><small>{active.proposal.strategy}</small></div>{active.proposal.toolsUsed&&<span className="tool-proof">TOOL USED</span>}</div><p>{active.proposal.summary}</p><div className="next-action"><ArrowRight size={15}/><span>{active.proposal.nextAction}</span></div></div>}
            {active.kind==='coding'&&active.proposal&&<><label className="field-label spaced">Candidate — edit it if you want</label><textarea className="code-input candidate" spellCheck="false" value={active.proposal.code||''} onChange={e=>setTasks(ts=>ts.map(t=>{if(t.id!==active.id)return t;const next={...t,proposal:{...t.proposal,code:e.target.value},stage:'prepare'};delete next.checks;delete next.evidence;delete next.approvalToken;return next;}))} rows="9"/>
              {active.checks&&<div className="checks">{active.checks.map((c,i)=><div className={`check-row ${c.passed?'ok':'bad'}`} key={i}><span>{c.passed?<CheckCircle2 size={16}/>:<X size={16}/>}</span><div><b>{c.name}</b><small>Expected {c.expected} · got {c.actual}</small></div><span>{c.passed?'PASS':'FIX'}</span></div>)}</div>}
            </>}
            {active.kind==='study'&&active.study&&active.status!=='completed'&&active.stage!=='review'&&<div className="exercise"><span className="eyebrow">GUIDED PRACTICE · ATTEMPT {active.study.attempts.length+1}</span><p>{active.study.instruction}</p><div className="answer-row"><input value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save('answer',{answer})} placeholder={active.study.prompt}/><button className="button primary" disabled={busy||!answer.trim()} onClick={async()=>{await save('answer',{answer});setAnswer('')}}>Check step <ArrowRight size={15}/></button></div>{active.study.feedback&&<p className={`feedback ${active.study.feedback==='That step is correct.'?'good':''}`}>{active.study.feedback}</p>}</div>}
            {active.study?.feedback&&active.stage==='review'&&<div className="transfer"><CheckCircle2 size={18}/><div><b>Independent transfer passed</b><small>New question: {active.evidence?.question} · Answer satisfies the equation</small></div></div>}
            <div className="work-footer"><div className="footer-hint"><Flame size={15}/>{active.stage==='review'?'Your approval closes this piece of work.':active.kind==='study'?'Try one step. You can revise your answer.':'One bounded repair, then independent checks.'}</div><div className="footer-buttons">{active.stage==='understand'&&<button className="button secondary" disabled={busy} onClick={()=>save('update',{blocker:active.blocker,tried:active.tried,source:active.source})}>Save context</button>}
              {active.stage==='understand'&&<button className="button primary" disabled={busy||!active.blocker?.trim()} onClick={()=>save('investigate',{engine:active.kind==='coding'&&health.mode==='iris-configured'?'iris':'local',blocker:active.blocker,tried:active.tried,source:active.source})}>{busy?<LoaderCircle className="spin" size={16}/>:<Sparkles size={16}/>} {active.kind==='coding'&&health.mode==='iris-configured'?'Ask AI Hub to work on it':'Work through this with me'}</button>}
              {active.kind==='coding'&&active.stage==='check'&&<button className="button primary" disabled={busy} onClick={()=>save('investigate',{engine:health.mode==='iris-configured'?'iris':'local',blocker:active.blocker,tried:active.tried,source:active.source})}>Revise using failed checks</button>}{active.kind==='coding'&&active.proposal&&active.stage!=='review'&&<button className="button secondary" disabled={busy} onClick={()=>save('check',{code:active.proposal.code})}>{busy?<LoaderCircle className="spin" size={16}/>:<Terminal size={16}/>} Run {active.stage==='check'?'checks again':'independent checks'}</button>}
              {active.stage==='review'&&<button className="button primary" disabled={busy} onClick={()=>save('approve',{token:active.approvalToken})}><Check size={16}/> Mark this piece done</button>}
              {active.status==='active'&&<button className="button text" onClick={()=>setModal(true)}><Plus size={15}/> Add another</button>}
            </div></div>
            {active.status==='active'&&<details className="pause-box"><summary><Pause size={14}/> Need to leave? Save a return point</summary><div className="pause-content"><input value={breadcrumb||active.breadcrumb||''} onChange={e=>setBreadcrumb(e.target.value)} placeholder="Write the one thing you’ll do first when you return"/><button className="button secondary small" disabled={!breadcrumb.trim()} onClick={()=>save('pause',{breadcrumb})}>Save return point</button></div>{active.breadcrumb&&<p className="saved-return">Last return point: {active.breadcrumb}</p>}</details>}
          </>}
        </section>
        <aside className="principle"><span>WHY THIS WORKS</span><p>Nothing is called “done” just because you spent time on it. A project needs passing checks; a study task needs a new problem you can solve on your own.</p></aside></>}
      </>:route.pathname==='/'?<LandingPage startTask={startTask} link={link}/>:route.pathname==='/features'?<FeaturesPage startTask={startTask}/>:route.pathname==='/workspace'?<WorkspacePage tasks={tasks} showCompleted={showCompleted} setShowCompleted={setShowCompleted} onSelect={setSelected} startTask={startTask} error={error}/>:route.pathname==='/new'?<NewTaskPage form={form} setForm={setForm} create={create} busy={busy} error={error}/>:route.pathname==='/guide'?<GuidePage startTask={startTask} health={health}/>:selected&&!loaded?<section className="page-intro" role="status"><LoaderCircle className="spin"/><p>Picking up your thread…</p></section>:<NotFoundPage task={route.pathname.startsWith('/workspace/')} link={link}/>}

    </main>
    <footer className="home-foot"><a className="footer-wordmark" href="/" onClick={link('/')}>finish with me.</a><nav aria-label="Footer navigation"><a href="/features" onClick={link('/features')}>The idea</a><a href="/workspace" onClick={link('/workspace')}>Your workspace</a><a href="/guide" onClick={link('/guide')}>Getting started</a></nav><span>{health.irisVerified?'Powered by IRIS AI Hub':'AI Hub connection needed for live work'}</span></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
