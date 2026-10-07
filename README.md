# Frame Lab

[Public benchmark](https://frame-lab-gamma.vercel.app/benchmark) · [Documentation index](docs/README.md)

## How the project evolved

This repository began as **zig-swap**, exploring a compiled time-remapping core and comparing Zig and Rust against shared correctness fixtures. The Zig demo and archived Rust spike remain as historical experiments.

The practical question became: **which playback strategy delivers the correct frame at the right time under a musical, multi-clip workload?** Decoder scheduling, keyframe spacing, prewarming, frame reuse, GPU texture residency and audio synchronization became the focus. The current benchmark compares playback strategies rather than treating language choice as a proxy for performance.

This does not establish that Zig, Rust or WebAssembly are slow or unnecessary. The previews are not a universal language ranking or a completed controlled engine study. WebAssembly 2.0 and newer developments remain a separate exploratory research track, including possible future Zig/Rust/C++ compilation experiments. We intend to review new browser video technologies and similar projects, then test promising approaches under the same workload. See the [evaluation roadmap](docs/evaluation-roadmap.md).

A browser playback benchmark for musical cuts, seeks, stutters, and independent speed ramps. Compare strategies using visible video output and recorded frame observations, rather than decoding a single clip as fast as possible.

## Roadmap

- Compare the user's M3 laptop (16 GB unified memory) with the RTX 5090 desktop (128 GB system RAM, 32 GB VRAM). These are user-reported target configurations, not completed comparative measurements. Record the exact model, OS, browser, display and power mode when testing.
- Add hardware profiles and clearer tabs/filters for comparing runs across machines, similar to established benchmark tools. Keep browser, media, workload and memory conditions visible.
- Test memory-aware presets and proxy media separately; a large resident-texture bank that fits the desktop may not fit a laptop's shared memory.
- Benchmark the strategies from the [October 2026 technique scan](docs/multi-video-techniques-2026-10.md): zero-copy external textures, WebCodecs in a render worker, GPU frame rings, mosaic video, short-GOP proxies (Linear V1S-191).
- Continue browser-video and compiled WebAssembly research using the [evaluation roadmap](docs/evaluation-roadmap.md). Publish repeatable evidence before recommending an integration.

This is planned work; no M3-versus-desktop trial or hardware-normalized score is available yet.

## Run locally

Install [Bun](https://bun.sh), then run:

```sh
bun install
bun run benchmark
```

Open the URL it prints (normally **http://localhost:5173/benchmark**; if another dev server holds 5173 it moves to the next free port) in a browser with WebGPU and WebCodecs support. The benchmark command does not build or require Zig or Rust. `bun run dev` still starts the older Zig demo separately. The server binds to localhost.

Start in **Results** to inspect the saved reference runs. The strategy cards at the top show each engine's best current result, and the top one is highlighted in gray. In **Playback lab**, choose a strategy, deck count, trigger source and groove, then press Play.

Demo media loads automatically from `prep/fixtures/test-media/benchmark`: 8 Beatsmaxxer clips at 720p and 1080p, the Redline track, its MIDI stems (vocals, synth, bass) and librosa analysis of the mix and the isolated stems. Trigger sources are MIDI for all stems or a single stem, mix/vocal/stem onsets, vocal phrase starts and loudness peaks. Groove sets repeat timing: straight, swing (2:1), dotted (1.5×) or varied.

## Demo recordings

```sh
bun run benchmark          # terminal 1
bun run record:demo        # terminal 2; optional name filters, e.g. `bun run record:demo midi swing`
```

The recorder runs each scenario in headless Chrome on your GPU. The page records only its own tab (video plus soundtrack) and saves a 1920×1080 60 fps MP4 to `captures/`, which is gitignored. Each recording is also a normal saved benchmark run. Any lab control can be set from the URL, for example `/benchmark?capture&backend=gpu-bank&count=8&trigger=midi-vocals&groove=swing`. `capture` frames only the playback stage, and `autoplay` starts the run. Audio starts with playback. Start with one deck before increasing capacity. GPU texture residency can require several GiB even for short clips.

## Four strategies

| Strategy         | What happens during playback                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML video pool  | Prewarmed HTML video elements, controlled seeking and browser-managed decoding. The pool implementation is included here; no Beatmaxxer installation is required. |
| WebCodecs cache  | Mediabunny demuxing with bounded decoded-frame reuse and WebGPU presentation.                                                                                     |
| GPU texture bank | Decode and upload before playback, then select resident GPU textures. This trades startup and memory for inexpensive frame selection.                             |
| libmedia         | Experimental capability probe. Existing probes timed out; there is no scored libmedia result or validated performance claim.                                      |

The benchmark is TypeScript with browser media APIs and WebGPU. A dependency may use WebAssembly internally. It does not compare programming languages.

## Your own media

Choose one to eight MP4 videos and optionally your own audio file in the media controls. Files are read in the browser; they are not uploaded to the server or persisted by the application. Reloading clears the selection. Browser-supported codecs determine which files can decode.

Custom audio uses a manually entered BPM and local energy-rise detection. This is not vocal isolation or MIDI transcription. Included demo audio has separate prepared trigger data. Local libmedia playback is not yet enabled.

Reports can contain media hashes, dimensions, durations, frame rates and timing measurements, but no media bytes. Saved reports are written to `benchmark-results/` by the local server. Check report metadata before sharing it.

## Results and comparison

The Results view loads the existing reference reports and new saved runs. Sort columns, filter engines and workloads, or select two rows to compare their conditions. Export JSON preserves recorded events; CSV exports the visible summary. Import JSON to compare someone else's reports in the current page session. Print report produces a table-oriented document.

Existing runs are exploratory previews, not a completed controlled study. Their workloads, revisions, observation methods and memory budgets differ. In particular, a fully resident GPU bank using several GiB is not an equal-memory comparison with a 256 MiB frame cache. The UI flags mismatched conditions and does not announce a winner.

Cut p95 in the table is the worst per-deck p95, not a pooled percentile. Missing measurements remain blank. Intentional time remapping should be assessed through source-time accuracy and cadence, not interpreted as an ordinary cut-latency score. Browser callbacks and GPU submission estimate presentation; they do not measure screen scanout. Driver and decoder allocations are not fully observable.

For repeatable comparisons, keep media hashes, workload, seed, duration, deck count, memory policy, browser and display conditions the same. Keep the benchmark visible. Separate cold startup from warmed playback and repeat trials before drawing conclusions.

## Scope

This is an experimental playback lab, not a production migration or a universal engine ranking. The methodology view describes the timing model and limitations. Original research reports remain in `benchmark-results/`; implementation planning is in `docs/frame-lab-plan.md`. Verify the licenses and redistribution permissions for dependencies and media before republishing assets.


### Reloading a run

Use **Reload** beside a recorded run to restore its controls in Playback lab, then press Play. This reruns the setup with the current implementation; historical measurements remain unchanged. Included media is available immediately. Local files are never persisted: select the original videos in their original order and the original audio if needed. Playback checks their recorded fingerprints before proceeding. Reset clears the restored-media requirement for a new experiment. Custom audio is analyzed locally when selected.

Results show the latest run per setup by default; tick **Show history** for older revisions, legacy runs and capability probes. Gray **BEST** marks identify the highest on-time rate and lowest cut p95, missed-cut count and preload time among completed, valid, versioned cut runs in the filtered view. They are descriptive extrema, not an overall engine winner: media, deck counts, workloads and memory budgets can differ. Legacy runs, failed probes and ramp runs are excluded from these cut highlights.


## Hosted version and deployment

The Vercel version is a static site built with `bun run scripts/build-site.ts`. No application server or media-upload endpoint is deployed. Reference results and included fixtures are static assets. New measurements are stored in IndexedDB on the visitor's browser and can be exported as JSON; selected video and audio files remain session-only. Browser storage can be cleared by the user or browser, so export important results. The local Bun server continues to save reports to the repository instead.

`vercel.json` declares the build output and benchmark routes. The UI uses TypeScript, HTML and CSS with locally bundled Inter; it is not a React or Svelte app. Playback modules can be integrated behind a Svelte component lifecycle without porting their decoder or GPU logic.
