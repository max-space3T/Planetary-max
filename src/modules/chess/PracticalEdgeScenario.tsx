import React, { useState } from 'react';
import { MaxChessEngine, type EngineEvaluation } from './maxChessEngine';

type Props = { fen: string; nodeId: string; candidateMoves: string[] };
const evaluator = new MaxChessEngine();
export default function PracticalEdgeScenario({ fen, nodeId, candidateMoves }: Props) {
  const [centipawns, setCentipawns] = useState('');
  const [depth, setDepth] = useState('');
  const [clock, setClock] = useState('');
  const [result, setResult] = useState<EngineEvaluation | null>(null);
  const [error, setError] = useState('');
  const visible = result?.fen === fen ? result : null;

  return <details className="distortion-scenario">
    <summary>MAX-QGA practical edge estimate</summary>
    <p className="quiet">Enter a base evaluation and depth to model the supplied formula. This estimate does not run a depth search; legal moves come from the current board.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const cp = Number(centipawns); const assumedDepth = Number(depth); const remaining = clock.trim() ? Number(clock) : 180;
      if (!centipawns.trim() || !depth.trim() || !Number.isSafeInteger(cp) || !Number.isSafeInteger(assumedDepth) || assumedDepth < 1 || !Number.isFinite(remaining) || remaining < 0) {
        setResult(null); setError('Enter whole-number centipawns, a positive whole depth and a non-negative time.'); return;
      }
      setError('');
      setResult(evaluator.evaluatePosition(fen, nodeId, cp, { maxDepth: assumedDepth, clockRemainingSec: remaining, candidateMoves }));
    }}>
      <div className="distortion-inputs">
        <label>Base evaluation (centipawns)<input type="number" step="1" required value={centipawns} onChange={event => { setCentipawns(event.target.value); setResult(null); setError(''); }}/></label>
        <label>Assumed depth<input type="number" min="1" step="1" required value={depth} onChange={event => { setDepth(event.target.value); setResult(null); setError(''); }}/></label>
        <label>Remaining time (seconds)<input type="number" min="0" step="any" placeholder="180" value={clock} onChange={event => { setClock(event.target.value); setResult(null); setError(''); }}/></label>
      </div>
      <p className="quiet">Position: {nodeId === 'current_position' ? 'Current board' : nodeId} · Legal moves: {candidateMoves.length} · Time defaults to 180 seconds.</p>
      <button className="neon-button">Estimate practical edge</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {visible && <div className="distortion-results" role="status">
      <div><span>Practical edge</span><strong>{visible.practicalEdgeScore.toFixed(2)}</strong></div>
      <div><span>Distortion index</span><strong>{visible.distortion.distortionIndex.toFixed(2)}</strong></div>
      <div><span>Decision load</span><strong>{visible.distortion.decisionLoadIndex.toFixed(2)}</strong></div>
      <div><span>Primary vector</span><strong>{visible.distortion.primaryVector}</strong></div>
    </div>}
  </details>;
}
