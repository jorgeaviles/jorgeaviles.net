import { readFile, writeFile } from 'node:fs/promises';
const destination = 'workers/portfolio-api/index.json';
const generated =
  JSON.stringify(
    JSON.parse(await readFile('dist/portfolio-index.json', 'utf8')),
    null,
    2,
  ) + '\n';
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')) !== generated)
    throw new Error(
      'Portfolio index changed. Review approved excerpts, then run npm run assistant:index.',
    );
} else {
  await writeFile(destination, generated);
}
