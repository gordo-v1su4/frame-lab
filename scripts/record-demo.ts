/**
 * Record demo clips of Frame Lab runs: headless Chrome on the real GPU, tab capture
 * (video + tab audio) inside the page, uploaded to captures/ by the local server, then
 * finalized to 1920x1080 H.264/AAC MP4 with ffmpeg. Every recorded run is also a saved result.
 *
 *   bun run benchmark                        # in another terminal (or set FRAME_LAB_URL)
 *   bun run record:demo                      # all scenarios
 *   bun run record:demo midi-vocals swing    # only scenarios whose name contains a filter
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const base = process.env.FRAME_LAB_URL ?? "http://localhost:5173";
const chrome =
  process.env.CHROME_PATH ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
if (!chrome) throw new Error("Chrome not found; set CHROME_PATH");
const out = join(import.meta.dir, "..", "captures");
mkdirSync(out, { recursive: true });

type Scenario = { name: string; params: Record<string, string | number> };
const cuts = { backend: "gpu-bank", count: 8, duration: 30, resolution: 720, budget: 12288, pattern: "midi-stems", mode: "cuts" };
const scenarios: Scenario[] = [
  ...["midi", "midi-vocals", "midi-synth", "midi-bass", "mix-onsets", "vocals-onsets", "stem-onsets", "vocals-activity", "mix-loudness"].map((trigger) => ({
    name: `gpu-bank-8-${trigger}-straight`,
    params: { ...cuts, trigger, groove: "straight" },
  })),
  ...["swing", "dotted", "varied"].map((groove) => ({ name: `gpu-bank-8-midi-${groove}`, params: { ...cuts, trigger: "midi", groove } })),
  // FFT (spectral-flux) onset triggers under swung and dotted repeats.
  ...["mix-onsets", "vocals-onsets"].flatMap((trigger) =>
    ["swing", "dotted"].map((groove) => ({ name: `gpu-bank-8-${trigger}-${groove}`, params: { ...cuts, trigger, groove } })),
  ),
  { name: "gpu-bank-8-speed-ramp", params: { ...cuts, mode: "remap", speed: "speed-ramp", trigger: "midi", budget: 24576, interpolation: "original" } },
  { name: "webcodecs-8-midi-straight", params: { ...cuts, backend: "mediabunny", budget: 256, trigger: "midi", groove: "straight" } },
  { name: "html-pool-8-midi-straight", params: { ...cuts, backend: "beatsmaxxer", trigger: "midi", groove: "straight" } },
];
const filters = process.argv.slice(2);
const selected = scenarios.filter((s) => filters.every((f) => s.name.includes(f)));

async function title(port: number) {
  try {
    const pages = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; title: string }[];
    return pages.find((p) => p.type === "page" && p.title.startsWith("frame-lab:"))?.title ?? "";
  } catch {
    return "";
  }
}

for (const [index, scenario] of selected.entries()) {
  const query = new URLSearchParams({ capture: "", autoplay: "", record: scenario.name, volume: "0.8" });
  for (const [k, v] of Object.entries(scenario.params)) query.set(k, String(v));
  const port = 9300 + index;
  const profile = join(tmpdir(), `frame-lab-capture-${Date.now()}`);
  console.log(`● ${scenario.name}`);
  const browser = spawn(chrome, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    "--enable-gpu",
    "--enable-unsafe-webgpu",
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
    "--auto-accept-this-tab-capture",
    "--auto-select-tab-capture-source-by-title=frame-lab",
    "--no-first-run",
    "--no-default-browser-check",
    `${base}/benchmark?${query.toString().replace(/=(&|$)/g, "$1")}`,
  ]);
  const limit = Date.now() + ((Number(scenario.params.duration) || 30) + 90) * 1000;
  let state = "";
  while (Date.now() < limit) {
    state = await title(port);
    if (state === "frame-lab:saved" || state.startsWith("frame-lab:error")) break;
    await Bun.sleep(500);
  }
  browser.kill();
  await Bun.sleep(800);
  rmSync(profile, { recursive: true, force: true });
  if (state !== "frame-lab:saved") {
    console.log(`  ✗ ${state || "timed out"}`);
    continue;
  }
  const raw = readdirSync(out).find((f) => f.startsWith(scenario.name + ".") && /\.(webm|mp4)$/.test(f) && !f.endsWith(".final.mp4"));
  if (!raw) {
    console.log("  ✗ upload missing");
    continue;
  }
  const final = join(out, `${scenario.name}.final.mp4`);
  const ff = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", join(out, raw),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=60",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", final,
  ]);
  if (ff.status !== 0) {
    console.log("  ✗ ffmpeg: " + ff.stderr.toString().slice(0, 300));
    continue;
  }
  rmSync(join(out, raw));
  console.log(`  ✓ ${final} (${(statSync(final).size / 2 ** 20).toFixed(1)} MiB)`);
}
