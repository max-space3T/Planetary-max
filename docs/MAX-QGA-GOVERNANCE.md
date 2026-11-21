<!-- coderabbit-ai-generated:v1 -->

# MAX-QGA and MAX-SIM v2.0

The supplied specification identifies MAX-SIM v2.0 as the meta-engine for verification rules, distortion metrics and promotion gates, and MAX-QGA as a chess domain module. Its frozen core distortion line definitions must not be altered silently. The stated evidence hierarchy is Verified Finding (VF), Strategic Concept (SC), Hypothesis Novelty (HN), and Research Candidate (RC).

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7007a4a577e0f959aeb2ceea6ad52d205128a2ad85adbaf531ee18745a467543 -->

The stated Tier B promotion requirements are the `18_FEN_REGISTRY`, depth-50 validation sweeps, multi-hundred-game self-play auditing under `SP500_BATCH_002`, and `TRB-001` sign-off. The request identifies `PROJECT_MC-001_MAXQGA`, registry `MAXQGA_FENREGISTRY_V1_20261016`, and candidate release `v1.1.0-tier-b-release`.

## Reported TRB-001 decision

The user supplied decision `TRB-001` for `PROJECT_MC-001_MAXQGA` and registry `MAXQGA_FENREGISTRY_V1_20261016`. It reports a promotion from `TIER_C_EXPERIMENTAL` to `TIER_B_STRONG_CANDIDATE`, theory status `FROZEN`, and verdict `APPROVED_FOR_TIER_B_RELEASE`. Its reported metric snapshot is:

| Metric | Reported value |
| --- | ---: |
| Depth-50 average stability | 79.1 |
| Refutation rate | 2.8% |
| Self-play sample size | 500 |
| Self-play wins | 40.8% |
| Self-play draws | 37.4% |
| Self-play losses | 21.8% |

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c739dfad22380ce71bc3c04e346c290354a90b3e2d4b731b33008253b5c42cf3 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:a9217dd3eed427ec387a4455a5a250927c3edb80b1cfdaff0efdb324acbca0b6 -->

The user also supplied the `D50_SWEEP_V1` summary for the same registry: depth 50, average stability 79.1, refutation rate 2.8%, and five node verdicts. The supplied summary is recorded in `src/modules/chess/maxqgaSweep.ts` and displayed in the chess board. It is a reported result; it is not a search performed by this application.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0f83c2c9c7a1e7bb241d9df70e3c4b30a792fd422291b31db4f944e7633058f0 -->

The user supplied the `SP500_BATCH_002` self-play summary: 500 games (100 baseline and 400 batch), with 204 wins, 187 draws and 109 losses. The reported 78.2% non-loss rate and four behavioral tier observations are recorded in `src/modules/chess/maxqgaSelfPlay.ts` and shown on the board. These are supplied observations, not games run by this application.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:66751876304cd8f0b95359a6eb2a1b6e349cf22f3440617cef7d140bdf850d1a -->

The requested release records are present under `config/`, `governance/`, `registry/` and `validation/`. They transcribe the supplied release, decision and summary data; they do not establish independent provenance. The release config pins a SHA-256 digest of the supplied FEN file, and the repository tests check that digest and the displayed records. This detects inconsistent changes in those checks; it does not make files immutable or authenticate an approval.

Five registry anchors, `MX-EV-001` through `MX-EV-005`, are stored verbatim in `registry/positions_mx_ev.fen` and `src/modules/chess/maxqgaRegistry.ts`; the manifest marks the 18-entry registry incomplete. The remaining 13 anchors, underlying sweep logs, individual self-play records, signer and sign-off record are not available in this repository. The reported decision and metrics have not been independently verified. No unit or formula for average stability was supplied.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

The board can load these five reference positions locally. Chess.js validates their FEN format; that check alone does not establish a position's historical reachability or verify the frozen lines. MX-EV-001 retains the supplied `g6` en-passant field for display and PGN persistence, while the engine receives the library's normalized FEN when no en-passant capture is legal.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fa121aec6dc20ffdfb9cd937cde319b8225976150288ced8d07704c147d7ffe6 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9d9228a23696f5421bf0d36a47a81c2086c452bc5181038553876eb06021dce6 -->

The browser chess board loads supplied FENs and analyzes positions with its existing Stockfish worker. It also offers the supplied distortion scoring formula as a local scenario: legal move count comes from the board; asymmetric tension count and remaining clock seconds are entered manually. A score is associated with an anchor ID only when the current FEN matches that anchor exactly.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:297925883294a6131c5f0b7e37047d9f3cd895e2f782bd620132f5f5526e6da7 -->

The scoring function preserves the supplied weights and formula, including a minimum branching factor of one. The formula uses `gFileThrust` and `f5WedgeClamp`; the supplied `b4SpaceClamp` and `speculativeBreak` weights are stored but do not participate in this calculation. The formula does not define how to detect tension or obtain a live clock.

The separate practical-edge estimator implements the supplied arithmetic using a caller-provided centipawn value, candidate count and depth-based tension proxy. The browser scenario uses legal moves from the current board and asks for a base evaluation and assumed depth; it does not perform a search at that depth. The evaluator's six fallback candidate names are placeholders, not generated legal moves. It does not replace the existing Stockfish worker or provide a UCI search interface. Neither scenario runs depth-50 validation, self-play auditing or promotion. The remaining FEN entries, authoritative frozen lines, tension definition, validation protocol and evidence artifacts are still required.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
