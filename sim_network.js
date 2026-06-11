// Simulation for the IEEE Access v2 paper:
// the universal consolidation network (free consolidation family + satellite
// rings under the unfolding operation r), in two regimes:
//   (1) the ABSTRACT regime: literal padded codes of Section VI -- quadratic
//       padding 2(|c|+1)^2, top-level strip, the operation r, ev, Can;
//   (2) the INTEGER-ID regime: a realized finite trajectory of the envelope
//       (R consolidators per stage + their rings), used for scale.
// Deterministic PRNG so every run reproduces the published numbers.
'use strict';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function median(xs) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

// ======================================================================
// PART 1 -- ABSTRACT REGIME: literal padded codes
// ======================================================================
// Code alphabet: '<' '>' ',' = list structure; '#' = the padding square;
// lower-case letters = seed raw symbols; digits = ring-index numerals.
// Conventions (Section VI):
//   seed   = <raw, #^s>            padded to 2(|raw|+1)^2
//   hub    = <x_1,...,x_k, #^s>    x_1 < ... < x_k strict length-lex,
//                                  padded to L = 2(|<x_1..x_k>|+1)^2
//   sat    = <hat(d), j, #^s>      padded to the RING length L(d)
// |list of k items| = sum|items| + k + 1   (brackets + k-1 commas, the pad
// block is a comma-separated item -- same convention as Section V).

const PAD = '#';

function listLen(items) { return items.reduce((a, s) => a + s.length, 0) + items.length + 1; }
function mkList(items) { return '<' + items.join(',') + '>'; }

function padTo(items, L) {
  // append one pad item #^s so the total list length is exactly L
  const base = listLen(items) + 1; // +1: the pad item adds one more separator
  const s = L - base;
  if (s < 0) throw new Error('padding underflow: need ' + (-s) + ' more room');
  return mkList([...items, PAD.repeat(s)]);
}

// Uniform per-level length, as in Section V's P_n.  Arity is capped at NMAX, so
// every depth-d hub (and its satellite ring) pads to the SAME length P_d, the
// largest a depth-d hub can need:  P_0 = 2(maxRaw+1)^2,  P_d = 2(NMAX(P_{d-1}+1)+1)^2.
const NMAX = 4;
let P0 = 18;                                 // = 2(maxRaw+1)^2; set per regime
function setMaxRaw(r) { P0 = 2 * (r + 1) * (r + 1); }
function Pd(d) { let p = P0; for (let i = 0; i < d; i++) p = 2 * (NMAX * (p + 1) + 1) * (NMAX * (p + 1) + 1); return p; }

function mkSeed(raw) {
  return padTo([raw], P0);                   // every seed padded to the common P_0
}
// strict length-lex order on codes (shorter first, then lexicographic)
function lexLess(a, b) { return a.length !== b.length ? a.length < b.length : a < b; }

function topItems(code) {
  // split a code <i1,...,ik> into top-level items
  const items = []; let depth = 0, cur = '';
  for (let i = 1; i < code.length - 1; i++) {
    const ch = code[i];
    if (ch === '<') depth++;
    if (ch === '>') depth--;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; }
    else cur += ch;
  }
  items.push(cur);
  return items;
}
function strip(code) {
  // remove the top-level pad item ("hat")
  const items = topItems(code);
  if (!items[items.length - 1].split('').every(c => c === PAD)) throw new Error('no pad item');
  return mkList(items.slice(0, -1));
}
function isNumeral(s) { return /^[0-9]+$/.test(s); }
function isPadItem(s) { return s.length > 0 && s.split('').every(c => c === PAD); }

// shape discrimination: seed | hub | sat  (Section VI shape lemma)
function shape(code) {
  const it = topItems(code);
  if (!isPadItem(it[it.length - 1])) return 'malformed';
  const body = it.slice(0, -1);
  if (body.length === 1 && /^[a-z]+$/.test(body[0])) return 'seed';
  if (body.length === 2 && body[0].startsWith('<') && isNumeral(body[1])) return 'sat';
  if (body.length >= 2 && body.every(x => x.startsWith('<'))) return 'hub';
  return 'malformed';
}

function mkHub(comps) {
  const sorted = [...comps].sort((a, b) => (lexLess(a, b) ? -1 : 1));
  for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i] === sorted[i + 1]) throw new Error('duplicate component');
  if (sorted.length > NMAX) throw new Error('arity exceeds NMAX');
  const d = 1 + Math.max(...sorted.map(depth));
  return padTo(sorted, Pd(d));               // every depth-d hub padded to the common P_d
}

