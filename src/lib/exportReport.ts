import type { ReportRow } from '../domain/types';
import { formatDuration } from '../domain/rules';

const COLUMNS: { key: keyof ReportRow | 'duration'; label: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'className', label: 'Turma' },
  { key: 'date', label: 'Data' },
  { key: 'time', label: 'Horário' },
  { key: 'quizScore', label: 'Pontuação do quiz' },
  { key: 'puzzleScore', label: 'Pontuação do quebra-cabeça' },
  { key: 'wordsScore', label: 'Pontuação da nuvem' },
  { key: 'totalScore', label: 'Pontuação final' },
  { key: 'duration', label: 'Tempo total' },
  { key: 'result', label: 'Resultado' },
  { key: 'quizAttempts', label: 'Tentativas do quiz' },
  { key: 'puzzleAttempts', label: 'Tentativas do quebra-cabeça' },
  { key: 'wordsAttempts', label: 'Tentativas da nuvem' },
  { key: 'errors', label: 'Erros' },
];

function cell(row: ReportRow, key: (typeof COLUMNS)[number]['key']) {
  if (key === 'duration') return formatDuration(row.totalTimeMs);
  const value = row[key];
  return value == null ? '' : String(value);
}

export function downloadCsv(rows: ReportRow[]) {
  const header = COLUMNS.map((column) => column.label).join(';');
  const body = rows
    .map((row) => COLUMNS.map((column) => csvEscape(cell(row, column.key))).join(';'))
    .join('\n');
  download('\uFEFF' + header + '\n' + body, 'relatorio-tour.csv', 'text/csv;charset=utf-8');
}

export function downloadExcel(rows: ReportRow[]) {
  const header = COLUMNS.map((column) => `<Cell><Data ss:Type="String">${xml(column.label)}</Data></Cell>`).join('');
  const body = rows
    .map((row) => {
      const cells = COLUMNS.map((column) => `<Cell><Data ss:Type="String">${xml(cell(row, column.key))}</Data></Cell>`).join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  const xmlDoc = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Resultados"><Table><Row>${header}</Row>${body}</Table></Worksheet>
</Workbook>`;
  download(xmlDoc, 'relatorio-tour.xls', 'application/vnd.ms-excel');
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
