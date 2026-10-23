import { spawnSync } from 'node:child_process';

console.log(
  'Requesting the Site GitHub Actions workflow for main. Quality checks run first; production requires the enabled repository gate and configured production environment. See docs/deployment.md.',
);
const result = spawnSync(
  'gh',
  [
    'workflow',
    'run',
    'site.yml',
    '--repo',
    'jorgeaviles/jorgeaviles.net',
    '--ref',
    'main',
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(
    'Could not start GitHub CLI. Install gh and authenticate securely, then retry.',
  );
}
process.exitCode = result.status ?? 1;
