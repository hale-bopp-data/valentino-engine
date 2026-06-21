import { describe, it, expect } from 'vitest';
import { createJsonOutput, SCHEMA_VERSION } from '../src/core/json-output.js';

describe('json-output', () => {
  it('creates output with all required fields', () => {
    const output = createJsonOutput({
      tool: 'audit',
      file: 'test.css',
      passed: true,
      exitCode: 0,
      sections: [],
      summary: 'All good',
    });
    expect(output.tool).toBe('audit');
    expect(output.version).toBeDefined();
    expect(output.schemaVersion).toBe(SCHEMA_VERSION);
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(output.file).toBe('test.css');
    expect(output.passed).toBe(true);
    expect(output.exitCode).toBe(0);
    expect(output.sections).toEqual([]);
    expect(output.summary).toBe('All good');
  });

  it('SCHEMA_VERSION is 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('reads version from package.json', () => {
    const output = createJsonOutput({
      tool: 'test',
      passed: true,
      exitCode: 0,
      sections: [],
      summary: '',
    });
    expect(output.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('file is optional', () => {
    const output = createJsonOutput({
      tool: 'probe',
      passed: false,
      exitCode: 1,
      sections: [],
      summary: 'Failed',
    });
    expect(output.file).toBeUndefined();
  });

  it('sections carry violations and warnings', () => {
    const output = createJsonOutput({
      tool: 'audit',
      file: 'test.css',
      passed: false,
      exitCode: 1,
      sections: [
        { name: 'Hardcoded px', status: 'fail', violations: ['Line 1: px found'], warnings: [] },
        { name: 'Named color', status: 'pass', violations: [], warnings: [] },
      ],
      summary: '1 violation',
    });
    expect(output.sections).toHaveLength(2);
    expect(output.sections[0].name).toBe('Hardcoded px');
    expect(output.sections[0].status).toBe('fail');
    expect(output.sections[0].violations).toHaveLength(1);
    expect(output.sections[1].status).toBe('pass');
  });

  it('exitCode maps correctly', () => {
    const pass = createJsonOutput({ tool: 't', passed: true, exitCode: 0, sections: [], summary: '' });
    const fail = createJsonOutput({ tool: 't', passed: false, exitCode: 1, sections: [], summary: '' });
    const error = createJsonOutput({ tool: 't', passed: false, exitCode: 2, sections: [], summary: '' });
    const noBrowser = createJsonOutput({ tool: 't', passed: false, exitCode: 3, sections: [], summary: '' });
    expect(pass.exitCode).toBe(0);
    expect(fail.exitCode).toBe(1);
    expect(error.exitCode).toBe(2);
    expect(noBrowser.exitCode).toBe(3);
  });

  it('JSON serialization is stable', () => {
    const output = createJsonOutput({
      tool: 'audit',
      file: 'x.css',
      passed: true,
      exitCode: 0,
      sections: [{ name: 'A', status: 'pass', violations: [], warnings: [] }],
      summary: 'ok',
    });
    const json = JSON.parse(JSON.stringify(output));
    expect(json.tool).toBe('audit');
    expect(json.schemaVersion).toBe(1);
    expect(json.sections).toHaveLength(1);
    expect(json.passed).toBe(true);
  });
});
