#!/usr/bin/env node
// How fast the built site's key pages are on a mid-range phone, and whether they stay within
// perf-budgets.json. Serves dist/ the way GitHub Pages does (gzip), loads each page in Chrome with
// Lighthouse's mobile throttling (4x slower CPU, slow 4G), and reports per page:
//   kB       bytes downloaded (compressed) by the time the page is ready
//   total    bytes downloaded once the page has settled (background loads included)
//   FCP      first contentful paint
//   ready    when the page is usable: its "ready" selector is on screen (the practice setup once
//            its script has started, say), or the end of the load event for pages without one
//   ×typ     ready, as a multiple of the typical page's (the median of the "typical" pages, measured
//            in the same run). Unlike milliseconds, this doesn't depend on how fast the machine is.
//   TBT      total blocking time until the page settles: main-thread work past 50 ms per task,
//            which makes taps lag
//   CLS      cumulative layout shift: how much the page jumps while it loads
// Each page loads 3 times; the median counts.
//
// --check fails on what a slower or busier machine can't change: sizes, ×typ, and CLS. Over-budget
// milliseconds are warnings unless --strict (machines differ too much for them to fail CI).
//
//   npm run build && npm run perf             report
//   npm run perf -- --check                   fail if a page is over its budget (CI, on pull requests)
//   npm run perf -- --check --strict          millisecond budgets fail too
//   npm run perf -- --only practice           just the pages whose name includes "practice"
//   PERF_DIST=/other/dist npm run perf        another build, e.g. main's, to compare
//   PERF_DEBUG=1 npm run perf                 also list each request and long task
//   CHROME=/path/to/chrome npm run perf       a specific browser (default: google-chrome, chromium)
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
const DIST = process.env.PERF_DIST ?? join(ROOT, 'dist');
const budgets = JSON.parse(readFileSync(join(ROOT, 'perf-budgets.json'), 'utf8'));
const args = process.argv.slice(2);
const check = args.includes('--check');
const strict = args.includes('--strict');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const debug = !!process.env.PERF_DEBUG;
const RUNS = 3;
/** After "ready", how long to keep watching for late work, downloads, and layout shifts. */
const SETTLE_MS = 2000;
// The site's base path, as the build was made with (e.g. "/connorscurriculum/"); budgets list paths from the root.
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
/** Budget keys in milliseconds: warnings unless --strict. */
const TIMINGS = new Set(['fcp', 'ready', 'tbt']);

// Lighthouse's default mobile profile ("Slow 4G" and a 4x slower CPU).
const THROTTLE = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 };

if (!existsSync(join(DIST, 'index.html'))) fail(`No build in ${DIST}: run \`npm run build\` first.`);

// ---------------------------------------------------------------------------------------------
// A static server for dist/ with gzip, like GitHub Pages.

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf',
};
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg']);
const gzCache = new Map();

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith(BASE)) path = '/' + path.slice(BASE.length);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404).end();
  const ext = extname(file);
  const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
  let body = readFileSync(file);
  if (COMPRESS.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    if (!gzCache.has(file)) gzCache.set(file, gzipSync(body));
    body = gzCache.get(file);
    headers['content-encoding'] = 'gzip';
  }
  res.writeHead(200, headers).end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------------------------------------
// Chrome over the DevTools protocol (Node's built-in WebSocket; no extra dependencies).

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
  }
  fail('No Chrome found: install Chrome or Chromium, or set CHROME=/path/to/chrome.');
}

