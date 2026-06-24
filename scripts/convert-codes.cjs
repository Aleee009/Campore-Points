const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const INPUT_FILE = path.join(__dirname, '..', 'public', 'files', 'Codigos.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'codes.js');

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`No se encontró el archivo: ${INPUT_FILE}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Lee la hoja como array de arrays para tener control absoluto de columnas
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const codes = {};

  // Ignora la primera fila (encabezados)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const code = String(row[0] || '').trim().toUpperCase();
    const club = String(row[1] || '').trim();
    const iglesia = String(row[2] || '').trim();

    if (!code) continue;

    codes[code] = { club, iglesia };
  }

  const entries = Object.entries(codes);
  if (entries.length === 0) {
    console.error('No se encontraron códigos en el Excel.');
    process.exit(1);
  }

  const lines = [
    '// Archivo generado automáticamente por scripts/convert-codes.cjs',
    '// No editar manualmente. Actualizar public/files/Codigos.xlsx y volver a ejecutar el script.',
    '',
    'export const TEAM_CODES = {',
  ];

  for (const [code, { club, iglesia }] of entries) {
    lines.push(`  "${code}": { club: ${JSON.stringify(club)}, iglesia: ${JSON.stringify(iglesia)} },`);
  }

  lines.push('};', '');
  lines.push('/** Busca un código y devuelve el texto a mostrar: "Club — Iglesia" */');
  lines.push('export function getTeamDisplay(code) {');
  lines.push('  const upper = code?.trim().toUpperCase();');
  lines.push('  const data = TEAM_CODES[upper];');
  lines.push('  if (!data) return null;');
  lines.push('  return `${data.club} — ${data.iglesia}`;');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log(`Generado ${OUTPUT_FILE} con ${entries.length} códigos.`);
}

main();
