import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as pause } from 'node:timers/promises';
import path from 'node:path';

// Actual workerd, deterministic AI stub. Never a hosted inference or deployment.
const out = path.resolve('.local/synthesis-runtime');
await mkdir(out, { recursive: true });
await writeFile(
  `${out}/worker.ts`,
  `
import worker from '../../workers/portfolio-api/src/index';
export default { async fetch(req) {
  let calls=0;
  const body=req.method==='POST'?await req.clone().json():{question:''};
  const sentences=[{text:'The program remains experimental.',passageIds:['ml-status']},{text:'Execution records are needed to substantiate completed evaluations.',passageIds:['ml-status']}];
  const AI={run:async()=>{calls++;if(calls>1)throw Error('Repeated inference');if(body.question.includes('quota'))throw Error('Private provider detail');return {response:{first:'ml-status',second:null,sentences:body.question.includes('fallback')?[]:sentences}};}};
  const limit={limit:async()=>({success:true})};
  const result=await worker.fetch(req,{AI,ASSISTANT_ENABLED:'true',MCP_ENABLED:'false',REQUEST_LIMITER:limit,INFERENCE_LIMITER:limit,MCP_LIMITER:limit});
  const response=new Response(result.body,result);response.headers.set('X-Test-Inferences',String(calls));return response;
}};
`,
);
await writeFile(
  `${out}/wrangler.json`,
  JSON.stringify({
    name: 'local-synthesis-runtime',
    main: 'worker.ts',
    compatibility_date: '2026-10-26',
    workers_dev: false,
    observability: { enabled: false },
  }),
);
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(
  process.execPath,
  [
    path.resolve('node_modules/wrangler/bin/wrangler.js'),
    'dev',
    '--config',
    `${out}/wrangler.json`,
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    `${out}/state`,
  ],
  {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
let output = '',
  exited = false;
for (const stream of [child.stdout, child.stderr])
  stream.on('data', (c) => (output = (output + c).slice(-6000)));
child.on('exit', () => (exited = true));
const endpoint = `http://127.0.0.1:${port}/ask`;
const headers = {
  Origin: 'https://jorgeaviles.net',
  'Content-Type': 'application/json',
  'CF-Connecting-IP': '192.0.2.1',
};
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (exited) throw Error(output);
    try {
      ready =
        (
          await fetch(endpoint, {
            method: 'OPTIONS',
            headers,
            signal: AbortSignal.timeout(300),
          })
        ).status === 204;
    } catch {
      /* startup only */
    }
    if (ready) break;
    await pause(100);
  }
  assert.ok(ready, output);
  for (const mode of ['summary', 'fallback', 'quota']) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question: `machine learning status ${mode}` }),
    });
    const b = await r.json();
    assert.equal(r.headers.get('X-Test-Inferences'), '1');
    if (mode === 'quota') {
      assert.equal(r.status, 503);
      assert.equal(b.status, 'unavailable');
      assert.ok(!JSON.stringify(b).includes('Private provider detail'));
    } else {
      assert.equal(b.status, 'answered');
      assert.ok(b.answer.includes('experimental'));
      assert.equal(b.references.length, 1);
      if (mode === 'summary') {
        assert.equal(b.sentences.length, 2);
        assert.deepEqual(b.sentences[0].sourceIndexes, [0]);
      } else assert.equal(b.sentences, undefined);
    }
  }
  console.log(
    'Actual workerd synthesis: sentence citations, extractive fallback, quota failure and single inference passed (mock AI only).',
  );
} finally {
  if (!exited)
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already stopped */
    }
}
