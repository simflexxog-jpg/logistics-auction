const fs = require('fs');
const path = require('path');

function normalizeRows(rows = []) {
  return rows.filter(Boolean).map((row) => ({ ...row }));
}

function exportCsv(rows = [], headers = []) {
  const normalizedRows = normalizeRows(rows);
  if (!normalizedRows.length) return '';
  const resolvedHeaders = headers.length ? headers : Object.keys(normalizedRows[0]);
  const headerLine = resolvedHeaders.join(',');
  const body = normalizedRows.map((row) => resolvedHeaders.map((header) => {
    const value = row[header];
    const safe = value === null || value === undefined ? '' : String(value).replace(/"/g, '""');
    return `"${safe}"`;
  }).join(','));
  return [headerLine, ...body].join('\n');
}

function importCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((header) => header.replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.match(/("(?:[^"]|"")*"|[^,]+)/g) || [];
    return headers.reduce((acc, header, index) => {
      const value = values[index] ? values[index].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
      acc[header] = value;
      return acc;
    }, {});
  });
}

function saveExport(rows = [], headers = [], outputDir = path.join(process.cwd(), 'exports')) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `export-${timestamp}.csv`);
  fs.writeFileSync(filePath, exportCsv(rows, headers));
  return filePath;
}

module.exports = { normalizeRows, exportCsv, importCsv, saveExport };
