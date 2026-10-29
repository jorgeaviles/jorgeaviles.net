import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const localDirectory = path.join(root, '.local');
await mkdir(localDirectory, { recursive: true });
const temporaryProject = await mkdtemp(
  path.join(localDirectory, 'publication-test-'),
);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? filesIn(file) : file;
      }),
    )
  ).flat();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

try {
  await Promise.all(
    ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json'].map(
      (file) =>
        cp(path.join(root, file), path.join(temporaryProject, file), {
          recursive: true,
        }),
    ),
  );
  await symlink(
    path.join(root, 'node_modules'),
    path.join(temporaryProject, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const nonce = randomUUID().replaceAll('-', '');
  const fixtures = ['work', 'research', 'lab'].map((collection) => ({
    collection,
    id: `publication-draft-${collection}-${nonce}`,
    title: `PublicationDraft${collection}Title${nonce}`,
    description: `PublicationDraft${collection}Description${nonce}`,
    body: `PublicationDraft${collection}Body${nonce}`,
  }));

  // These safe fixtures exist only in the disposable copy. Every collection must
  // pass through the real publication boundary used by routes and indexes.
  await Promise.all(
    fixtures.map((fixture) =>
      writeFile(
        path.join(
          temporaryProject,
          'src',
          'content',
          fixture.collection,
          `${fixture.id}.mdx`,
        ),
        [
          '---',
          `title: ${fixture.title}`,
          `description: ${fixture.description}`,
          'category: Safe publication regression fixture',
          'order: 999',
          'featured: true',
          'draft: true',
          '---',
          '',
          fixture.body,
          '',
        ].join('\n'),
      ),
    ),
  );

  const curatedPath = path.join(
    temporaryProject,
    'src/content/portfolio-assistant.json',
  );
  const curated = JSON.parse(await readFile(curatedPath, 'utf8'));
  for (const fixture of fixtures.filter((item) => item.collection !== 'lab')) {
    curated.push({
      id: fixture.id,
      kind: fixture.collection === 'work' ? 'project' : 'research',
      path:
        fixture.collection === 'work' ? `/work/${fixture.id}/` : '/research/',
      title: fixture.title,
      passages: [{ id: fixture.id, text: fixture.body, keywords: 'fixture' }],
    });
  }
  await writeFile(curatedPath, JSON.stringify(curated));

  const astroPackage = JSON.parse(
    await readFile(path.join(root, 'node_modules/astro/package.json'), 'utf8'),
  );
  const astroExecutable = path.resolve(
    root,
    'node_modules/astro',
    typeof astroPackage.bin === 'string'
      ? astroPackage.bin
      : astroPackage.bin.astro,
  );
  try {
    await run(process.execPath, [astroExecutable, 'build'], {
      cwd: temporaryProject,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    const output = [error.stdout, error.stderr]
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .slice(-20)
      .join('\n')
      .slice(-4000);
    throw new Error(`Publication regression build failed.\n${output}`, {
      cause: error,
    });
  }

  const dist = path.join(temporaryProject, 'dist');
  const publicFiles = (await filesIn(dist)).filter((file) =>
    /\.(html|xml|json)$/.test(file),
  );
  if (!publicFiles.length)
    throw new Error('The copied build produced no pages.');

  const failures = [];
  for (const file of publicFiles) {
    const content = await readFile(file, 'utf8');
    for (const fixture of fixtures) {
      if (
        [fixture.id, fixture.title, fixture.description, fixture.body].some(
          (marker) => content.includes(marker),
        )
      ) {
        failures.push(
          `${fixture.collection} draft appeared in ${path.relative(dist, file)}`,
        );
      }
    }
  }

  const workFixture = fixtures.find((fixture) => fixture.collection === 'work');
  if (await exists(path.join(dist, 'work', workFixture.id, 'index.html'))) {
    failures.push('An unpublished work entry generated a public route.');
  }

  for (const expected of [
    'index.html',
    'about/index.html',
    'work/index.html',
    'work/analytical-data-platforms/index.html',
    'work/applied-predictive-research/index.html',
    'work/analytical-applications/index.html',
    'research/index.html',
    'lab/index.html',
    'contact/index.html',
    'colophon/index.html',
    '404.html',
    'sitemap-index.xml',
    'sitemap-0.xml',
  ]) {
    if (!(await exists(path.join(dist, expected)))) {
      failures.push(`Expected published output is missing: ${expected}`);
    }
  }

  if (failures.length) throw new Error(failures.join('\n'));
  console.log(
    `Publication regression passed: three draft fixtures excluded from ${publicFiles.length} HTML/XML files; published pages and sitemap remain present.`,
  );
} finally {
  await rm(temporaryProject, { recursive: true, force: true });
}
