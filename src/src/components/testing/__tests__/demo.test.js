import { describe, it, expect } from 'vitest';
import { add } from '../../helpers/demoTestFunction';

describe('mathUtils', () => {
  it('correctly adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('correctly adds a positive and a negative number', () => {
    expect(add(5, -3)).toBe(2);
  });

  it('correctly adds two negative numbers', () => {
    expect(add(-2, -3)).toBe(-5);
  });
});