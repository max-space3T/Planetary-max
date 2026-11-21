import React, { useEffect, useRef, useState } from 'react';

type Category = 'instant' | 'neural' | 'reasoning' | 'solver';
type VerificationSignal = 'equations' | 'physics_parameters' | 'financial_valuations' | 'simulation_steps';
type Decision = {
  status: 'matched' | 'unmatched';
  execution: 'not_dispatched';
  rule_id?: string;
  route_to?: string;
  commit_authority?: string;
  verification?: string;
  verification_target?: string;
  downstream_consumers?: string[];
  publish_to?: string[];
  error?: string;
};
const intents: Record<Category, string[]> = {
  instant: ['navigate', 'toggle_panel', 'camera_move', 'status_check', 'quick_lookup'],
  neural: ['embed', 'classify_signal', 'detect_anomaly', 'forecast_series', 'annotate_scene'],
  reasoning: ['synthesize', 'plan_workflow', 'translate_schema', 'explain', 'draft_spec'],
  solver: ['solve_math', 'integrate_dynamics', 'enforce_physics', 'optimize_qubo', 'simulate_quantum', 'step_twin'],
};
const signals: VerificationSignal[] = ['equations', 'physics_parameters', 'financial_valuations', 'simulation_steps'];
const modules = ['MAX-MATH', 'MAX-CALCULUS', 'MAX PHYSICS', 'MAX-BRUTEFORCE', 'MAX QUANTUM', 'BLUE QUANTUM SOFTWARE STACK', 'QUANTUM ERROR AND NOISE SUITE', 'MAX SIM'];
const display = (value: string) => value.replace(/_/g, ' ');

export default function RoutingStudio() {
  const [category, setCategory] = useState<Category>('instant');
  const [intent, setIntent] = useState(intents.instant[0]);
  const [ingress, setIngress] = useState('Portal-OS1');
  const [compute, setCompute] = useState('no');
  const [ambiguous, setAmbiguous] = useState(false);
  const [payload, setPayload] = useState('tensor');
  const [coordination, setCoordination] = useState(true);
  const [verification, setVerification] = useState<'unknown' | 'none' | 'signals'>('unknown');
  const [selectedSignals, setSelectedSignals] = useState<VerificationSignal[]>([]);
  const [target, setTarget] = useState(modules[0]);
  const [result, setResult] = useState<Decision | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const request: Record<string, unknown> = { ingress, intent_type: intent };
    if (category === 'instant') {
      if (compute !== 'unknown') request.requires_compute = compute === 'yes';
      request.ambiguous = ambiguous;
    } else if (category === 'neural') request.payload_type = payload;
    else if (category === 'reasoning') {
      request.multi_module_coordination = coordination;
      if (verification === 'none') request.contains = [];
      if (verification === 'signals') request.contains = selectedSignals;
    } else request.target_module = target;

    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/admin/beemax/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.signal,
      });
      const body = await response.json() as Decision;
      if (!response.ok) throw new Error(body.error || 'Routing decision unavailable.');
      if (!controller.signal.aborted) setResult(body);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Routing decision unavailable.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (abort.current === controller) abort.current = null;
    }
  }

  return <section className="architecture-panel routing-studio" aria-labelledby="routing-title">
    <header><span className="architecture-kicker">POLICY 1.1.0</span><h2 id="routing-title">Routing studio</h2><p>Choose request metadata to see the policy decision.</p></header>
    <form onSubmit={submit} onChange={() => { setResult(null); setError(''); }}>
      <fieldset disabled={busy}>
        <div className="architecture-fields">
          <label>Ingress<select value={ingress} onChange={e => setIngress(e.target.value)}><option>Portal-OS1</option><option>MAX-INTERNET</option><option>MAX TELECOMMUNICATIONS</option></select></label>
          <label>Request type<select value={category} onChange={e => { const next = e.target.value as Category; setCategory(next); setIntent(intents[next][0]); }}>
            <option value="instant">Instant UI &amp; viewport</option><option value="neural">Tensor &amp; perception</option><option value="reasoning">Reasoning &amp; synthesis</option><option value="solver">Exact compute</option>
          </select></label>
          <label>Intent<select value={intent} onChange={e => setIntent(e.target.value)}>{intents[category].map(i => <option value={i} key={i}>{display(i)}</option>)}</select></label>
          {category === 'instant' && <label>Requires compute<select value={compute} onChange={e => setCompute(e.target.value)}><option value="no">No</option><option value="yes">Yes</option><option value="unknown">Unknown</option></select></label>}
          {category === 'neural' && <label>Payload type<select value={payload} onChange={e => setPayload(e.target.value)}>{['tensor','telemetry_stream','spatial_frame','market_tick'].map(p => <option value={p} key={p}>{display(p)}</option>)}</select></label>}
          {category === 'solver' && <label>Target module<select value={target} onChange={e => setTarget(e.target.value)}>{modules.map(m => <option key={m}>{m}</option>)}</select></label>}
        </div>
        {category === 'instant' && <label className="architecture-check"><input type="checkbox" checked={ambiguous} onChange={e => setAmbiguous(e.target.checked)}/> Intent is ambiguous</label>}
        {category === 'reasoning' && <><label className="architecture-check"><input type="checkbox" checked={coordination} onChange={e => setCoordination(e.target.checked)}/> Requires coordination across modules</label>
          <label>Verification categories<select value={verification} onChange={e => setVerification(e.target.value as typeof verification)}><option value="unknown">Unknown</option><option value="none">None declared</option><option value="signals">Select categories</option></select></label>
          {verification === 'signals' && <div className="architecture-signal-list">{signals.map(signal => <label className="architecture-check" key={signal}><input type="checkbox" checked={selectedSignals.includes(signal)} onChange={e => { const checked = e.target.checked; setSelectedSignals(current => checked ? [...current, signal] : current.filter(s => s !== signal)); }}/>{display(signal)}</label>)}</div>}
        </>}
        {category === 'reasoning' && verification === 'signals' && !selectedSignals.length && <p className="architecture-note">Select at least one category, or choose “None declared”.</p>}
        <button className="neon-button primary" type="submit" disabled={category === 'reasoning' && verification === 'signals' && !selectedSignals.length}>{busy ? 'Checking…' : 'Check route ↗'}</button>
      </fieldset>
    </form>
    <p className="architecture-note">Classifies the metadata you provide. It does not inspect content, dispatch work, verify output, or commit state.</p>
    {error && <p role="alert" className="architecture-error">{error}</p>}
    {result && <div className="routing-result" role="status" aria-live="polite">
      {result.status === 'matched' ? <><span className="architecture-kicker">{result.rule_id}</span><h3>Route: {result.route_to}</h3><p>Authority: {result.commit_authority}</p>{result.verification && <p>Verification: {result.verification === 'not_indicated' ? 'none declared; content not inspected' : result.verification}{result.verification !== 'not_indicated' && result.verification_target ? ` · ${result.verification_target}` : ''}</p>}{result.downstream_consumers && <p>Downstream: {result.downstream_consumers.join(', ')}</p>}{result.publish_to && <p>Publish targets: {result.publish_to.join(', ')}</p>}</> : <h3>No matching rule</h3>}
      <strong>Decision only · work not dispatched</strong>
    </div>}
  </section>;
}
