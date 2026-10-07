export const engineNames: Record<string, string> = {
  beatsmaxxer: "HTML video pool",
  mediabunny: "WebCodecs cache",
  "gpu-bank": "GPU texture bank",
  libmedia: "libmedia",
};
export type SavedRun = Record<string, any>;
const triggerNames: Record<string, string> = {
  midi: "MIDI · all stems",
  "midi-vocals": "MIDI · vocals",
  "midi-synth": "MIDI · synth",
  "midi-bass": "MIDI · bass",
  "mix-onsets": "Mix onsets",
  "vocals-onsets": "Vocal onsets",
  "stem-onsets": "Stem onsets",
  "vocals-activity": "Vocal phrases",
  "mix-loudness": "Loudness peaks",
  "local-energy": "Local audio",
  legacy: "Earlier pattern",
};
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function summarizeRun(r: SavedRun) {
  const decks = Array.isArray(r.decks) ? r.decks : [],
    gate = r.kind === "capability-gate",
    remap = r.mode === "remap";
  const values = (key: string) => decks.map((d) => d[key]).filter(finite);
  const completeMetric = (key: string) =>
    decks.length > 0 && values(key).length === decks.length;
  const sum = (key: string) =>
    completeMetric(key) ? values(key).reduce((a, b) => a + b, 0) : null;
  const worst = (key: string) =>
    completeMetric(key) ? Math.max(...values(key)) : null;
  const cuts = sum("cuts"),
    on = sum("onTimeCuts");
  return {
    id: String(r.file ?? r.id ?? ""),
    engine: engineNames[r.backend] ?? String(r.backend ?? "Unknown"),
    backend: r.backend,
    mode: gate ? "gate" : remap ? "remap" : "cuts",
    pattern: r.action ?? r.pattern ?? "Capability probe",
    trigger: gate
      ? "—"
      : (triggerNames[r.signal] ?? (r.pattern === "midi-stems" ? "MIDI · all stems" : r.signal ?? "—")),
    groove: gate || remap ? "—" : (r.groove ?? "straight"),
    revision: r.schemaVersion ?? "legacy",
    count: r.count ?? null,
    resolution: r.resolution ?? "—",
    seconds: finite(r.elapsed) ? r.elapsed : null,
    seed: r.seed ?? "—",
    state: gate
      ? "Not scored"
      : r.invalid?.length
        ? "Invalid"
        : !r.completed
          ? "Incomplete"
          : !r.schemaVersion
            ? "Legacy preview"
            : r.elapsed < 120
              ? "Preview"
              : "Trial (not suite)",
    onTime: !remap && cuts && on !== null ? (100 * on) / cuts : null,
    p95: !remap ? worst("p95Ms") : null,
    missed: !remap ? sum("missedCuts") : null,
    fps: completeMetric("uniqueFrameFps")
      ? [
          Math.min(...values("uniqueFrameFps")),
          Math.max(...values("uniqueFrameFps")),
        ]
      : null,
    preload: finite(r.allDecksReadyMs) ? r.allDecksReadyMs : null,
    memory: finite(r.peakApplicationCacheBytes)
      ? r.peakApplicationCacheBytes
      : null,
    budget: finite(r.cacheBudgetBytes) ? r.cacheBudgetBytes : null,
    reason: gate
      ? String(r.reason ?? "Unverified adapter")
      : (r.invalid?.join(", ") ?? ""),
    raw: r,
  };
}
export function differences(a: SavedRun, b: SavedRun) {
  const keys = [
    "schemaVersion",
    "mode",
    "action",
    "pattern",
    "count",
    "resolution",
    "seed",
    "duration",
    "audioHash",
    "gridHash",
    "cacheBudgetBytes",
    "cacheCondition",
    "signal",
    "programView",
    "interpolation",
    "outputCadenceFps",
    "userAgent",
  ];
  const different = keys.filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  if (
    JSON.stringify(a.clips?.map((c: any) => c.sha256)) !==
    JSON.stringify(b.clips?.map((c: any) => c.sha256))
  )
    different.push("media hashes");
  return different;
}

export function validateRun(value: unknown): asserts value is SavedRun {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected a result object");
  const r = value as SavedRun;
  if (
    !["musical-run", "capability-gate"].includes(r.kind) ||
    typeof r.backend !== "string"
  )
    throw Error("Unsupported result format");
  if (
    r.kind === "musical-run" &&
    (!Array.isArray(r.decks) ||
      r.decks.some(
        (d: unknown) => !d || typeof d !== "object" || Array.isArray(d),
      ))
  )
    throw Error("Invalid deck measurements");
  if (
    r.invalid !== undefined &&
    (!Array.isArray(r.invalid) ||
      r.invalid.some((v: unknown) => typeof v !== "string"))
  )
    throw Error("Invalid run status");
  if (
    r.clips !== undefined &&
    (!Array.isArray(r.clips) ||
      r.clips.some(
        (c: unknown) => !c || typeof c !== "object" || Array.isArray(c),
      ))
  )
    throw Error("Invalid media metadata");
}
