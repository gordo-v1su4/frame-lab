# Agent continuity — zig-swap

**Last updated:** 2026-09-11  
**Historical lineage reference.** Start with current `CONTEXT.md` and ADR-0009. Stack C restrictions below describe the original demo.

## Lineage

This repo is the **greenfield build** from the parked research lab:

| Repo | Role |
|------|------|
| **`../webgpu-research/`** | Parked lab — `timesampler` semantics, Essentia prep, peer research. **Do not grow the lab here.** |
| **`zig-swap` (this repo)** | **Greenfield Stack C** — WebCodecs + WASM remap core + WebGPU. Not a Beatsmaxxer port. |
| **`../video-timeshaper/`** | EditEngine / Time Shaper behavior spec (sibling) |
| **`../beatsmaxxer-pro/`** | **Best-performing finished app today** — feel/latency/UX bar. **READ ONLY.** Different stack. |

### Beatsmaxxer vs zig-swap (don't conflate)

**Beatsmaxxer-pro** is the most finished, best-performing working app in the family (SvelteKit + TS WebGPU + `HTMLVideoElement`). Use it to answer: *does v0 feel right?* Compare chop timing, scrub response, overall PGM smoothness.

**Do not** treat it as the build target for this repo:

- No porting the rack, slots, or product UI into zig-swap
- No merging repos or sharing hot-path code — Stack A is TS + `<video>`, Stack C is WebCodecs + WASM
- No "make zig-swap into Beatsmaxxer" — zig-swap replaces the **interim** stack, not the product shell

When docs say "reference Beatsmaxxer," mean **benchmark against**, not **implement like**.

Handoff source doc: [`HANDOFF-ZIG-VIDEO-STACK.md`](../../HANDOFF-ZIG-VIDEO-STACK.md) (copied at repo seed).

## What to copy from webgpu-research

| Need | Path in `webgpu-research` |
|------|---------------------------|
| Remap semantics (spike oracle) | `lab/browser/deck-pgm/src/timesampler/` |
| EditEngine reference | `lab/browser/deck-pgm/src/edit/edit-engine.ts` |
| Essentia API contract | `lab/docs/ESSENTIA-API.md` |
| Prep CLI (port to `prep/`) | `lab/lib/essentia-studio.mjs`, `lab/scripts/analyze-track.ps1` |
| Scope split | `lab/docs/SCOPE-SPLIT.md` |
| Parked lab continuity | `docs/agents/continuity.md` |

## v0 fixture media

`prep/fixtures/test-media/` — bundled clip + audio. Prep writes `analysis/track.beats.json` using the same Studio API shape the lab used (`studio-audio-v1`).

## Toolchain (mandatory)

| Layer | Use | Never |
|-------|-----|-------|
| JS/TS packages & scripts | **bun** / **bunx** | npm, npx, pnpm, yarn |
| Python prep | **uv** (`uv run`, `uv sync`, `uv add`) | bare `python`, `pip`, `pip install` |
| Compiled core | **Zig** 0.16+ (`zig build`, wasm32-freestanding) | — |

Examples: `bun install`, `bun run dev`, `bunx vitest`, `uv run python prep/analyze.py`. Graft CLI: `bun install -g @nanonets/graft` or `bunx @nanonets/graft`.

## Issue tracker

**Linear** — team **V1su4**, project **[Frame Lab](https://linear.app/v1su4/project/frame-lab-6dd41597bb31)**. Use Linear MCP in Cursor for `/to-spec`, `/to-tickets`, `/triage`, `/implement`. GitHub repo is for code and PRs only.

## Domain docs

- Glossary: [`CONTEXT.md`](../../CONTEXT.md)
- ADRs: [`docs/adr/`](../adr/)
- Agent skills config: [`docs/agents/`](./)
