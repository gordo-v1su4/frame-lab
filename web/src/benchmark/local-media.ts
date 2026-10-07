import { Input, MP4, BlobSource } from "mediabunny";
import type { Clip } from "./adapters";
import type { Grid } from "./schedule";
export const fingerprint = async (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
/** The deck preview grid holds eight tiles; extra selected files are ignored. */
export const MAX_LOCAL_DECKS = 8;
export async function inspectLocalVideos(files: File[]): Promise<Clip[]> {
  if (!files.length) throw Error("Choose at least one MP4 video.");
  files = files.slice(0, MAX_LOCAL_DECKS);
  const clips: Clip[] = [];
  try {
    for (const file of files) {
      const input = new Input({ formats: [MP4], source: new BlobSource(file) });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw Error("No readable video track in " + file.name);
        const duration = await track.computeDuration(),
          stats = await track.computePacketStats(100);
        if (!(duration > 0) || !(stats.averagePacketRate > 0))
          throw Error("Invalid duration or frame rate");
        const sha256 = await fingerprint(await file.arrayBuffer());
        clips.push({
          url: URL.createObjectURL(file),
          sha256,
          duration,
          fps: stats.averagePacketRate,
          width: track.displayWidth,
          height: track.displayHeight,
        });
      } finally {
        input.dispose();
      }
    }
    return clips;
  } catch (e) {
    clips.forEach((c) => URL.revokeObjectURL(c.url));
    throw e;
  }
}
export function localAudioGrid(buffer: AudioBuffer, bpm: number): Grid {
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300)
    throw Error("Enter a BPM between 30 and 300.");
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    ),
    data = channels[0],
    hop = Math.max(1, Math.round(buffer.sampleRate * 0.02)),
    energy: number[] = [];
  for (let start = 0; start < data.length; start += hop) {
    let sum = 0;
    const stop = Math.min(start + hop, data.length);
    for (let i = start; i < stop; i++)
      for (const channel of channels) sum += channel[i] * channel[i];
    energy.push(Math.sqrt(sum / ((stop - start) * channels.length)));
  }
  const max = energy.reduce((peak, value) => Math.max(peak, value), 1e-9),
    events: { time: number; strength: number }[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    const strength = (energy[i] - energy[i - 1]) / max,
      time = i * 0.02;
    if (
      strength > 0.08 &&
      energy[i] >= energy[i + 1] &&
      (!events.length || time - events.at(-1)!.time > 0.12)
    )
      events.push({ time, strength: Math.min(1, strength * 4) });
  }
  if (buffer.duration <= 60 / bpm)
    throw Error("Choose audio longer than one beat at the selected BPM.");
  const beats = Array.from(
    { length: Math.ceil((buffer.duration * bpm) / 60) },
    (_, i) => (i * 60) / bpm,
  );
  return {
    beats,
    duration: buffer.duration,
    bpm,
    onsets: events,
    triggerChannels: events.length
      ? [{ name: "local-energy", events }]
      : [
          {
            name: "manual-beat",
            events: beats.map((time) => ({ time, strength: 1 })),
          },
        ],
  };
}
