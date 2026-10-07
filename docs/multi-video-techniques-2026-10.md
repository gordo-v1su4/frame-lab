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
