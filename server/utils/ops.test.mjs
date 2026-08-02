import { describe, expect, it } from 'vitest';
import { buildHealthPayload, exportBackup } from './ops.js';
import fs from 'fs';
import path from 'path';

describe('ops helpers', () => {
  it('builds a health payload', () => {
    const payload = buildHealthPayload();
    expect(payload.status).toBe('ok');
    expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('exports a backup file', () => {
    const dir = path.join(process.cwd(), 'tmp-backups');
    const filePath = exportBackup(dir);
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
    fs.rmdirSync(dir);
  });
});
