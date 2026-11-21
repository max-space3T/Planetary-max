import React from 'react';
import AdminAccess, { useAdministrator } from '../admin/AdminAccess';
import BeeMaxAssistant from '../admin/BeeMaxAssistant';
import RoutingStudio from './RoutingStudio';
import './architecture.css';

const layers = [
  { number: '01', name: 'BEEMAX', label: 'ORCHESTRATOR', detail: 'Classifies requests and identifies the appropriate layer.' },
  { number: '02', name: 'MAX-ROSETTA', label: 'NORMALIZATION', detail: 'Defines envelopes for proposed and solver-verified results.' },
  { number: '03', name: 'MAX Neural Network', label: 'PERCEPTION', detail: 'Intended for tensors, telemetry, spatial frames and market signals.' },
  { number: '04', name: 'MAX LLM', label: 'REASONING', detail: 'Intended for synthesis, plans and schemas across modules.' },
  { number: '05', name: 'Deterministic & Quantum Solvers', label: 'VERIFICATION', detail: 'Intended to verify applicable results before state is committed.' },
];

function OperatorTools() {
  const authenticated = useAdministrator();
  if (!authenticated) return <p className="architecture-note">Sign in as an operator to use BEEMAX and check routing decisions.</p>;
  return <div className="architecture-tools"><BeeMaxAssistant/><RoutingStudio/></div>;
}

export default function ArchitectureView() {
  return <div className="module-view architecture-view">
    <div className="module-heading"><div><span className="eyebrow">06 / MAX ARCHITECTURE · INTELLIGENCE NETWORK</span><h1>MAX <em>Architecture.</em></h1><p>Explore the layers of your network and work with BEEMAX.</p></div><span className="outline-pill">✳ &nbsp; POLICY 1.1.0</span></div>
    <section className="architecture-intro">
      <div><span className="architecture-kicker">YOUR INTELLIGENCE NETWORK</span><h2>From request to decision.</h2><p>BEEMAX classifies normalized requests for the MAX architecture. Use the operator tools to converse with BEEMAX or check a routing decision.</p><button className="neon-button primary architecture-open-tools" onClick={() => document.getElementById('architecture-tools')?.scrollIntoView({ behavior: 'smooth' })}>Open operator tools ↘</button></div>
      <div className="architecture-orbit" aria-hidden="true"><span>✳</span><i/><i/></div>
    </section>
    <div className="architecture-heading"><div><span className="micro-label">THE NETWORK / 05 LAYERS</span><h2>Explore the architecture<span>.</span></h2></div><span>SELECTED POLICY · 1.1.0</span></div>
    <div className="architecture-layers">{layers.map(layer => <article className="architecture-layer" key={layer.name}><div><span>{layer.number} / {layer.label}</span></div><h3>{layer.name}</h3><p>{layer.detail}</p></article>)}</div>
    <p className="architecture-note">The routing classifier returns decisions only. MAX LLM, neural processing and solver execution require connected services; the current BEEMAX chat uses Cloudflare Workers AI.</p>
    <section className="architecture-access" id="architecture-tools" aria-labelledby="architecture-tools-title"><div className="architecture-heading"><div><span className="micro-label">OPERATOR TOOLS</span><h2 id="architecture-tools-title">Put the network to work<span>.</span></h2></div></div><AdminAccess signInButtonLabel="Sign in to Architecture" signInDescription="Sign in to use BEEMAX and the routing studio."><OperatorTools/></AdminAccess></section>
  </div>;
}