const profile = mkdtempSync(join(tmpdir(), 'perf-chrome-'));
const chrome = spawn(
  findChrome(),
  ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
const wsUrl = await new Promise((resolve, reject) => {
  let err = '';
  chrome.stderr.on('data', (d) => {
    err += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', () => reject(new Error(`Chrome exited:\n${err}`)));
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = new Set();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else for (const l of listeners) l(m);
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

/** Collected in the page from its first script on: first paint, long tasks, and layout shifts. */
const OBSERVE = `
  window.__perf = { fcp: null, longTasks: [], cls: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') __perf.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) __perf.longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) __perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
`;

/** Resolves with performance.now() once \`sel\` is on screen, or the load event ended (no selector). */
const readyWhen = (sel) => `new Promise((resolve) => {
  const sel = ${JSON.stringify(sel ?? null)};
  if (!sel) {
    const end = () => performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0;
    // The load event can still be running when this starts: wait for its end to be recorded.
    const wait = () => (end() > 0 ? resolve(end()) : setTimeout(wait, 20));
    return wait();
  }
  const found = () => { const el = document.querySelector(sel); return el && el.getClientRects().length > 0; };
  if (found()) return resolve(performance.now());
  new MutationObserver((_, o) => { if (found()) { o.disconnect(); resolve(performance.now()); } })
    .observe(document, { childList: true, subtree: true, attributes: true });
  setTimeout(() => resolve(-1), 30000);
})`;

async function measure(page) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (method, params) => send(method, params, sessionId);
  let bytes = 0;
  const urls = new Map();
  const files = [];
  let loadFired;
  const loaded = new Promise((r) => (loadFired = r));
  const onEvent = (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Page.loadEventFired') loadFired();
    if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url);
    if (m.method === 'Network.loadingFinished') {
      bytes += m.params.encodedDataLength;
      files.push([urls.get(m.params.requestId), m.params.encodedDataLength]);
    }
  };
  listeners.add(onEvent);
  try {
    await s('Page.enable');
    await s('Network.enable');
    await s('Network.setCacheDisabled', { cacheDisabled: true });
    await s('Network.emulateNetworkConditions', { offline: false, ...THROTTLE });
    await s('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpu });
    await s('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
    await s('Page.navigate', { url: origin + BASE + page.path.replace(/^\//, '') });
    await loaded;
    const ready = await s('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: readyWhen(page.ready) });
    const readyAt = ready.result.value;
    if (readyAt < 0) throw new Error(`${page.name}: "${page.ready}" never appeared`);
    const kb = bytes / 1024;
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const { result } = await s('Runtime.evaluate', { returnByValue: true, expression: 'JSON.stringify(window.__perf)' });
    const perf = JSON.parse(result.value);
    const tbt = perf.longTasks.reduce((t, [, d]) => t + Math.max(0, d - 50), 0);
    if (debug) {
      for (const [u, b] of files) console.error(`   ${String(Math.round(b / 1024)).padStart(5)} kB ${u?.replace(origin, '')}`);
      console.error(`${page.name}: ready ${Math.round(readyAt)} ms; long tasks (start+ms) ${perf.longTasks.map(([a, d]) => `${Math.round(a)}+${Math.round(d)}`).join(' ') || 'none'}`);
    }
    return { kb, total: bytes / 1024, fcp: perf.fcp ?? readyAt, ready: readyAt, tbt, cls: perf.cls };
  } finally {
    listeners.delete(onEvent);
    await send('Target.closeTarget', { targetId });
  }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const KEYS = ['kb', 'total', 'fcp', 'ready', 'tbt', 'cls'];

// ---------------------------------------------------------------------------------------------

const pages = budgets.pages.filter((p) => !only || p.name.includes(only) || p.typical);
const rows = [];
try {
  for (const page of pages) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(page));
    rows.push({ page, ...Object.fromEntries(KEYS.map((k) => [k, median(runs.map((r) => r[k]))])) });
  }
} finally {
  ws.close();
  const exited = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await exited;
  server.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const typical = median(rows.filter((r) => r.page.typical).map((r) => r.ready));
const failures = [];
const warnings = [];
for (const r of rows) {
  r.ratio = r.ready / typical;
  const limits = { ...budgets.default, ...r.page.budget };
  const values = { ...r, readyRatio: r.ratio };
  r.problems = [];
  for (const [k, max] of Object.entries(limits)) {
    if (!(k in values) || values[k] <= max) continue;
    const shown = k === 'cls' || k === 'readyRatio' ? values[k].toFixed(2) : Math.round(values[k]);
    const line = `${r.page.name} (${r.page.path}): ${k} ${shown} > ${max}`;
    r.problems.push(k);
    (TIMINGS.has(k) && !strict ? warnings : failures).push(line);
  }
}

const pad = (v, n) => String(v).padStart(n);
const shown = rows.filter((r) => !only || r.page.name.includes(only));
console.log(`\nMid-range phone: ${THROTTLE.cpu}x CPU, ${THROTTLE.latency} ms latency, 1.6 Mbps. Median of ${RUNS} loads.`);
console.log(`Typical page (median of the "typical" ones): ready at ${Math.round(typical)} ms.\n`);
console.log(`${'page'.padEnd(18)}${pad('kB', 6)}${pad('total', 7)}${pad('FCP', 7)}${pad('ready', 7)}${pad('×typ', 6)}${pad('TBT', 6)}${pad('CLS', 7)}`);
for (const r of shown) {
  console.log(
    `${r.page.name.padEnd(18)}${pad(Math.round(r.kb), 6)}${pad(Math.round(r.total), 7)}${pad(Math.round(r.fcp), 7)}${pad(Math.round(r.ready), 7)}` +
      `${pad(r.ratio.toFixed(1), 6)}${pad(Math.round(r.tbt), 6)}${pad(r.cls.toFixed(2), 7)}${r.problems.length ? '  over' : ''}`,
  );
}
console.log('\nkB: by ready; total: after settling. FCP, ready, TBT: ms. Budgets: perf-budgets.json.');
if (warnings.length) console.log(`\nOver a millisecond budget (a warning; --strict makes it fail):\n  ${warnings.join('\n  ')}`);
if (failures.length) {
  console.log(`\nOver budget:\n  ${failures.join('\n  ')}`);
  if (check) process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
