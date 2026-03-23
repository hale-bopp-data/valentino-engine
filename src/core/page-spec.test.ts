import { describe, it, expect } from 'vitest';
import { validatePageSpec } from './page-spec.js';

describe('validatePageSpec', () => {
  it('validates a correct PageSpec', () => {
    const spec = { id: 'home', version: '1.0', components: [] };
    expect(validatePageSpec(spec)).toBe(true);
  });

  it('rejects null', () => {
    expect(validatePageSpec(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validatePageSpec('string')).toBe(false);
    expect(validatePageSpec(42)).toBe(false);
  });

  it('rejects missing id', () => {
    expect(validatePageSpec({ version: '1.0', components: [] })).toBe(false);
  });

  it('rejects missing version', () => {
    expect(validatePageSpec({ id: 'test', components: [] })).toBe(false);
  });

  it('rejects missing components', () => {
    expect(validatePageSpec({ id: 'test', version: '1.0' })).toBe(false);
  });

  it('rejects components as non-array', () => {
    expect(validatePageSpec({ id: 'test', version: '1.0', components: 'bad' })).toBe(false);
  });

  it('accepts spec with optional meta field', () => {
    const spec = { id: 'home', version: '1.0', components: [], meta: { author: 'valentino' } };
    expect(validatePageSpec(spec)).toBe(true);
  });
});
