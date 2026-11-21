import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createStauntonPiece } from '../stauntonGeometry';

describe('Staunton pieces', () => {
  it('creates visible pieces that fit on a board square', () => {
    const material = new THREE.MeshStandardMaterial();
    const geometries: THREE.BufferGeometry[] = [];
    const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry);
      return geometry;
    };
    const heights: number[] = [];
    for (const type of ['p', 'r', 'n', 'b', 'q', 'k']) {
      const piece = createStauntonPiece(type, material, track);
      const box = new THREE.Box3().setFromObject(piece);
      const size = box.getSize(new THREE.Vector3());
      expect([size.x, size.y, size.z].every(Number.isFinite)).toBe(true);
      expect(size.x).toBeGreaterThan(0);
      expect(size.z).toBeGreaterThan(0);
      expect(size.x).toBeLessThan(1);
      expect(size.z).toBeLessThan(1);
      expect(size.y).toBeGreaterThan(.5);
      heights.push(size.y);
    }
    expect(heights[4]).toBeGreaterThan(heights[0]);
    expect(heights[5]).toBeGreaterThan(heights[4]);
    geometries.forEach(geometry => geometry.dispose());
    material.dispose();
  });
});
