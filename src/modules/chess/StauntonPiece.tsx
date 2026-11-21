import React from 'react';
import bB from './vendor/chessnut/bB.svg';
import bK from './vendor/chessnut/bK.svg';
import bN from './vendor/chessnut/bN.svg';
import bP from './vendor/chessnut/bP.svg';
import bQ from './vendor/chessnut/bQ.svg';
import bR from './vendor/chessnut/bR.svg';
import wB from './vendor/chessnut/wB.svg';
import wK from './vendor/chessnut/wK.svg';
import wN from './vendor/chessnut/wN.svg';
import wP from './vendor/chessnut/wP.svg';
import wQ from './vendor/chessnut/wQ.svg';
import wR from './vendor/chessnut/wR.svg';

const pieces: Record<string, string> = {
  bb: bB, bk: bK, bn: bN, bp: bP, bq: bQ, br: bR,
  wb: wB, wk: wK, wn: wN, wp: wP, wq: wQ, wr: wR,
};

export default function StauntonPiece({ type, white }: { type: string; white: boolean }) {
  return <img className="staunton-piece" src={pieces[`${white ? 'w' : 'b'}${type}`]} alt="" aria-hidden="true" draggable={false}/>;
}