function comps(code) {
  // top-level components of a hub (empty for seeds and satellites)
  if (shape(code) !== 'hub') return [];
  const it = topItems(code);
  return it.slice(0, -1);
}
function arity(code) {
  const sh = shape(code);
  if (sh === 'hub') return comps(code).length;
  return 2; // seeds: ring of 2 (k(d) = max(2, #comps))
}
// the unfolding operation r: d -> m_1 -> ... -> m_k -> d, all of length L(d)
function rOp(code) {
  const sh = shape(code);
  const L = code.length;
  if (sh === 'seed' || sh === 'hub') {
    const hat = sh === 'hub' ? strip(code) : topItems(code)[0]; // hat(seed) = raw
    return padTo([sh === 'hub' ? hat : '<' + hat + '>', '1'], L); // sat slot 1 holds a LIST
  }
  if (sh === 'sat') {
    const it = topItems(code); const hat = it[0]; const j = parseInt(it[1], 10);
    // reconstruct the host
    const inner = topItems('<' + hat.slice(1, -1) + '>');
    let host;
    if (inner.length === 1 && /^[a-z]+$/.test(inner[0])) host = mkSeed(inner[0]);
    else host = padTo(inner, Pd(1 + Math.max(...inner.map(depth))));
    const k = arity(host);
    if (j < k) return padTo([hat, String(j + 1)], L);
    return host;
  }
  throw new Error('r on malformed code');
}
// ev on closed r-terms: term = ['r', term] | code
function ev(t) { return typeof t === 'string' ? t : rOp(ev(t[1])); }
function termLen(t) { return typeof t === 'string' ? t.length : termLen(t[1]) + 4; } // <r, t> ~ +4

function canCheck(code) {
  // canonical-code recognizer (recursive)
  const sh = shape(code);
  if (sh === 'malformed') return false;
  const it = topItems(code);
  if (sh === 'seed') return code.length === P0;
  if (sh === 'hub') {
    const body = it.slice(0, -1);
    if (body.length > NMAX) return false;
    for (let i = 0; i + 1 < body.length; i++) if (!lexLess(body[i], body[i + 1])) return false;
    if (!body.every(canCheck)) return false;
    return code.length === Pd(1 + Math.max(...body.map(depth)));
  }
  // sat
  const hat = it[0]; const j = parseInt(it[1], 10);
  const inner = topItems('<' + hat.slice(1, -1) + '>');
  let host;
  try {
    host = (inner.length === 1 && /^[a-z]+$/.test(inner[0])) ? mkSeed(inner[0]) : padTo(inner, Pd(1 + Math.max(...inner.map(depth))));
  } catch (e) { return false; }
  if (!canCheck(host)) return false;
  return code.length === host.length && j >= 1 && j <= arity(host);
}

function depth(code) {
  const sh = shape(code);
  if (sh === 'seed') return 0;
  if (sh === 'sat') { // depth of host
    const it = topItems(code); const inner = topItems('<' + it[0].slice(1, -1) + '>');
    if (inner.length === 1 && /^[a-z]+$/.test(inner[0])) return 0;
    return 1 + Math.max(...inner.map(depth));
  }
  return 1 + Math.max(...comps(code).map(depth));
}

// attributes (p-computable from codes, short numerals; FBC trivially)
function vol(code) { const sh = shape(code); return sh === 'hub' ? arity(code) : (sh === 'sat' ? volHostOf(code) : 1); }
function volHostOf(satCode) {
  const it = topItems(satCode); const inner = topItems('<' + it[0].slice(1, -1) + '>');
  if (inner.length === 1 && /^[a-z]+$/.test(inner[0])) return 1;
  return inner.length;
}
function sp(u, v) { return 1 + ((vol(u) + vol(v)) % 3); }       // speed class 1..3
function tau(u, v) { return Math.ceil(6 / sp(u, v)); }          // transit time
function kap(u, v) { return 10 * Math.min(vol(u), vol(v)); }    // capacity

// neighbours: f_nb(u) = <r(u)> ^ comps(u)
function nb(code) { return [rOp(code), ...comps(code)]; }

