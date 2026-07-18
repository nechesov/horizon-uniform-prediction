# Horizon-Uniform Prediction on Operator-Generated Networks

Simulation code, measured results, and figure sources for the paper

> A. Nechesov and V. Puzarenko, **"Gandy Direct-Limit Theorem: Polynomial-Time
> Prediction on Operator-Generated Networks,"** submitted to *IEEE Access*, 2026.
> (Extends the conference paper presented at MathAI 2026.)

The paper proves that an evolving network presented by a fixed polynomial-time
expansion operator Γ admits a presentation on which every bounded predictive
query is decidable in time **polynomial in the code length of the queried
configuration**, with a polynomial degree fixed by the query. The code length,
and hence the query cost, grows with the depth of the target (by a factor of the
branching cap per level); what is uniform across the horizon is the degree, not
the latency. This repository contains the deterministic simulation that validates
the predicted complexity shapes.

## What is here

```
sim_network.js        the whole simulation (Node.js, zero dependencies)
results/
  sim_results.txt     the exact output quoted in the paper (fixed seeds)
figures/
  fig_*.tex           standalone TikZ/pgfplots sources of all 7 paper figures
  fig_*.pdf           the compiled figures as they appear in the paper
```

## Requirements

* Node.js ≥ 18 (tested on Node.js 24). No npm packages are needed.

## Run

```
node sim_network.js
```

The computed quantities (codes, validity checks, node counts, and the confidence
floor) reproduce bit-for-bit: all randomness comes from a seeded deterministic PRNG
(mulberry32). The wall-clock timings are reference medians from one run and vary by a
machine-dependent factor, so the scaling exponents, not the absolute times, are the
reproducible quantity. The run takes well under a minute on commodity hardware
(reference machine: Intel Core i7-11800H, 16 GB RAM, Windows 11; Node.js 24).

## The five experiments

| # | What it measures | Paper claim it tests |
|---|------------------|----------------------|
| EXP1 | build time of Γⁿ(N₀) vs. consolidation rounds *n* | materialization linear in *n* |
| EXP2 | query time vs. code length *L=P_d* and look-ahead *m* | cost governed by the code, not the look-ahead (within a factor 2) |
| EXP3 | the EXP2 query time replotted against **depth** (Fig. 6c) | cost ×(branching cap) per level: polynomial in *L* is exponential in the depth |
| EXP4 | exact attribute mass, FBC vs. violated | without the boundary condition: 816 B → 2.4·10²¹ B in 20 stages |
| EXP5 | confidence floor vs. realized confidence | the floor 1−mε never exceeds the exact value (1−ε)^m |

*(An earlier EXP measuring integer-regime query time against network size was
removed in v1.1; it re-timed a fixed computation and is superseded by the
depth view above. See the changelog at the end of this file.)*

The script also replays the worked instance from the paper (seeds A, B, C; hub
H = ⟨A,B⟩; super-hub G = ⟨C,H⟩) and reproduces its outputs (**no** at budget t=4;
**yes**, ETA 5, at t≥5).

The expansion operator implements the paper's bounded-growth regime: K = 5 new
depots per stage, attachment within a locality window W = 100, arity capped at
N_max = 4 (so a hub's out-degree is its feeders plus its ring head). Transit time
is τ = ⌈dist/speed⌉ with speed class 1–3; capacity is κ = 10·min(volume).

## Figures

Each `figures/fig_*.tex` is a self-contained `standalone` document:

```
pdflatex fig_exp.tex
```

(The figures are compiled separately because the pgf/tikz bundle conflicts
with the IEEE Access document class; IEEE asks for separate vector figure
files at submission anyway.)

## Changelog

**v1.1** — Corrections made while revising the paper.
* Removed the integer-regime query-time experiment (previously EXP-E / EXP3): its
  query sources were drawn from a fixed prefix of the rollout while the route
  relation descends into a node's own subtree, so the explored set was fixed by
  the experiment's design and did not vary with the network. It re-timed a single
  computation rather than measuring scaling. The integer regime is retained only
  for the build measurement (EXP1), which is what it legitimately establishes —
  that a realized rollout is materializable at scale.
* Query cost against the natural parameter is now shown as the abstract-regime
  measurements (EXP2) replotted against depth (Fig. 6c), where the cost multiplies
  by the branching cap per level. A linear law in the code length is an
  exponential law in the depth; the earlier presentation plotted only against the
  code length, in which the exponential is not visible.
* README and abstract wording no longer describe the query cost as independent of
  the horizon: the degree is horizon-uniform, the latency is not.

**v1.0** — Initial release accompanying the first submission.

The reference timings in `results/sim_results.txt` for EXP1, EXP2 and EXP5 are
unchanged from v1.0; only the removed experiment's rows were deleted.

## License

MIT license; see [LICENSE](LICENSE).

## Citation

Until the article is published, please cite the conference version and this
repository:

```bibtex
@misc{NechesovPuzarenko2026sim,
  author       = {Nechesov, Andrey and Puzarenko, Vadim},
  title        = {Horizon-Uniform Prediction on Operator-Generated Networks
                  (simulation and supplementary materials)},
  year         = {2026},
  howpublished = {\url{https://github.com/nechesov/horizon-uniform-prediction}},
  note         = {Supplementary code for an IEEE Access submission}
}
```
