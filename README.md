# Horizon-Uniform Prediction on Operator-Generated Networks

Simulation code, measured results, and figure sources for the paper

> A. Nechesov and V. Puzarenko, **"Polynomial-Time Predictive Analytics on Evolving
> Networks via p-Computable Direct Limits,"** submitted to *IEEE Access*, 2026.
> (Extends the conference paper presented at MathAI 2026.)

The paper proves that an evolving network presented by a fixed polynomial-time
expansion operator Γ admits a presentation on which every bounded predictive
query is decidable in worst-case polynomial time, with a polynomial degree that
**does not depend on the prediction horizon**. This repository contains the
deterministic simulation that validates the predicted complexity shapes.

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
| EXP1 | build time of Γⁿ(N₀) vs. horizon *n* | materialization linear in *n* |
| EXP2 | query time vs. look-ahead *m* (Algorithm 1) | within the O(m·N²) bound |
| EXP3 | query time vs. *n* at fixed *m* | **horizon-uniformity**: network ×32, query time flat (~120 µs) |
| EXP4 | exact attribute mass, FBC vs. violated | without the boundary condition: 816 B → 2.4·10²¹ B in 20 stages |
| EXP5 | confidence floor vs. realized confidence | the floor 1−mε never exceeds the exact value (1−ε)^m |

The script also replays the worked instance from the paper (the A-H-B-D
diamond) and reproduces its outputs (**no** at budget t=4; **yes**, ETA 5, at t≥5).

The expansion operator implements the paper's bounded-growth regime (A3):
K = 5 new depots per stage, attachment within a locality window W = 100,
out-degree capped at D_max = 8; transit times τ ∈ {1..10}, capacities κ ∈ {1..100}.

## Figures

Each `figures/fig_*.tex` is a self-contained `standalone` document:

```
pdflatex fig_exp.tex
```

(The figures are compiled separately because the pgf/tikz bundle conflicts
with the IEEE Access document class; IEEE asks for separate vector figure
files at submission anyway.)

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
