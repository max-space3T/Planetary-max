import React from 'react';
import { MAXQGA_REPORTED_SELF_PLAY as batch } from './maxqgaSelfPlay';

export default function ReportedSelfPlay() {
  const { results, behavioral_tiers: tiers } = batch;
  return <details id="qga-selfplay" className="reported-sweep">
    <summary>Reported self-play batch</summary>
    <p className="quiet">{batch.batch_id} · User-supplied summary; individual game records have not been verified.</p>
    <p className="quiet">{batch.total_games} games · {batch.baseline_games} baseline · {batch.batch_games} batch</p>
    <div className="distortion-results">
      <div><span>Wins</span><strong>{results.wins} · {results.win_rate_percent.toFixed(1)}%</strong></div>
      <div><span>Draws</span><strong>{results.draws} · {results.draw_rate_percent.toFixed(1)}%</strong></div>
      <div><span>Losses</span><strong>{results.losses} · {results.loss_rate_percent.toFixed(1)}%</strong></div>
      <div><span>Win or draw</span><strong>{results.combined_non_loss_percent.toFixed(1)}%</strong></div>
    </div>
    <p className="quiet">Reported behavioral tiers</p>
    <div className="sweep-table-wrap" role="region" aria-label="Reported behavioral tiers" tabIndex={0}><table className="sweep-table">
      <thead><tr><th scope="col">Tier</th><th scope="col">Collapse vector</th><th scope="col">Effectiveness</th><th scope="col">Reported detail</th></tr></thead>
      <tbody>
        <tr><th scope="row">1600_1900</th><td>{tiers['1600_1900'].collapse_vector}</td><td>{tiers['1600_1900'].effectiveness}</td><td>Win/draw: {tiers['1600_1900'].win_draw_rate_percent.toFixed(1)}%</td></tr>
        <tr><th scope="row">1900_2200</th><td>{tiers['1900_2200'].collapse_vector}</td><td>{tiers['1900_2200'].effectiveness}</td><td>Distortion: {tiers['1900_2200'].distortion_rate_percent.toFixed(1)}%</td></tr>
        <tr><th scope="row">2200_2400_plus</th><td>{tiers['2200_2400_plus'].collapse_vector}</td><td>{tiers['2200_2400_plus'].effectiveness}</td><td>{tiers['2200_2400_plus'].state}</td></tr>
        <tr><th scope="row">super_gm_engine</th><td>{tiers.super_gm_engine.collapse_vector}</td><td>{tiers.super_gm_engine.effectiveness}</td><td>{tiers.super_gm_engine.equivalence}</td></tr>
      </tbody>
    </table></div>
  </details>;
}
