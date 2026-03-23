import { describe, it, expect } from 'vitest';
import { validatePageSpec } from './page-spec.js';

describe('validatePageSpec (V1)', () => {
  it('validates a correct PageSpecV1', () => {
    const spec = { version: '1', id: 'home', sections: [] };
    expect(validatePageSpec(spec)).toBe(true);
  });

  it('rejects null', () => {
    expect(validatePageSpec(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validatePageSpec('string')).toBe(false);
    expect(validatePageSpec(42)).toBe(false);
  });

  it('rejects wrong version', () => {
    expect(validatePageSpec({ version: '2', id: 'test', sections: [] })).toBe(false);
  });

  it('rejects missing id', () => {
    expect(validatePageSpec({ version: '1', sections: [] })).toBe(false);
  });

  it('rejects missing sections', () => {
    expect(validatePageSpec({ version: '1', id: 'test' })).toBe(false);
  });

  it('rejects sections as non-array', () => {
    expect(validatePageSpec({ version: '1', id: 'test', sections: 'bad' })).toBe(false);
  });

  it('accepts spec with optional fields', () => {
    const spec = {
      version: '1' as const,
      id: 'home',
      profile: 'home-signature',
      titleKey: 'page.home.title',
      sections: [{ type: 'hero', titleKey: 'hero.title' }],
    };
    expect(validatePageSpec(spec)).toBe(true);
  });
});
