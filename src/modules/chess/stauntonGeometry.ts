import * as THREE from 'three';

// Lathed profiles give each piece the turned base and collar of a Staunton set.
export function createStauntonPiece(type: string, material: THREE.Material, track: <T extends THREE.BufferGeometry>(geometry: T) => T, segments = 32) {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const lathe = (points: [number, number][]) => add(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments));
  lathe([[0,0],[.32,0],[.37,.025],[.37,.09],[.34,.13],[.30,.14],[.30,.18],[.26,.21],[.22,.22]]);
  if (type === 'n') {
    lathe([[.22,.22],[.25,.25],[.24,.30],[.19,.34],[.17,.40]]);
    const horse = new THREE.Shape();
    horse.moveTo(-.22,.31); horse.lineTo(-.18,.55); horse.lineTo(-.13,.70);
    horse.lineTo(-.26,.67); horse.lineTo(-.31,.74); horse.lineTo(-.25,.87);
    horse.lineTo(-.13,.91); horse.lineTo(-.07,1.04); horse.lineTo(.02,.98);
    horse.bezierCurveTo(.23,.96,.26,.75,.20,.57); horse.lineTo(.18,.31); horse.closePath();
    const head = add(new THREE.ExtrudeGeometry(horse, { depth:.16, bevelEnabled:true, bevelSize:.025, bevelThickness:.025, bevelSegments:2 }), 0, 0, -.08);
    head.rotation.y = Math.PI / 2;
    return group;
  }
  const heights: Record<string, number> = { p:.64, r:.82, b:.95, q:1.06, k:1.18 };
  const h = heights[type] ?? .64;
  lathe([[.22,.22],[.26,.25],[.26,.29],[.21,.32],[.16,.36],[.12,h-.22],[.17,h-.18],[.20,h-.15],[.20,h-.11],[.15,h-.09]]);
  if (type === 'p') {
    add(new THREE.SphereGeometry(.14, segments, Math.max(6, Math.floor(segments / 2))), 0, h-.01);
  } else if (type === 'r') {
    lathe([[.15,h-.12],[.24,h-.12],[.24,h-.02],[.20,h+.02],[.20,h+.08],[.14,h+.08],[.14,h+.02]]);
    for (let i=0;i<4;i++) {
      const angle = i * Math.PI / 2;
      const block = add(new THREE.BoxGeometry(.11,.09,.10), Math.cos(angle)*.17, h+.10, Math.sin(angle)*.17);
      block.rotation.y = -angle;
    }
  } else if (type === 'b') {
    lathe([[.15,h-.10],[.19,h-.05],[.17,h+.06],[.10,h+.16],[.025,h+.22]]);
    add(new THREE.SphereGeometry(.05, 16, 12),0,h+.24);
  } else if (type === 'q') {
    lathe([[.15,h-.10],[.22,h-.06],[.25,h+.08],[.21,h+.11],[.10,h+.05]]);
    for(let i=0;i<6;i++) add(new THREE.SphereGeometry(.045,12,8),Math.cos(i*Math.PI/3)*.21,h+.11,Math.sin(i*Math.PI/3)*.21);
    add(new THREE.SphereGeometry(.065,16,12),0,h+.12);
  } else if (type === 'k') {
    lathe([[.15,h-.10],[.21,h-.06],[.23,h+.04],[.18,h+.08],[.11,h+.09]]);
    add(new THREE.BoxGeometry(.065,.24,.065),0,h+.20);
    add(new THREE.BoxGeometry(.19,.06,.065),0,h+.23);
  }
  return group;
}
