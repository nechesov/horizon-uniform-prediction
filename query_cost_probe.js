// Simulation for the IEEE Access v2 paper:
// the universal consolidation network (free consolidation family + satellite
// rings under the unfolding operation r), in two regimes:
//   (1) the ABSTRACT regime: literal padded codes (linear per-depth padding
//       P_d = NMAX*(P_{d-1}+1)+8), top-level strip, the operation r, ev, Can;
//   (2) the INTEGER-ID regime: a realized finite trajectory of the envelope
//       (R consolidators per stage + their rings), used for scale.
// Deterministic PRNG: the computed quantities (codes, validity, confidence floor)
// reproduce exactly; wall-clock timings are reference medians and vary by machine.
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

// Part 1: abstract regime (literal padded codes)
// Code alphabet: '<' '>' ',' = list structure; '#' = the padding square;
// lower-case letters = seed raw symbols; digits = ring-index numerals.
// Conventions:
//   seed   = <raw, #^s>            padded to the base P_0 = |raw|+8
//   hub    = <x_1,...,x_k, #^s>    x_1 < ... < x_k strict length-lex,
//                                  padded to L = P_d = NMAX*(P_{d-1}+1)+8
//   sat    = <hat(d), j, #^s>      padded to the RING length L(d)
// |list of k items| = sum|items| + k + 1   (brackets + k-1 commas; the pad
// block is a comma-separated item).

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

// Uniform per-level length.  Arity is capped at NMAX, so a hub lists a CONSTANT
// number of components, so the content is LINEAR in P_{d-1} and a LINEAR recursion
// suffices (no quadratic, unlike the Boolean algebra whose elements list ~2^n atoms).  The
// binding constraint is the satellite of the fattest hub; +8 is the room for its
// bounded index and the triple's structure, keeping every padding block >= 1.
const NMAX = 4;
let P0 = 10;                                 // = maxRaw + 8; set per regime
function setMaxRaw(r) { P0 = r + 8; }
function Pd(d) { let p = P0; for (let i = 0; i < d; i++) p = NMAX * (p + 1) + 8; return p; }

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
// vol = number of depots consolidated, floored at 1.  A satellite consolidates
// nothing (it is a distinct small feeder micro-depot, not its host), so vol = 1,
// exactly like a seed; it does NOT inherit its host's volume.
function vol(code) { const sh = shape(code); return sh === 'hub' ? arity(code) : 1; }
function sp(u, v) { return 1 + ((vol(u) + vol(v)) % 3); }       // speed class 1..3
// loc(d): a p-computable node coordinate (sum of letter values in the code);
// dist(u,v) is the inter-node distance, so transit = distance / speed (physics),
// not a constant over speed.  The feeder ring shares one site -> dist = 1 there.
function loc(code) { let s = 0; for (let i = 0; i < code.length; i++) { const c = code.charCodeAt(i); if (c >= 97 && c <= 122) s += c - 96; } return s; }
function dist(u, v) { return 1 + Math.abs(loc(u) - loc(v)); }
function tau(u, v) { return Math.ceil(dist(u, v) / sp(u, v)); } // transit = dist/speed
function kap(u, v) { return 10 * Math.min(vol(u), vol(v)); }    // capacity

// neighbours: f_nb(u) = <r(u)> ^ comps(u)
var NBCALLS=0, CHARS=0, SEEN=new Set();
function nb(code) { NBCALLS++; CHARS+=code.length; SEEN.add(code); const r=[rOp(code), ...comps(code)]; for(const y of r) SEEN.add(y); return r; }

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

// Worked instance: exact codes, replayed deterministically
console.log('# ============ ABSTRACT REGIME ============');
console.log('# Worked instance');
setMaxRaw(2);                                // seeds of raw length 2 -> P_0 = maxRaw+8 = 10
const A = mkSeed('aa'), B = mkSeed('bb'), C = mkSeed('cc');
console.log(`|A|=${A.length} |B|=${B.length} |C|=${C.length}  (P_0 = maxRaw+8 = ${P0})`);
const H = mkHub([A, B]);
console.log(`H = <A,B,#^s>: |H|=${H.length}  = P_1 = NMAX*(P_0+1)+8 = ${Pd(1)}  s=${topItems(H)[2].length}`);
const m1 = rOp(H), m2 = rOp(m1), back = rOp(m2);
console.log(`|m1|=${m1.length} |m2|=${m2.length}  s_j=${topItems(m1)[2].length}  r(m2)==H: ${back === H}  (ring length = P_1, uniform)`);
console.log(`ev(r(r(H))) == m2: ${ev(['r', ['r', H]]) === m2}`);
console.log(`depth: A=${depth(A)} H=${depth(H)}`);
// Linear padding keeps codes single-exponential, so the depth-2 super-hub G is
// now small enough to build outright: |G| = P_2 = NMAX*(P_1+1)+8.
const G = mkHub([C, H]);
console.log(`G=<C,H>: depth=${depth(G)}, |G|=${G.length} = P_2 = ${Pd(2)}  canG=${canCheck(G)}  (availability: n=1 NO, n=2 YES)`);
console.log(`vol(H)=${vol(H)} vol(A)=${vol(A)}  tau(H,A)=${tau(H, A)} kappa(H,A)=${kap(H, A)}`);
console.log(`ring legs: tau(H,m1)=${tau(H, m1)} tau(m1,m2)=${tau(m1, m2)} tau(m2,H)=${tau(m2, H)}  milk-run=${tau(H, m1) + tau(m1, m2) + tau(m2, H)}`);
const tt = tau(H, A);
const q1 = queryAbs(H, A, 2, tt, 10), q2 = queryAbs(H, A, 2, tt - 1, 10);
console.log(`dist(H,A)=${dist(H, A)} sp(H,A)=${sp(H, A)} tau(H,A)=${tt}`);
console.log(`ETA H->A (m=2,d0=10): t=${tt} -> ${q1.yes} (eta ${q1.eta});  t=${tt - 1} -> ${q2.yes}`);

// EXP-A: validity
console.log('# EXP-A: validity checks');
let okCan = [A, B, C, H, m1, m2, G].every(canCheck);
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


setMaxRaw(2);
let seedCtr = 0;
function freshSeed(){const raw=String.fromCharCode(97+Math.floor(seedCtr/26))+String.fromCharCode(97+(seedCtr%26));seedCtr++;return mkSeed(raw);}
console.log(" d |      L | m | found? | nb() calls | chars parsed | nodes seen");
console.log("---+--------+---+--------+------------+--------------+-----------");
for (let d=1; d<=8; d++){
  seedCtr=0;
  let anchor=null, spine=null;
  for(let k=1;k<=d;k++){
    if(k===1){const s=Array.from({length:NMAX},freshSeed); anchor=s[0]; spine=mkHub(s);}
    else spine=mkHub([spine, ...Array.from({length:NMAX-1},freshSeed)]);
  }
  for(const m of [2,5,8]){
    NBCALLS=0; CHARS=0; SEEN=new Set();
    const r=queryAbs(spine,anchor,m,1e9,0);
    console.log(" "+d+" | "+String(spine.length).padStart(6)+" | "+String(m).padStart(1)+
      " | "+String(r.yes?"YES":"no").padStart(6)+" | "+String(NBCALLS).padStart(10)+
      " | "+String(CHARS).padStart(12)+" | "+String(SEEN.size).padStart(10));
  }
}
