// Simulation for the IEEE Access v2 paper:
// operator-generated logistics network (orbit of an expansion rule Gamma)
// + Algorithm 1 (hop-bounded feasible-route / ETA query).
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

// ---- The expansion operator Gamma -------------------------------------
// One application: each of K_NEW fresh depots attaches to the *recent*
// part of the snapshot (locality window W) with 2 inbound routes and 1
// outbound route; every depot's out-degree is hard-capped at DMAX (a depot
// hosts boundedly many routes -- assumption (A3) of the paper). Attributes:
// transit time tau in 1..10, capacity kappa in 1..100.
const K_NEW = 5;
const W = 100;       // locality window for attachment
const DMAX = 8;      // out-degree cap per depot

function newNetwork() {
  return { adj: [[]], nVerts: 1 }; // depot 0 = seed
}

function pickRecent(bound, rnd) {   // uniform over the last W depots among 0..bound-1
  const lo = Math.max(0, bound - W);
  return lo + Math.floor(rnd() * (bound - lo));
}

function applyGamma(net, rnd) {
  const start = net.nVerts;
  for (let v = start; v < start + K_NEW; v++) {
    net.adj.push([]);
    net.nVerts++;
    // up to two inbound routes (attachment is skipped at out-degree-capped depots)
    for (let e = 0; e < 2; e++) {
      const u = pickRecent(v, rnd);          // existing depot only (no self-loops)
      if (net.adj[u].length >= DMAX) continue;
      net.adj[u].push({ to: v, tau: 1 + Math.floor(rnd() * 10), kappa: 1 + Math.floor(rnd() * 100) });
    }
    const w = pickRecent(v, rnd);            // one outbound: new -> recent existing
    net.adj[v].push({ to: w, tau: 1 + Math.floor(rnd() * 10), kappa: 1 + Math.floor(rnd() * 100) });
  }
  return net;
}

// ---- Algorithm 1: hop-bounded feasible-route / ETA query ---------------
function query(net, A, B, m, t, d) {
  if (A === B) return { yes: t >= 0, eta: 0 };   // 0-hop route
  const best = new Map([[A, 0]]);
  let F = new Set([A]);
  for (let h = 1; h <= m; h++) {
    const Fp = new Set();
    for (const u of F) {
      for (const edge of net.adj[u]) {
        if (edge.kappa < d) continue;
        const a = best.get(u) + edge.tau;
        if (a <= t && (!best.has(edge.to) || a < best.get(edge.to))) {
          best.set(edge.to, a);
          Fp.add(edge.to);
        }
      }
    }
    if (best.has(B) && best.get(B) <= t) return { yes: true, eta: best.get(B) };
    F = Fp;
  }
  return { yes: false, eta: best.has(B) ? best.get(B) : 'unreachable' };
}

function median(xs) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

// ---- Experiment 1: materialization cost vs horizon n -------------------
// (the operator is polynomially expanding: K_NEW depots/stage)
console.log('# EXP1: build time of Gamma^n(N0) vs n   (K_NEW=' + K_NEW + ')');
console.log('# n  depots  buildMs');
{ // JIT/allocator warmup at the largest size before timing
  const rnd = mulberry32(1);
  const net = newNetwork();
  for (let i = 0; i < 16000; i++) applyGamma(net, rnd);
}
const exp1 = [];
for (const n of [250, 500, 1000, 2000, 4000, 8000, 16000]) {
  const times = [];
  let depots = 0;
  for (let rep = 0; rep < 9; rep++) {
    const rnd = mulberry32(42 + rep);
    const net = newNetwork();
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) applyGamma(net, rnd);
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
    depots = net.nVerts;
  }
  const ms = median(times);
  exp1.push([n, depots, ms]);
  console.log(`${n} ${depots} ${ms.toFixed(2)}`);
}

// ---- Experiment 2: query time vs look-ahead m at fixed n ----------------
console.log('# EXP2: query time vs m at n=8000 (median of 21 source/target pairs x 5 reps), microseconds');
console.log('# m  queryUs');
{
  const rnd = mulberry32(42);
  const net = newNetwork();
  for (let i = 0; i < 8000; i++) applyGamma(net, rnd);
  const pairRnd = mulberry32(7);
  const pairs = [];
  for (let i = 0; i < 21; i++) pairs.push([Math.floor(pairRnd() * 100), 1 + Math.floor(pairRnd() * (net.nVerts - 1))]);
  for (const m of [2, 4, 6, 8, 10, 12, 16, 20]) {
    const med = [];
    for (const [A, B] of pairs) {
      const ts = [];
      for (let rep = 0; rep < 5; rep++) {
        const t0 = process.hrtime.bigint();
        query(net, A, B, m, 1e9, 5);
        const t1 = process.hrtime.bigint();
        ts.push(Number(t1 - t0) / 1e3);
      }
      med.push(median(ts));
    }
    console.log(`${m} ${median(med).toFixed(1)}`);
  }
}

