import { describe, expect, it } from 'vitest';
import { Chess, validateFen } from '../vendor/chess.js';
import { MAXQGA_ANCHORS, MAXQGA_REGISTRY_EXPECTED_COUNT, MAXQGA_REGISTRY_ID } from '../maxqgaRegistry';

const supplied = [
  ['MX-EV-001', 'rnbqk2r/ppp2ppp/4pn2/3p2p1/2PP4/2N2N2/PP2PPPP/R2QKB1R w KQkq g6 0 8'],
  ['MX-EV-002', 'r2qkb1r/1b3ppp/p3pn2/3p2p1/1pPP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 11'],
  ['MX-EV-003', 'r2qkb1r/1b4pp/p3pn2/3p1pp1/1pPP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 13'],
  ['MX-EV-004', 'r2qkb1r/1b4pp/p3p3/3p1pp1/1pPP4/2N1nN2/PP2PPPP/R2Q1BK1 w kq - 0 14'],
  ['MX-EV-005', 'r2qkb1r/1b3ppp/p3pn2/3p2p1/2PP4/1pN2N2/PP2PPPP/R2QKB1R w KQkq - 0 11'],
];

describe('MAX-QGA supplied registry anchors', () => {
  it('preserves the supplied frozen FENs and identifies the incomplete registry', () => {
    expect(MAXQGA_REGISTRY_ID).toBe('MAXQGA_FENREGISTRY_V1_20261016');
    expect(MAXQGA_REGISTRY_EXPECTED_COUNT).toBe(18);
    expect(MAXQGA_ANCHORS.map(({ id, fen }) => [id, fen])).toEqual(supplied);
    expect(Object.isFrozen(MAXQGA_ANCHORS)).toBe(true);
    expect(MAXQGA_ANCHORS.every(Object.isFrozen)).toBe(true);
  });
  it.each(supplied)('%s loads and survives a PGN round trip without changing its FEN', (_id, fen) => {
    expect(validateFen(fen).ok).toBe(true);
    const game = new Chess(fen);
    expect(game.fen({ forceEnpassantSquare: true })).toBe(fen);
    const restored = new Chess();
    restored.loadPgn(game.pgn());
    expect(restored.fen({ forceEnpassantSquare: true })).toBe(fen);
  });
});
