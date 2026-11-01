import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = '.local/assistant-evaluation';
await mkdir(out, { recursive: true });
const baselineCommit = '2f94772e59d5550db12bff37cb2ff063621986ea';
const options = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
};
await build({
  ...options,
  entryPoints: ['evals/portfolio/baseline-worker.ts'],
  outfile: `${out}/baseline-worker.mjs`,
});
for (const [entry, name] of [
  ['workers/portfolio-api/src/index.ts', 'candidate-worker'],
  ['workers/portfolio-api/src/content.ts', 'baseline-content'],
  ['workers/portfolio-api/src/assistant-retrieval.ts', 'candidate-content'],
  ['evals/portfolio/evaluate.ts', 'evaluate'],
])
  await build({
    ...options,
    entryPoints: [entry],
    outfile: `${out}/${name}.mjs`,
  });
const load = (name) => import(path.resolve(`${out}/${name}.mjs`));
const [
  { default: baseline },
  { default: candidate },
  { index, searchPortfolio },
  { searchAssistant },
  { evaluate, evaluateFaults },
] = await Promise.all(
  [
    'baseline-worker',
    'candidate-worker',
    'baseline-content',
    'candidate-content',
    'evaluate',
  ].map(load),
);
const dataset = JSON.parse(
  await readFile('evals/portfolio/cases.json', 'utf8'),
);
assert.equal(
  dataset.indexVersion,
  index.version,
  'Index changed: review evaluation annotations before updating the version',
);
const results = {
  baselineCommit,
  indexVersion: index.version,
  model: '@cf/meta/llama-3.2-3b-instruct',
  baseline: await evaluate(
    baseline,
    searchPortfolio,
    dataset.cases,
    index,
    'legacy',
  ),
  candidate: await evaluate(candidate, searchAssistant, dataset.cases, index),
  faults: {
    baseline: await evaluateFaults(baseline),
    candidate: await evaluateFaults(candidate),
  },
};
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + '\n');
console.log('DETERMINISTIC ORACLE MOCKS — NOT LIVE MODEL ACCURACY');
for (const name of ['baseline', 'candidate']) {
  const t = results[name].totals;
  console.log(name, JSON.stringify(t));
  console.log(
    `Recall ${t.relevantRetrieved}/${t.relevantExpected}; full coverage ${t.fullRetrievalCoverage}/${t.supported}; supported answers ${t.answeredSupported}/${t.supported}; false refusals ${t.falseRefusals}/${t.supported}; unsupported refusals ${t.refusedUnsupported}/${t.unsupported}; false accepts ${t.falseAcceptances}/${t.unsupported}; citations ${t.citationsCorrect}/${t.citations}; required source coverage ${t.selectedRelevant}/${t.requiredExpected}; unrelated selections ${t.unrelatedSelected}/${t.selected}; qualification cases ${t.qualificationsPreserved}/${t.qualificationCases}; MRR ${(t.reciprocalRankSum / t.supported).toFixed(3)}. Injected faults refused ${results.faults[name].refused}/${results.faults[name].total}.`,
  );
}
assert.ok(
  results.candidate.totals.relevantRetrieved >=
    results.baseline.totals.relevantRetrieved,
);
assert.equal(results.candidate.totals.falseAcceptances, 0);
assert.equal(
  results.candidate.totals.citationsCorrect,
  results.candidate.totals.citations,
);
assert.ok(results.candidate.totals.maxInferenceCalls <= 1);