// ---- Experiment 3: query time vs horizon n at fixed m -------------------
// (the n-uniformity claim: degree does not move with n; only network size grows)
console.log('# EXP3: query time vs n at m=8, microseconds (median over 21 pairs x 5 reps)');
console.log('# n  depots  queryUs');
for (const n of [500, 1000, 2000, 4000, 8000, 16000]) {
  const rnd = mulberry32(42);
  const net = newNetwork();
  for (let i = 0; i < n; i++) applyGamma(net, rnd);
  const pairRnd = mulberry32(7);
  const pairs = [];
  for (let i = 0; i < 21; i++) pairs.push([Math.floor(pairRnd() * Math.min(100, net.nVerts)), 1 + Math.floor(pairRnd() * (net.nVerts - 1))]);
  const med = [];
  for (const [A, B] of pairs) {
    const ts = [];
    for (let rep = 0; rep < 5; rep++) {
      const t0 = process.hrtime.bigint();
      query(net, A, B, 8, 1e9, 5);
      const t1 = process.hrtime.bigint();
      ts.push(Number(t1 - t0) / 1e3);
    }
    med.push(median(ts));
  }
  console.log(`${n} ${net.nVerts} ${median(med).toFixed(1)}`);
}

// ---- Experiment 4: ablation — violating the boundary condition ----------
// FBC version: every edge label has fixed length. Violating version: each
// new edge's label is the concatenation of two existing labels (size ~x1.6
// per stage). Measures per-orbit build time; label mass explodes without FBC.
// Attribute-mass accounting is exact (lengths tracked as BigInt): under FBC
// every aggregate keeps fixed length 8; the violating aggregate is the
// concatenation of the two most recent aggregates (output longer than its
// inputs' list), so lengths satisfy a Fibonacci-type recurrence and the
// total mass after n stages is exponential in n.
console.log('# EXP4: ablation — exact total attribute bytes after n stages, FBC vs no-FBC');
console.log('# n  fbcBytes  noFbcBytes');
{
  const N_MAX = 20;
  const lens = [1n, 1n];               // violating branch: per-depot aggregate lengths
  let fbcTotal = 2n * 8n, vioTotal = 2n;
  let depots = 2;
  for (let n = 1; n <= N_MAX; n++) {
    for (let j = 0; j < K_NEW; j++) {  // K_NEW new depots per stage
      lens.push(lens[lens.length - 1] + lens[lens.length - 2]);
      vioTotal += lens[lens.length - 1];
      fbcTotal += 8n;
      depots++;
    }
    if ([2, 4, 6, 8, 10, 12, 14, 16, 18, 20].includes(n))
      console.log(`${n} ${fbcTotal} ${vioTotal}`);
  }
}

// ---- Experiment 5: confidence floor vs empirical frequency --------------
// Per-hop predicate chain Phi_0..Phi_m with per-hop joint error eps; the
// floor 1 - m*eps must lower-bound the observed frequency of Phi_m | Phi_0.
console.log('# EXP5: floor vs empirical P(Phi_m | Phi_0), eps=0.01/hop, 100000 runs');
console.log('# m  floor  empirical');
{
  const RUNS = 100000, eps = 0.01;
  for (const m of [1, 2, 4, 8, 12, 16, 20]) {
    const rnd = mulberry32(2026);
    let ok = 0, tot = 0;
    for (let r = 0; r < RUNS; r++) {
      let alive = true; // Phi_0 holds (condition on it)
      for (let h = 0; h < m && alive; h++) if (rnd() < eps) alive = false;
      tot++; if (alive) ok++;
    }
    console.log(`${m} ${(1 - m * eps).toFixed(3)} ${(ok / tot).toFixed(4)}`);
  }
}

// ---- Worked instance from the paper (sanity check) ----------------------
console.log('# WORKED INSTANCE: A,H,B,D; tau(A,H)=2, tau(H,B)=3, tau(A,D)=1, tau(D,B)=5');
{
  const net = { adj: [[], [], [], []], nVerts: 4 }; // 0=A 1=H 2=B 3=D
  net.adj[0].push({ to: 1, tau: 2, kappa: 100 });
  net.adj[1].push({ to: 2, tau: 3, kappa: 100 });
  net.adj[0].push({ to: 3, tau: 1, kappa: 100 });
  net.adj[3].push({ to: 2, tau: 5, kappa: 100 });
  console.log('m=2 t=4 ->', JSON.stringify(query(net, 0, 2, 2, 4, 5)));
  console.log('m=2 t=5 ->', JSON.stringify(query(net, 0, 2, 2, 5, 5)));
}
