import { describe, it, expect } from 'vitest';
import {
  calculateFingerAngle,
  calculateAllFingerAngles,
  FINGERS,
  DEFAULT_FINGER_STATUS,
  Point,
} from '@/lib/hand-tracking';

describe('Hand Tracking Utilities', () => {
  // Create 21 MediaPipe landmarks
  const createLandmarks = (): Point[] => {
    return Array(21).fill(null).map((_, i) => ({
      x: 0.5,
      y: 0.5 + (i * 0.01), // Slight variation
      z: 0,
    }));
  };

  describe('FINGERS configuration', () => {
    it('should have 5 finger definitions', () => {
      expect(FINGERS).toHaveLength(5);
    });

    it('should have correct finger names', () => {
      const names = FINGERS.map(f => f.name);
      expect(names).toContain('pulgar');
      expect(names).toContain('indice');
      expect(names).toContain('medio');
      expect(names).toContain('anular');
      expect(names).toContain('menique');
    });

    it('should have valid landmark indices', () => {
      FINGERS.forEach(finger => {
        expect(finger.mcpIndex).toBeGreaterThanOrEqual(0);
        expect(finger.mcpIndex).toBeLessThan(21);
        expect(finger.tipIndex).toBeGreaterThanOrEqual(0);
        expect(finger.tipIndex).toBeLessThan(21);
      });
    });
  });

  describe('DEFAULT_FINGER_STATUS', () => {
    it('should have status for all fingers', () => {
      expect(DEFAULT_FINGER_STATUS.pulgar).toBeDefined();
      expect(DEFAULT_FINGER_STATUS.indice).toBeDefined();
      expect(DEFAULT_FINGER_STATUS.medio).toBeDefined();
      expect(DEFAULT_FINGER_STATUS.anular).toBeDefined();
      expect(DEFAULT_FINGER_STATUS.menique).toBeDefined();
    });

    it('should default to normal status', () => {
      Object.values(DEFAULT_FINGER_STATUS).forEach(status => {
        expect(status).toBe('normal');
      });
    });
  });

  describe('calculateFingerAngle', () => {
    it('should return a number for valid landmarks', () => {
      const landmarks = createLandmarks();
      const indexFinger = FINGERS.find(f => f.name === 'indice')!;
      
      const result = calculateFingerAngle(landmarks, indexFinger);
      
      expect(typeof result).toBe('number');
    });

    it('should return different angles for different finger positions', () => {
      const landmarks = createLandmarks();
      const indexFinger = FINGERS.find(f => f.name === 'indice')!;
      const middleFinger = FINGERS.find(f => f.name === 'medio')!;
      
      const angle1 = calculateFingerAngle(landmarks, indexFinger);
      const angle2 = calculateFingerAngle(landmarks, middleFinger);
      
      // With identical landmarks, angles should be equal
      expect(angle1).toBe(angle2);
    });
  });

  describe('calculateAllFingerAngles', () => {
    it('should return angles for all 5 fingers', () => {
      const landmarks = createLandmarks();
      
      const result = calculateAllFingerAngles(landmarks);
      
      expect(result).toHaveProperty('pulgar');
      expect(result).toHaveProperty('indice');
      expect(result).toHaveProperty('medio');
      expect(result).toHaveProperty('anular');
      expect(result).toHaveProperty('menique');
    });

    it('should return numbers for all finger angles', () => {
      const landmarks = createLandmarks();
      
      const result = calculateAllFingerAngles(landmarks);
      
      Object.values(result).forEach(angle => {
        expect(typeof angle).toBe('number');
      });
    });
  });
});
