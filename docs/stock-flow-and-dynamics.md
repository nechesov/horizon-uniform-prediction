# Stock–Flow Attributes and Network Dynamics — Notes for Future Work

**Status:** Parked ideas. **Not** in the current IEEE Access paper, which handles only
*static, bounded Δ₀ queries* (feasibility/timing), poly in the code length. Captured
during the consolidation-network revision (June 2026, A. Nechesov).

---

## 1. Stock vs flow (seed of this is already in §VI-C)

The attributes split into a **stock** and a **flow**:

| symbol | kind | units | meaning |
|---|---|---|---|
| `vol(d)` | **stock** | volume | a node's **buffer** — how much it can accumulate |
| `κ(u,v)` | **flow** | volume / time | an edge's **flow rate** (v/sec) |
| `vol/κ` | derived | time | time to **fill or drain** a buffer |
| `d₀` | flow | volume / time | the **demanded rate** |
| `c₁` | — | 1 / time | converts a buffer-bottleneck into a rate |

Example: buffer `vol = 100`, inflow `κ = 10 v/s` ⇒ fills in `100/10 = 10 s`.

The capacity filter `κ ≥ d₀` reads "this leg can sustain the demanded rate."
This dimensional split is what makes `vol` and `κ` numerically incomparable
(stock vs flow), and it is the only part of these notes currently reflected in the
paper.

---

## 2. The entities are really one kind

Hubs, seeds, and satellites are distinguished only **structurally** (by code shape:
`Depot` vs `Sat`), but **physically they are uniform** — every node is a facility with
a buffer, linked by edges that each carry a flow rate `κ` and a transit time `τ`.

A cleaner future model could use a **single sort `Node`** carrying `(vol, location)`,
with consolidation and the feeder ring as *relations* layered on top, rather than three
syntactic species. The current three-way split is an artifact of the encoding, not of
the physics.

---

## 3. Ring circulation under realistic attributes

Default in the paper: `vol(satellite) = 1` (small buffer); ring edges get
`κ = c₁·min(vol,vol) = c₁`.

Now make it realistic — **bad roads between satellites** (low `κ` on ring legs) and
**small satellite buffers**:

- flow that can circulate around the cycle is bounded by the **worst ring leg**,
  `min_i κ_i` over the ring;
- small satellite buffers (`vol = 1`) cannot accumulate to compensate;
- if **any** ring leg has `κ_i < d₀`, the milk-run **cannot sustain the demanded
  rate** → the circulation around the cycle **breaks**.

So with realistic small satellites and poor roads, ring circulation is naturally
throttled and can fail — a feature, not a bug.

**Small static extension that already fits the Δ₀ framework.** `Loop_T(d)` currently
checks only *time* (`Σ_i τ_i ≤ T`). Add a *capacity* condition around the ring:

```
RingOK_{T,d₀}(d) :⇔  (Σ_{i=0}^{k(d)} τ_i ≤ T)  &  (⋀_{i=0}^{k(d)} κ_i ≥ d₀)
```

with `τ_i, κ_i = τ/κ(rⁱ(d), r^{i+1}(d))`, `r^{k(d)+1}(d) := d`. Both conjuncts are
quantifier-free in the (polynomially evaluable) `ring(d)` term, so this stays Δ₀ /
poly in the code length. It says "the milk-run closes **in time** *and* **sustains the
demand** on every leg." Could be dropped into §VI-C if we ever want the ring query to
see capacity, not just time.

---

## 4. Multiple and disjoint feasible paths (ETA is existential)

`ETA_m(u,v,t)` is an **existential** query: it asks whether *there exists* one feasible
route (within the hop bound and time budget, every leg `κ ≥ d₀`) and returns a single
witness. But typically several feasible routes exist, possibly **disjoint** (sharing no
nodes/edges). That carries real content:

- **resilience** — disjoint routes survive single-edge failures; reroute on the spare;
- **parallel throughput** — splitting flow across edge-disjoint routes aggregates their
  rates (toward max-flow): the deliverable rate is the *sum* of the routes' bottlenecks,
  not just one path's;
- **load balancing** — spread demand so no single leg saturates.

**Still Δ₀ for a fixed count.** "There exist `k` pairwise-disjoint feasible `m`-paths"
is `k·m` bounded quantifiers over `ν`, plus pairwise-distinctness (`z_i^a ≠ z_j^b`) and
the per-path time/capacity conditions — a fixed Δ₀ formula, hence **poly in the code
length** for fixed `k, m` (Corollary 1). The aggregate rate `Σ_paths min_i κ_i` is
short-numeral arithmetic over the chosen paths. So bounded disjoint-path queries fit the
current framework directly (could be a §VI-C addition if wanted).

**Unbounded `k` = max-flow**, which leaves Δ₀ and belongs to the flow study in §5
(Menger / max-flow–min-cut with `κ` as edge capacities).

---

## 5. Genuine time dynamics (a larger, separate extension)

Beyond static feasibility — actual evolution in time:

- **buffer dynamics:** `dV_d/dt = (inflows) − (outflows)`, each flow capped by the
  edge `κ` and the buffer `vol`;
- **queues** form when inflow > outflow at a node;
- **steady-state circulation** as a max-flow / min-cut problem with `κ` as edge
  capacities (the ring's throughput per cycle = `min_i κ_i`);
- the **milk-run as a periodic schedule** moving volume; throughput per cycle is the
  ring bottleneck.

This is a continuous/discrete-time simulation or a flow-LP, **not** a bounded Δ₀
query — a separate study (its own section or paper). The p-computable presentation of
the network is the substrate; the dynamics run on top.

---

## 6. What stays in the current paper (scope line)

Only the **bounded Δ₀ predictions**, each a fixed formula decidable in time polynomial
in the code length:

- **emergence** — `depth(C(ā)) ≤ n`;
- **reachability / ETA** — a route within the hop bound and time budget, every leg
  `κ ≥ d₀`;
- **ring milk-run timing** — `Σ τ_i ≤ T`.

Static feasibility, horizon entering only as a depth comparison. Everything in §§3–5
above is parked here until revisited. Note that some of it (the `RingOK` capacity
condition of §3, and bounded disjoint-path queries of §4) actually stays Δ₀ and could be
folded into the paper; only the genuine time dynamics of §5 leaves the framework.
