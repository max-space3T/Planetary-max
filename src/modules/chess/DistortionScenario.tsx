import React, { useState } from 'react';
import { scoreDistortionState, type DistortionMetrics } from './distortionMetrics';

type Props = { fen: string; nodeId: string; legalMovesCount: number };
export default function DistortionScenario({ fen, nodeId, legalMovesCount }: Props) {
  const [tension, setTension] = useState('');
  const [clock, setClock] = useState('');
  const [result, setResult] = useState<{ fen: string; metrics: DistortionMetrics } | null>(null);
  const [error, setError] = useState('');
  const visible = result?.fen === fen ? result.metrics : null;

  return <details className="distortion-scenario">
    <summary>MAX-QGA distortion scenario</summary>
    <p className="quiet">Legal moves come from the board. Enter the tension count and remaining time for this scenario.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const tensionValue = Number(tension); const clockValue = Number(clock);
      if (!tension.trim() || !clock.trim() || !Number.isSafeInteger(tensionValue) || tensionValue < 0 || !Number.isFinite(clockValue) || clockValue < 0) {
        setResult(null); setError('Enter a non-negative whole tension count and a non-negative time.'); return;
      }
      setError('');
      setResult({ fen, metrics: scoreDistortionState(nodeId, legalMovesCount, tensionValue, clockValue) });
    }}>
      <div className="distortion-inputs">
        <label>Asymmetric tension count<input type="number" min="0" step="1" required value={tension} onChange={event => { setTension(event.target.value); setResult(null); setError(''); }}/></label>
        <label>Remaining time (seconds)<input type="number" min="0" step="any" required value={clock} onChange={event => { setClock(event.target.value); setResult(null); setError(''); }}/></label>
      </div>
      <p className="quiet">Position: {nodeId === 'current_position' ? 'Current board' : nodeId} · Legal moves: {legalMovesCount}</p>
      <button className="neon-button">Calculate scenario</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {visible && <div className="distortion-results" role="status">
      <div><span>Distortion index</span><strong>{visible.distortionIndex.toFixed(2)}</strong></div>
      <div><span>Decision load</span><strong>{visible.decisionLoadIndex.toFixed(2)}</strong></div>
      <div><span>Branching factor (minimum 1)</span><strong>{visible.branchingFactor}</strong></div>
      <div><span>Primary vector</span><strong>{visible.primaryVector}</strong></div>
    </div>}
  </details>;
}
