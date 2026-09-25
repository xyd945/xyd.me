import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const test = readFileSync(new URL('./check-permissions.sql', import.meta.url), 'utf8')
  .replace(/^\\set.*$/m, '')
  .replace(/^\\ir (.*)$/gm, (_line, path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
try {
  const results = await db.exec(test);
  console.log(results.at(-1).rows[0].result);
} finally {
  await db.close();
}
