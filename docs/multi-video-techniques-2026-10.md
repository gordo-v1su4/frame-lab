# Multi-video playback techniques — October 2026 scan

Question: are there newer browser techniques worth benchmarking against the current leader (fully resident GPU texture bank, plus WebGPU presentation) for many simultaneous videos with live musical edits? Tracked in Linear as **V1S-191** with one child ticket per candidate.

## Bottom line

No 2025–26 release adds a video API that obviously beats WebGPU external textures. The likely gains come from three directions:

1. Feed zero-copy `importExternalTexture` from WebCodecs `VideoFrame`s rather than `<video>`, and render in a worker.
2. Keep a bounded window of frames GPU-resident instead of every frame.
3. Use fewer decoders by pre-tiling clips into one video.

WebGL stays out of scope.

## Ranked candidates

| # | Strategy (ticket) | Why it might win | Status (late 2026) |
|---|---|---|---|
| 1 | `video-extex-rvfc` (V1S-192) | Same HTML pool, but samples `<video>` via `importExternalTexture` only on new frames (rVFC). Removes one copy per deck per frame. | Chrome/Edge stable; Firefox Windows 144; Safari 26 WebGPU |
| 2 | `wc-extex-worker` (V1S-193) | WebCodecs frames imported as external textures in an OffscreenCanvas worker. Exact timeline control, no seeking, zero-copy. A `VideoFrame`-backed texture lives until `close()`. | Chrome stable; Safari support for VideoFrame sources unconfirmed |
| 3 | `gpu-ring` (V1S-194) | K frames per clip in `texture_2d_array`. Cuts and stutters inside the window become a layer index. Memory-aware alternative to full residency (about 7.7 GiB for 8×720p). Chrome 137 lets texture views bind where external textures are expected. | Core WebGPU |
| 4 | Short-GOP / all-intra proxies (V1S-196) | Keyframe distance dominates seek latency. Current clips have gaps of up to 4.1 s. | Prep only |
| 5 | `mosaic-extex` (V1S-195) | One decoder for N tiled clips, avoiding hardware decoder session limits on laptops and integrated GPUs. Tiles share a timeline, so pair it with gpu-ring. | Prep + shader |
| 6 | `wc-pool` (V1S-197) | Shared decoder pool vs one decoder per stream. Codec reclamation; Chrome throttles `VideoDecoder` 5–10× at 144 Hz+. | Measure 60 vs 144 Hz |
| 7 | `ktx2-flipbook` (V1S-198) | Compressed texture arrays for 2–4 s loops: no decoder, instant random access, 4–8× less VRAM. Much larger downloads. | BC (desktop) / ASTC (Apple) |

Lower priority:
- **MSE-in-Workers / ManagedMediaSource**: seamless `<video>` timelines without seek stalls.
- **WebGPU compatibility mode** (Chrome 146): coverage for low-end devices.
- **MediaStreamTrackProcessor**: no advantage for file playback.
- **WASM decoders** (ffmpeg.wasm, dav1d): CPU-bound, roughly 1–2 1080p streams per core.

## What products do

- Remotion's `<Video>` and Diffusion Studio use Mediabunny with WebCodecs, and WebGPU in Diffusion's case.
- CapCut web uses WASM plus WebCodecs.
- Rendley uses WebGL plus WebCodecs.

None of them publishes many-stream realtime numbers. Frame Lab's single-device, many-texture design matches the state of the art.

## Sources

- MDN `importExternalTexture`: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/importExternalTexture
- New in WebGPU 137 / 149–150: https://developer.chrome.com/blog/new-in-webgpu-137, https://developer.chrome.com/blog/new-in-webgpu-149-150
- Firefox external textures on Windows: https://bugzilla.mozilla.org/show_bug.cgi?id=1983594
- WebCodecs spec: https://www.w3.org/TR/webcodecs/
- Remotion / Mediabunny WebCodecs bug list: https://www.remotion.dev/docs/mediabunny/webcodecs-bugs
- MediaStreamTrackProcessor in workers: https://blog.mozilla.org/webrtc/unbundling-mediastreamtrackprocessor-and-videotrackgenerator/
- CapCut case study: https://web.dev/case-studies/capcut
- Basis Universal: https://github.com/BinomialLLC/basis_universal

## Local reference editors (MasterSelects, freecut)

Both repos were pulled to latest on 2026-10-07 and studied for their decode and present paths. Neither does live multi-deck playback, but both have pieces worth porting.

- **MasterSelects:**
  - Zero-copy `importExternalTexture` for both `<video>` and `VideoFrame`, with a guard against closed frames.
  - On each new frame (rVFC), wraps the `<video>` as `new VideoFrame(video, {timestamp: mediaTime})`.
  - Decoder pool capped at 8, recycled least-recently-used, with a keyframe re-prime after each reuse.
  - Resident `texture_2d_array` frame history with a MiB budget.
  - JPEG all-intra proxies.
  - Worker OffscreenCanvas render host (off by default).
  - Requests `timestamp-query`, `shader-f16` and `subgroups`, with a WebGPU compatibility-mode fallback.
  - A GPU **BC1/BC3 block encoder** (HAP), currently used only for export.
- **freecut:**
  - mediabunny `samplesAtTimestamps` batch decode, where each packet is decoded at most once, in a 3–6 worker pool.
  - A 3-tier scrub cache: VRAM, then last frame, then RAM ImageBitmaps.
  - 960×540 proxies with a 2 s GOP.
  - Plain WebGPU device with external textures.

Ideas carried into Linear:
- **V1S-200**: compressed (BC1) and YUV-planar resident banks.
- **V1S-201**: WebCodecs zero-copy import and pre-scheduled `samplesAtTimestamps`.
- **V1S-202**: timestamp-query and compatibility mode.

## WebAssembly (2025–26)

- **JSPI (JavaScript Promise Integration)** is the WebAssembly feature that started working in all three browser engines during 2026 (Chrome 137, Firefox 153, Safari 27). It lets WASM call async browser APIs such as WebCodecs as if they were blocking, which simplifies the code but does not make it faster.
- **Wasm 3.0** (GC, memory64, multiple memories, exception handling, tail calls) was finalized in September 2025. Little of it applies here.
- **wasi-gfx (WASI WebGPU)** runs outside browsers only.
- There is no zero-copy path between WASM memory and the GPU. `VideoFrame.copyTo` into WASM memory is a full copy, often with a readback from the GPU.

WASM will not beat hardware decode at 720p. Where it could help:
- a jitter-free edit scheduler in a worker using shared memory (**V1S-203**)
- custom intra-only codecs for very short loops
- encoding compressed textures at load time (a GPU compute encoder is the better fit)
