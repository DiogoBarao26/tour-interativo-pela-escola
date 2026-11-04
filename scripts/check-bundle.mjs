import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const forbidden = ['desrespeito', 'Saber para transformar', 'Portas Abertas', 'desperdício'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(js|css|html)$/.test(name) ? [full] : [];
  });
}

const hits = [];
for (const file of files('dist')) {
  const text = readFileSync(file, 'utf8');
  for (const term of forbidden) {
    if (text.includes(term)) hits.push(`${file} contém "${term}"`);
  }
}

if (hits.length > 0) {
  console.error(hits.join('\n'));
  process.exit(1);
}

console.log('O pacote publicado não contém o gabarito de demonstração.');
