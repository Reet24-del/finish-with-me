import React from 'react';
import {FeatureShowcase} from '../FeaturePreview.jsx';
export default function FeaturesPage({startTask}){return <><section className="page-intro"><span className="eyebrow">THE APPROACH</span><h1>A way back<br/><em>into the work.</em></h1><p>Give a blocker some context. Make one useful move. Keep the result and the evidence together.</p></section><FeatureShowcase onStart={startTask}/></>;}
