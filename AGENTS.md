<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

## Agent skills

### Issue tracker

Specs and tickets live in **Linear** (team V1su4, project [Frame Lab](https://linear.app/v1su4/project/frame-lab-6dd41597bb31)). GitHub is code/PRs only. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Toolchain

**bun** / **bunx** for JS/TS; **uv** for Python. Never npm, npx, pip. See `docs/agents/continuity.md`.

### Automation

Hands-off loop: Linear frontier → `/implement` → PR → Done. See `docs/agents/automation.md` and `workflows/agent-automation-loop.md`.

## Learned User Preferences

- Always use **bun** / **bunx** for JS/TS packages, installs, and scripts — never npm, npx, pnpm, or yarn.
- Always use **uv** for Python prep and scripts — never pip or bare `python`.
- Prefer hands-off automation: Linear frontier tickets drive agent sessions via `/implement`, one ticket per fresh session.

## Learned Workspace Facts

- Current public app: **Frame Lab**, a TypeScript browser playback-strategy benchmark. Read `CONTEXT.md` and `docs/adr/0009-playback-strategy-benchmark.md`. Stack C/Zig notes below describe the preserved original demo.

- **Frame Lab** (repo `gordo-v1su4/frame-lab`, local folder `frame-lab`; formerly zig-swap) began as the greenfield Stack C build (WebCodecs + WASM remap core + WebGPU).
- **webgpu-research** is the parked lab predecessor — port `timesampler` semantics and Essentia prep from there, not fftron-sync.
- **beatsmaxxer-pro** is the best-performing finished app today (Stack A); benchmark feel/latency only, not architecture to copy.
- **video-timeshaper** is the EditEngine / Time Shaper behavior-spec sibling repo.
- v0 fixture media lives at `prep/fixtures/test-media/`; runtime reads locked `track.beats.json` (Essentia `studio-audio-v1` shape).
- v0 program tracked in Linear under parent spec **V1S-69** with child tickets **V1S-70** through **V1S-77**.
