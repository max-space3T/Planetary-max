/** User-supplied frozen anchors; the other 13 registry entries are not yet available. */
export const MAXQGA_REGISTRY_ID = 'MAXQGA_FENREGISTRY_V1_20261016';
export const MAXQGA_REGISTRY_EXPECTED_COUNT = 18;
export const MAXQGA_ANCHORS: readonly Readonly<{ id: string; fen: string }>[] = Object.freeze([
  Object.freeze({ id: 'MX-EV-001', fen: 'rnbqk2r/ppp2ppp/4pn2/3p2p1/2PP4/2N2N2/PP2PPPP/R2QKB1R w KQkq g6 0 8' }),
  Object.freeze({ id: 'MX-EV-002', fen: 'r2qkb1r/1b3ppp/p3pn2/3p2p1/1pPP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 11' }),
  Object.freeze({ id: 'MX-EV-003', fen: 'r2qkb1r/1b4pp/p3pn2/3p1pp1/1pPP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 13' }),
  Object.freeze({ id: 'MX-EV-004', fen: 'r2qkb1r/1b4pp/p3p3/3p1pp1/1pPP4/2N1nN2/PP2PPPP/R2Q1BK1 w kq - 0 14' }),
  Object.freeze({ id: 'MX-EV-005', fen: 'r2qkb1r/1b3ppp/p3pn2/3p2p1/2PP4/1pN2N2/PP2PPPP/R2QKB1R w KQkq - 0 11' }),
]);
