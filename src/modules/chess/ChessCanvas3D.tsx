import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import StauntonPiece from './StauntonPiece';
import { createStauntonPiece } from './stauntonGeometry';
import './tournament-board.css';

export type Piece = { square: string; type: string; white: boolean };
function coords(square: string) {
  return { x: square.charCodeAt(0) - 97 - 3.5, z: 3.5 - (Number(square[1]) - 1) };
}

export default function ChessCanvas3D({ pieces, selected, legal, onSquare, view }: {
  pieces: Piece[];
  selected: string | null;
  legal: string[];
  onSquare: (square: string) => void;
  view: 'tournament' | '3d';
}) {
  const cameraView = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const el = mount.current;
    if (!el || view !== '3d') return;
    let renderer: THREE.WebGLRenderer | SVGRenderer;
    let webgl: THREE.WebGLRenderer | undefined;
    try {
      webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      webgl.outputColorSpace = THREE.SRGBColorSpace;
      renderer = webgl;
    } catch {
      // SVGRenderer projects the same 3D scene when WebGL is unavailable.
      try {
        renderer = new SVGRenderer();
        renderer.setClearColor(new THREE.Color(0x596a53), 1);
      } catch {
        setUnavailable(true);
        return;
      }
    }
    setUnavailable(false);
    renderer.setSize(el.clientWidth, el.clientHeight);
    const surface = renderer.domElement as unknown as HTMLElement;
    surface.classList.add('chess-3d-surface');
    el.appendChild(surface);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / Math.max(el.clientHeight, 1), .1, 100);
    camera.position.set(8, 10, 11);
    const controls = new OrbitControls(camera, surface);
    controls.enableDamping = Boolean(webgl);
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.set(0, 0, 0);
    if (cameraView.current) {
      camera.position.copy(cameraView.current.position);
      controls.target.copy(cameraView.current.target);
    }
    scene.add(new THREE.AmbientLight(webgl ? 0xffffff : 0x999999, webgl ? 1.8 : 1));
    const light = new THREE.DirectionalLight(0xffffff, webgl ? 2.8 : .65);
    light.position.set(4, 12, 7);
    scene.add(light);

    const geometry: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const geo = <T extends THREE.BufferGeometry>(g: T) => { geometry.push(g); return g; };
    const mat = (color: number) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: .45 });
      materials.push(m);
      return m;
    };
    const dark = mat(0x779556), lightSq = mat(0xf1f3e8), baseMat = mat(0x40553a);
    const white = mat(0xe6e5d9), black = mat(0x3a3a35), highlight = mat(0xc6d580);
    // A border avoids a large top face obscuring squares in the SVG renderer.
    for (const [x, z, w, d] of [[0, -4.12, 8.5, .25], [0, 4.12, 8.5, .25], [-4.12, 0, .25, 8], [4.12, 0, .25, 8]]) {
      const edge = new THREE.Mesh(geo(new THREE.BoxGeometry(w, .3, d)), baseMat);
      edge.position.set(x, -.13, z);
      scene.add(edge);
    }

    const squares: THREE.Mesh[] = [];
    for (let rank = 1; rank <= 8; rank++) for (let file = 0; file < 8; file++) {
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      const c = coords(square);
      const isHint = legal.includes(square) || selected === square;
      const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(1, .06, 1)), isHint ? highlight : ((rank + file) % 2 ? dark : lightSq));
      mesh.position.set(c.x, 0, c.z);
      mesh.userData.square = square;
      scene.add(mesh);
      squares.push(mesh);
    }
    const pieceGroups: THREE.Group[] = [];
    pieces.forEach(p => {
      const c = coords(p.square);
      const group = createStauntonPiece(p.type, p.white ? white : black, geo, webgl ? 32 : 12);
      group.position.set(c.x, .04, c.z);
      if (!p.white && p.type === 'n') group.rotation.y = Math.PI;
      group.traverse(object => { object.userData.square = p.square; });
      pieceGroups.push(group);
      scene.add(group);
    });

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const press = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const click = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = surface.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects([...squares, ...pieceGroups], true)[0]?.object.userData.square;
      if (hit) onSquare(hit);
    };
    surface.addEventListener('pointerdown', press);
    surface.addEventListener('pointerup', click);

    let frame = 0;
    const draw = () => renderer.render(scene, camera);
    const requestDraw = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); });
    };
    const render = () => { frame = requestAnimationFrame(render); controls.update(); draw(); };
    if (webgl) render();
    else {
      controls.update();
      controls.addEventListener('change', requestDraw);
      draw();
    }
    const observer = new ResizeObserver(() => {
      if (!el.clientWidth || !el.clientHeight) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      if (!webgl) requestDraw();
    });
    observer.observe(el);
    return () => {
      cameraView.current = { position: camera.position.clone(), target: controls.target.clone() };
      cancelAnimationFrame(frame);
      observer.disconnect();
      surface.removeEventListener('pointerdown', press);
      surface.removeEventListener('pointerup', click);
      controls.removeEventListener('change', requestDraw);
      controls.dispose();
      geometry.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      webgl?.dispose();
      surface.remove();
    };
  }, [pieces, selected, legal, onSquare, view]);

  return <div className="chess-canvas" data-view={view} ref={mount} aria-label={view === '3d' && !unavailable ? 'Three dimensional chess board' : 'Tournament chess board'}>
    {(view === 'tournament' || unavailable) && <div className="webgl-fallback">
      {view === '3d' && unavailable && <span>3D view unavailable · Tournament board</span>}
      <div className="fallback-board">{Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => {
        const square = `${'abcdefgh'[col]}${8 - row}`;
        const piece = pieces.find(p => p.square === square);
        return <button key={square} className={`${(row + col) % 2 ? 'dark' : 'light'} ${legal.includes(square) ? 'legal' : ''} ${selected === square ? 'selected' : ''}`} onClick={() => onSquare(square)} aria-label={`${square}${piece ? ` ${piece.white ? 'white' : 'black'} ${piece.type}` : ''}${legal.includes(square) ? ' legal move' : ''}`}>{piece && <StauntonPiece type={piece.type} white={piece.white}/>}</button>;
      }))}</div>
    </div>}
    {view === '3d' && !unavailable && <div className="canvas-caption">◉ &nbsp; DRAG TO ORBIT &nbsp; / &nbsp; SCROLL TO ZOOM</div>}
  </div>;
}
