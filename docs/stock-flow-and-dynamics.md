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

## 4. Volume in ETA, and delivery by disjoint routes (drafted in §VI-C, then parked)

This was fully written into the paper's §VI-C and then **removed** (June 2026) to keep
the article focused on the core theorem; the development is preserved here verbatim.

### 4a. ETA with a volume demand

`ETA_m(u,v,t)` answers reachability-in-time. Under the stock–flow reading a route also
delivers, by the deadline `t`, a **volume** = bottleneck rate × the window left once the
front arrives:
```
W(z̄) = (min_i κ_i) · (t − Σ_i τ_i)
```
so ETA can carry a volume demand `d` as one extra short-numeral conjunct:
```
ETA_m(u,v,t,d) :⇔ ∃z_1∈ν(u)···∃z_m∈ν(z_{m-1}) ( z_m=v  &  Σ_i τ_i ≤ t  &  W(z̄) ≥ d )
```
`d=0` is plain reachability. Still Δ₀ (W is a min/sum/product/compare of short numerals).
Worked instance: edge `H→A` has `τ=5, κ=10`, so `W = 10(t−5)`; demand `d=10` needs `t≥6`.

### 4b. Delivery by p edge-disjoint routes

One route delivers at most its bottleneck `W`. For more, route the demand along `p`
routes whose **legs are pairwise disjoint** — each edge then serves one route, so the
volumes genuinely add (max-flow additivity). With `z̄^a` the a-th route, `d_a = W(z̄^a)`,
and `E^a = {(z^a_{i-1}, z^a_i)}_i` its leg-set:
```
Deliver_{p,m}(u,v,t,d) :⇔ ∃z̄^1···∃z̄^p (
      ⋀_{a≤p} ( z^a_m = v  &  Σ_i τ^a_i ≤ t )    # each route ETA-reachable (the d=0 matrix)
    & ⋀_{a<b} E^a ∩ E^b = ∅                       # segments pairwise disjoint
    & Σ_{a≤p} d_a ≥ d )                           # volumes add up to the demand
```
`Deliver_{1,m} = ETA_m`. For fixed `p,m` this is `pm` bounded quantifiers — a fixed Δ₀
formula, poly in the code length; out-degree `|ν| ≤ N_max+1` bounds the route-tuples by
`(N_max+1)^{pm}` (cost `O((N_max+1)^{pm} N²)`). Note: disjointness is a constraint on the
routes' legs, so the routes must be **explicit** — the ETA predicate as a black box hides
them; Deliver quantifies the routes and reuses ETA's reach-time matrix per route.

Reasons it is interesting: **resilience** (disjoint routes survive single-edge failures),
**parallel throughput** (Σ of bottleneck volumes, toward max-flow), **load balancing**.

**Why parked:** it loads §VI-C without strengthening the core theorem, and ETA-with-volume
diverged from the simulation (which does per-leg `κ ≥ d₀` reachability). The paper keeps the
simple `ETA_m(u,v,t)`. **Unbounded `p` = max-flow**, which leaves Δ₀ (§5).

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