// memoized bounded ball walk (Algorithm 1): budgeted reachability
function queryAbs(u, v, m, t, d0) {
  const best = new Map([[u, 0]]);
  let F = [u];
  for (let h = 1; h <= m; h++) {
    const Fp = [];
    for (const x of F) {
      for (const y of nb(x)) {
        if (kap(x, y) < d0) continue;
        const a = best.get(x) + tau(x, y);
        if (a <= t && (!best.has(y) || a < best.get(y))) { best.set(y, a); Fp.push(y); }
      }
    }
    if (best.has(v) && best.get(v) <= t) return { yes: true, eta: best.get(v) };
    F = Fp;
  }
  return { yes: false, eta: best.has(v) ? best.get(v) : 'unreachable' };
}

// ---------------------------------------------------------------------
// Worked instance (Section VI-D) -- exact codes, replayed bit-for-bit
// ---------------------------------------------------------------------
console.log('# ============ ABSTRACT REGIME ============');
console.log('# Worked instance');
setMaxRaw(2);                                // seeds of raw length 2 -> P_0 = 18
const A = mkSeed('aa'), B = mkSeed('bb'), C = mkSeed('cc');
console.log(`|A|=${A.length} |B|=${B.length} |C|=${C.length}  (P_0 = 2*(2+1)^2 = ${P0})`);
const H = mkHub([A, B]);
console.log(`H = <A,B,#^s>: |H|=${H.length}  = P_1 = 2*(4*(P_0+1)+1)^2 = ${Pd(1)}  s=${topItems(H)[2].length}`);
const m1 = rOp(H), m2 = rOp(m1), back = rOp(m2);
console.log(`|m1|=${m1.length} |m2|=${m2.length}  s_j=${topItems(m1)[2].length}  r(m2)==H: ${back === H}  (ring length = P_1, uniform)`);
console.log(`ev(r(r(H))) == m2: ${ev(['r', ['r', H]]) === m2}`);
console.log(`depth: A=${depth(A)} H=${depth(H)}`);
// G = <C,H> is depth 2: P_2 is astronomically long, so we report it symbolically
// (emergence needs only the depth, never the materialised G code).
const Gdepth = 1 + Math.max(depth(C), depth(H));
console.log(`G=<C,H>: depth=${Gdepth}, |G| = P_${Gdepth} = ${Pd(Gdepth)}  (availability: n=1 NO, n=2 YES)`);
console.log(`vol(H)=${vol(H)} vol(A)=${vol(A)}  tau(H,A)=${tau(H, A)} kappa(H,A)=${kap(H, A)}`);
console.log(`ring legs: tau(H,m1)=${tau(H, m1)} tau(m1,m2)=${tau(m1, m2)} tau(m2,H)=${tau(m2, H)}  milk-run=${tau(H, m1) + tau(m1, m2) + tau(m2, H)}`);
const q1 = queryAbs(H, A, 2, 6, 10), q2 = queryAbs(H, A, 2, 5, 10);
console.log(`ETA H->A (m=2,d0=10): t=6 -> ${q1.yes} (eta ${q1.eta});  t=5 -> ${q2.yes}`);

// EXP-A: validity
console.log('# EXP-A: validity checks');
let okCan = [A, B, C, H, m1, m2].every(canCheck);
const mutants = [
  mkList([B, A, PAD.repeat(H.length - listLen([B, A]) - 1)]),       // unsorted
  mkList([A, A, PAD.repeat(H.length - listLen([A, A]) - 1)]),       // duplicate
  mkList([A, B, PAD.repeat(H.length - listLen([A, B]) - 1 - 7)]),   // bad padding
];
let rejected = mutants.filter(x => !canCheck(x)).length;
console.log(`Can accepts built codes: ${okCan};  mutants rejected: ${rejected}/3`);
let fbcOK = true;
{
  const rnd = mulberry32(5);
  for (let i = 0; i < 200; i++) {
    let t = [A, B, C, H, m1][Math.floor(rnd() * 5)];
    const wraps = 1 + Math.floor(rnd() * 6);
    for (let w = 0; w < wraps; w++) t = ['r', t];
    if (ev(t).length > termLen(t)) { fbcOK = false; break; }
  }
}
console.log(`|ev(t)| <= |t| on 200 random r-terms: ${fbcOK}`);
let homeOK = true;
for (const d of [A, H]) {
  let x = rOp(d); let steps = 1;
  while (x !== d) { x = rOp(x); steps++; if (steps > 99) { homeOK = false; break; } }
  if (steps !== arity(d) + 1) homeOK = false;
}
console.log(`r returns home around every ring in k(d)+1 steps: ${homeOK}`);

