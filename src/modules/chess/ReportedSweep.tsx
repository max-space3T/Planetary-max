import React from 'react';
import { MAXQGA_REPORTED_SWEEP as sweep } from './maxqgaSweep';

export default function ReportedSweep() {
  return <details id="qga-sweep" className="reported-sweep">
    <summary>Reported depth-50 sweep</summary>
    <p className="quiet">{sweep.sweepId} · {sweep.registryId} · User-supplied summary; search logs have not been verified.</p>
    <div className="distortion-results">
      <div><span>Reported depth</span><strong>{sweep.searchDepth}</strong></div>
      <div><span>Average stability</span><strong>{sweep.averageStabilityScore.toFixed(1)}</strong></div>
      <div><span>Refutation rate</span><strong>{sweep.refutationRatePercent.toFixed(1)}%</strong></div>
    </div>
    <p className="quiet">Reported tier: {sweep.tierVerdict} · {sweep.nodes.length} node results supplied</p>
    <div className="sweep-table-wrap"><table className="sweep-table">
      <thead><tr><th scope="col">Node</th><th scope="col">Stability</th><th scope="col">Reported verdict</th></tr></thead>
      <tbody>{sweep.nodes.map(node => <tr key={node.nodeId}><th scope="row">{node.nodeId}</th><td>{node.stability.toFixed(1)}</td><td>{node.verdict}</td></tr>)}</tbody>
    </table></div>
  </details>;
}
