import { describe, expect, it } from 'vitest';
import { exportCsv, importCsv, saveExport } from './bulk.js';
import fs from 'fs';
import path from 'path';

describe('bulk helpers', () => {
  it('exports CSV rows', () => {
    const csv = exportCsv([{ name: 'Ada', email: 'ada@example.com' }], ['name', 'email']);
    expect(csv).toContain('name,email');
    expect(csv).toContain('Ada');
  });

  it('imports CSV rows', () => {
    const filePath = path.join(process.cwd(), 'tmp-import.csv');
    fs.writeFileSync(filePath, 'name,email\nAda,ada@example.com');
    const rows = importCsv(filePath);
    expect(rows[0].name).toBe('Ada');
    fs.unlinkSync(filePath);
  });

  it('saves an export file', () => {
    const filePath = saveExport([{ name: 'Ada' }], ['name'], path.join(process.cwd(), 'tmp-exports'));
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath));
  });
});