// ---------------------------------------------------------------------
// EXP-B: query time vs code length L (grid: seed raw size x arity), m in {2,8,20}
// ---------------------------------------------------------------------
console.log('# EXP-B: query time vs |code| (abstract codes), m in {2,8,20}');
console.log('# raw L  us_m2 us_m8 us_m20');
// With uniform P_d the depth-1 length P_1 depends only on the seed size (arity no
// longer changes the length), so we scale the code length by the seed raw size;
// depth 2 (P_2 ~ 4.5e9) is unmaterialisable.
for (const rw of [2, 3, 4, 5, 6, 8, 10]) {
  setMaxRaw(rw);
  const seeds = [mkSeed('a'.repeat(rw)), mkSeed('b'.repeat(rw))];
  const hub = mkHub(seeds), tgt = seeds[1], L = hub.length;
  const us = [];
  for (const m of [2, 8, 20]) {
    const ts = [];
    for (let rep = 0; rep < 5; rep++) {
      const t0 = process.hrtime.bigint();
      queryAbs(hub, tgt, m, 1e9, 0);
      const t1 = process.hrtime.bigint();
      ts.push(Number(t1 - t0) / 1e3);
    }
    us.push(median(ts));
  }
  console.log(`${rw} ${L} ${us[0].toFixed(1)} ${us[1].toFixed(1)} ${us[2].toFixed(1)}`);
}
setMaxRaw(2);

// ---------------------------------------------------------------------
// EXP-C: FBC ablation on r -- exact symbolic code lengths (BigInt)
// ---------------------------------------------------------------------
console.log('# EXP-C: ablation -- code length under t applications of r');
console.log('# t  compliant  noStripLog10  noPad');
{
  let compliant = 11858n;        // = P_1, the ring length of H
  let noStrip = 11858n;          // r~ : quadratic re-padding WITHOUT the strip: L' = 2(L+5)^2
  let noPad = 11858n;            // r~~: history nesting, no padding: L' = L+4
  const log10 = (x) => x.toString().length - 1 + Math.log10(Number('0.' + x.toString().slice(0, 15)) * 10);
  for (let t = 0; t <= 20; t++) {
    console.log(`${t} ${compliant} ${log10(noStrip).toFixed(2)} ${noPad}`);
    noStrip = 2n * (noStrip + 5n) * (noStrip + 5n);
    noPad = noPad + 4n;
  }
}

// ======================================================================
// PART 2 -- INTEGER-ID REGIME: a realized trajectory of the envelope
// ======================================================================
// Each stage: R new consolidators, each over a sorted 2-4-tuple of distinct
// hubs drawn from a recency window W, plus its satellite ring (k = arity).
// Out-degree is bounded BY CONSTRUCTION: hub k+1 (feeders + ring), sat 1.
const R_NEW = 5, W = 100;

function newTraj(seedCount) {
  const tr = { kind: [], comp: [], ring: [], host: [], volv: [], hubs: [], nNodes: 0 };
  for (let i = 0; i < seedCount; i++) addNode(tr, 'seed', [], 1);
  for (let i = 0; i < seedCount; i++) addRing(tr, i, 2);
  return tr;
}
function addNode(tr, kind, comp, volv) {
  tr.kind.push(kind); tr.comp.push(comp); tr.ring.push(null); tr.host.push(-1); tr.volv.push(volv);
  if (kind !== 'sat') tr.hubs.push(tr.nNodes);
  return tr.nNodes++;
}
function addRing(tr, d, k) {
  const ring = [];
  for (let j = 0; j < k; j++) { const s = addNode(tr, 'sat', [], tr.volv[d]); tr.host[s] = d; ring.push(s); }
  tr.ring[d] = ring;
}
function applyStage(tr, rnd) {
  for (let c = 0; c < R_NEW; c++) {
    const lo = Math.max(0, tr.hubs.length - W);
    const avail = tr.hubs.length - lo;
    const k = Math.min(2 + Math.floor(rnd() * 3), avail); // arity 2..4, capped by window supply
    const pick = new Set();
    while (pick.size < k) pick.add(tr.hubs[lo + Math.floor(rnd() * (tr.hubs.length - lo))]);
    const compArr = [...pick].sort((a, b) => a - b);
    const d = addNode(tr, 'hub', compArr, k);
    addRing(tr, d, k);
  }
}
function nbInt(tr, x) {
  const out = [];
  if (tr.kind[x] === 'sat') {
    const h = tr.host[x], ring = tr.ring[h], j = ring.indexOf(x);
    out.push(j + 1 < ring.length ? ring[j + 1] : h);
  } else {
    out.push(tr.ring[x][0], ...tr.comp[x]);
  }
  return out;
}
function spInt(tr, u, v) { return 1 + ((tr.volv[u] + tr.volv[v]) % 3); }
function tauInt(tr, u, v) { return Math.ceil(6 / spInt(tr, u, v)); }
function kapInt(tr, u, v) { return 10 * Math.min(tr.volv[u], tr.volv[v]); }

