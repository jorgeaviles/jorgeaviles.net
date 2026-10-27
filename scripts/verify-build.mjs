import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

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

const files = await filesIn('dist');
const textFiles = files.filter((file) =>
  /\.(html|xml|txt|js|css|json|svg)$/.test(file),
);
const forbidden = [
  /\/Users\/[^\s<"']+/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const failures = [];
let links = 0;
for (const file of textFiles) {
  const text = await readFile(file, 'utf8');
  if (forbidden.some((pattern) => pattern.test(text)))
    failures.push(`Potential private information in ${file}`);
  if (!file.endsWith('.html')) continue;
  for (const match of text.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
    const href = match[1].split(/[?#]/)[0];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const target = path.join('dist', decodeURIComponent(href));
    try {
      const info = await stat(target);
      if (info.isDirectory()) await stat(path.join(target, 'index.html'));
      links++;
    } catch {
      failures.push(`Broken first-party link ${href} in ${file}`);
    }
  }
}

// Even an unpublished entry must be safe to commit. This separately guards output.
const publicText = (
  await Promise.all(
    files
      .filter((file) => /\.(html|xml)$/.test(file))
      .map((file) => readFile(file, 'utf8')),
  )
).join('\n');
for (const file of await filesIn('src/content')) {
  const text = await readFile(file, 'utf8');
  if (/^draft:\s*true\s*$/m.test(text)) {
    const id = path.basename(file, path.extname(file));
    const title = text
      .match(/^title:\s*(.+)$/m)?.[1]
      ?.replace(/^["']|["']$/g, '');
    if (publicText.includes(`/${id}/`) || (title && publicText.includes(title)))
      failures.push(`Draft leaked into output: ${file}`);
  }
}
await stat('dist/404.html');
const home = await readFile('dist/index.html', 'utf8');
const lab = await readFile('dist/lab/index.html', 'utf8');
if (home.includes('<astro-island')) failures.push('Home page must stay static');
if (!lab.includes('<astro-island')) failures.push('Lab island missing');
// The consolidated research URL must retain a usable static fallback and host rules.
const oldResearch = '/work/applied-predictive-research/';
const redirectHtml = await readFile(`dist${oldResearch}index.html`, 'utf8');
const redirectRules = await readFile('dist/_redirects', 'utf8');
const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
for (const oldPath of [
  oldResearch.slice(0, -1),
  oldResearch,
  `${oldResearch}index.html`,
]) {
  if (!redirectRules.split('\n').includes(`${oldPath} /research/ 301`))
    failures.push(`Research permanent redirect missing: ${oldPath}`);
}
if (
  !redirectHtml.includes('content="0;url=/research/"') ||
  !redirectHtml.includes(
    'rel="canonical" href="https://jorgeaviles.net/research/"',
  )
)
  failures.push('Research redirect fallback or canonical is missing.');
if (
  sitemap.includes(oldResearch) ||
  !sitemap.includes('https://jorgeaviles.net/research/')
)
  failures.push('Research consolidation is inconsistent with the sitemap.');
if (failures.length) throw new Error(failures.join('\n'));
console.log(
  `Build verified: ${links} first-party link references, ${textFiles.length} text assets, static home, lab island, privacy patterns, and draft exclusion.`,
);
