import React from 'react';
import {Plus,ArrowRight,Check} from 'lucide-react';
import {FeaturePreview} from '../FeaturePreview.jsx';
export default function LandingPage({startTask,link}){return <>
 <section className="hero"><div className="hero-copy"><span className="hero-kicker"><span/> ONE TASK. A REAL RESULT.</span><h1>STUCK IS A<br/>MOMENT.<br/><em>NOT THE END.</em></h1><p>Your source files. Your study notes. One blocker we can work through—until you have a result you can review.</p><button className="button primary big" onClick={()=>startTask('coding')}><Plus size={17}/> Bring me the stuck thing <ArrowRight size={16}/></button><div className="trust"><span><Check size={13}/> no guilt streaks</span><span><Check size={13}/> your files & your notes</span><span><Check size={13}/> evidence before “done”</span></div></div><FeaturePreview onStart={startTask}/></section>
 <section className="page-junction"><a href="/features" onClick={link('/features')}><span>Get to know the process</span><strong>See how it works.</strong><ArrowRight/></a><a href="/workspace" onClick={link('/workspace')}><span>Your unfinished things are waiting</span><strong>Pick up the thread.</strong><ArrowRight/></a></section>
 </>;}