function queryInt(tr, A0, B0, m, t, d0) {
  if (A0 === B0) return { yes: t >= 0, eta: 0 };
  const best = new Map([[A0, 0]]);
  let F = [A0];
  for (let h = 1; h <= m; h++) {
    const Fp = [];
    for (const u of F) {
      for (const v of nbInt(tr, u)) {
        if (kapInt(tr, u, v) < d0) continue;
        const a = best.get(u) + tauInt(tr, u, v);
        if (a <= t && (!best.has(v) || a < best.get(v))) { best.set(v, a); Fp.push(v); }
      }
    }
    if (best.has(B0) && best.get(B0) <= t) return { yes: true, eta: best.get(B0) };
    F = Fp;
  }
  return { yes: false, eta: best.has(B0) ? best.get(B0) : 'unreachable' };
}

console.log('# ============ INTEGER-ID REGIME (realized trajectory) ============');
console.log('# EXP-D: build time vs n  (R=' + R_NEW + ' consolidators/stage + rings)');
console.log('# n  nodes  buildMs');
{ // warmup
  const rnd = mulberry32(1); const tr = newTraj(3);
  for (let i = 0; i < 16000; i++) applyStage(tr, rnd);
}
for (const n of [250, 500, 1000, 2000, 4000, 8000, 16000]) {
  const times = []; let nodes = 0;
  for (let rep = 0; rep < 9; rep++) {
    const rnd = mulberry32(42 + rep);
    const tr = newTraj(3);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) applyStage(tr, rnd);
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
    nodes = tr.nNodes;
  }
  console.log(`${n} ${nodes} ${median(times).toFixed(2)}`);
}

console.log('# EXP-E: query time at m=8 vs n (median of 21 pairs x 5 reps), microseconds');
console.log('# n  nodes  queryUs');
for (const n of [500, 1000, 2000, 4000, 8000, 16000]) {
  const rnd = mulberry32(42);
  const tr = newTraj(3);
  for (let i = 0; i < n; i++) applyStage(tr, rnd);
  const pairRnd = mulberry32(7);
  const pairs = [];
  for (let i = 0; i < 21; i++) {
    const a = tr.hubs[Math.floor(pairRnd() * Math.min(100, tr.hubs.length))];
    const b = tr.hubs[Math.floor(pairRnd() * tr.hubs.length)];
    pairs.push([a, b]);
  }
  const med = [];
  for (const [a, b] of pairs) {
    const ts = [];
    for (let rep = 0; rep < 5; rep++) {
      const t0 = process.hrtime.bigint();
      queryInt(tr, a, b, 8, 1e9, 0);
      const t1 = process.hrtime.bigint();
      ts.push(Number(t1 - t0) / 1e3);
    }
    med.push(median(ts));
  }
  console.log(`${n} ${tr.nNodes} ${median(med).toFixed(1)}`);
}

console.log('# EXP-F: confidence floor (m-leg promise, eps=0.01, 10^5 runs)');
console.log('# m  floor  exact  empirical');
{
  const eps = 0.01, RUNS = 100000;
  for (const m of [1, 2, 4, 8, 12, 16, 20]) {
    const rnd = mulberry32(2024 + m);
    let ok = 0;
    for (let i = 0; i < RUNS; i++) {
      let good = true;
      for (let h = 0; h < m; h++) if (rnd() < eps) { good = false; break; }
      if (good) ok++;
    }
    console.log(`${m} ${(1 - m * eps).toFixed(4)} ${Math.pow(1 - eps, m).toFixed(4)} ${(ok / RUNS).toFixed(4)}`);
  }
}
console.log('# done');
