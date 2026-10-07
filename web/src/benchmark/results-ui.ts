import {hosted,browserResults} from "./result-storage";
import {
  summarizeRun,
  differences,
  validateRun,
  type SavedRun,
} from "./results-model";
const $ = (id: string) => document.getElementById(id)!;
let runs: SavedRun[] = [],
  imported: SavedRun[] = [],
  selected = new Set<string>(),
  sort = "id",
  ascending = false;
const columns = [
  ["engine", "Engine"],
  ["state", "Run type"],
  ["pattern", "Workload"],
  ["trigger", "Trigger"],
  ["groove", "Groove"],
  ["count", "Decks"],
  ["seconds", "Seconds"],
  ["seed", "Seed"],
  ["onTime", "On-time cuts"],
  ["p95", "Cut p95"],
  ["missed", "Missed"],
  ["fps", "Unique fps"],
  ["preload", "Preload"],
  ["memory", "Frame memory"],
] as const;
type Summary = ReturnType<typeof summarizeRun>;
const stamp = (r: Summary) => parseInt(r.id, 10) || 0;
const num = (v: unknown, d = 1) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";
function display(r: ReturnType<typeof summarizeRun>, key: string): string {
  switch (key) {
    case "onTime":
      return r.onTime === null ? "—" : num(r.onTime) + "%";
    case "p95":
      return r.p95 === null ? "—" : num(r.p95) + " ms";
    case "fps":
      return r.fps ? r.fps.map((v) => num(v)).join("–") : "—";
    case "seconds":
      return r.seconds === null ? "—" : num(r.seconds, 0);
    case "preload":
      return r.preload === null ? "—" : num(r.preload / 1000, 2) + " s";
    case "memory":
      return r.memory === null
        ? "Unmeasured"
        : num(r.memory / 2 ** 30, 2) + " GiB";
    default:
      return String((r as any)[key] ?? "—");
  }
}
function rows() {
  const engine = ($("filter-engine") as HTMLSelectElement).value,
    mode = ($("filter-mode") as HTMLSelectElement).value,
    q = ($("filter-search") as HTMLInputElement).value.toLowerCase();
  const history = ($("filter-history") as HTMLInputElement).checked;
  const all = [...runs, ...imported].map(summarizeRun);
  // Without history, keep only the newest versioned run per setup.
  const setup = (r: Summary) =>
    [r.backend, r.mode, r.pattern, r.trigger, r.groove, r.count, r.resolution, r.raw.duration, r.budget].join("|");
  const newest = new Map<string, Summary>();
  for (const r of all) {
    const prior = newest.get(setup(r));
    if (!prior || stamp(r) > stamp(prior)) newest.set(setup(r), r);
  }
  return all
    .filter(
      (r) =>
        history ||
        (r.mode !== "gate" && r.revision !== "legacy" && r.raw.completed && !r.raw.invalid?.length && newest.get(setup(r)) === r),
    )
    .filter(
      (r) =>
        (!engine || r.backend === engine) &&
        (!mode || r.mode === mode) &&
        (!q || JSON.stringify(r).toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      const x = (a as any)[sort],
        y = (b as any)[sort];
      if (x == null) return 1;
      if (y == null) return -1;
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y))) * (ascending ? 1 : -1)
      );
    });
}
/** Capacity is the question: most simultaneous decks first, then on-time rate, then cut p95. */
const byCapacity = (a: Summary, b: Summary) =>
  (Number(b.count) || 0) - (Number(a.count) || 0) || b.onTime! - a.onTime! || (a.p95 ?? 1e9) - (b.p95 ?? 1e9);
/** Fill the strategy cards above the tabs with each engine's best visible cut run. */
function renderStrategies(eligible: Summary[], topRun: Summary | undefined) {
  for (const card of document.querySelectorAll<HTMLElement>(".engines article[data-backend]")) {
    const backend = card.dataset.backend!;
    const best = eligible
      .filter((r) => r.backend === backend && r.onTime !== null)
      .sort(byCapacity)[0];
    let stat = card.querySelector<HTMLElement>(".engine-stat");
    if (!stat) {
      stat = document.createElement("div");
      stat.className = "engine-stat";
      card.append(stat);
    }
    card.classList.toggle("top", !!best && best === topRun);
    stat.replaceChildren();
    stat.classList.toggle("empty", !best);
    if (!best) {
      stat.textContent = backend === "libmedia" ? "Not scored" : "No current run";
      continue;
    }
    const big = document.createElement("strong");
    big.textContent = num(best.onTime) + "%";
    const detail = document.createElement("span");
    detail.textContent = `on time at ${best.count} deck${best.count === 1 ? "" : "s"} · p95 ${num(best.p95)} ms · ${best.missed ?? "—"} missed`;
    stat.append(big, detail);
    if (best === topRun) {
      const tag = document.createElement("em");
      tag.textContent = "TOP";
      stat.append(tag);
    }
  }
}
function render() {
  const data = rows();
  const eligible=data.filter(r=>r.raw.completed&&!r.raw.invalid?.length&&r.mode==='cuts'&&r.raw.schemaVersion);
  const best=new Map<string,number>();
  for(const key of ['onTime','p95','missed','preload']) {
    const values=eligible.map(r=>(r as any)[key]).filter(v=>typeof v==='number'&&Number.isFinite(v));
    if(values.length>1)best.set(key,key==='onTime'?Math.max(...values):Math.min(...values));
  }
  const topRun=eligible.filter(r=>r.onTime!==null).sort(byCapacity)[0];
  renderStrategies(eligible,topRun);

  $("result-count").textContent = String(runs.length + imported.length);
  const head = $("results-table").querySelector("thead")!,
    body = $("results-table").querySelector("tbody")!;
  head.replaceChildren();
  body.replaceChildren();
  const tr = document.createElement("tr");
  const choose = document.createElement("th");
  choose.textContent = "Compare";
  tr.append(choose);
  for (const [key, title] of columns) {
    const th = document.createElement("th"),
      button = document.createElement("button");
    button.textContent =
      title + (sort === key ? (ascending ? " ↑" : " ↓") : "");
    button.onclick = () => {
      ascending = sort === key ? !ascending : true;
      sort = key;
      render();
    };
    th.setAttribute(
      "aria-sort",
      sort === key ? (ascending ? "ascending" : "descending") : "none",
    );
    th.append(button);
    tr.append(th);
  }
  const rawHead = document.createElement("th");
  rawHead.textContent = "Evidence";
  tr.append(rawHead);
  head.append(tr);
  for (const r of data) {
    const tr = document.createElement("tr");
    tr.classList.toggle("selected", selected.has(r.id));
    tr.classList.toggle("top-run", r === topRun);
    const td = document.createElement("td"),
      check = document.createElement("input");
    check.type = "checkbox";
    check.checked = selected.has(r.id);
    check.setAttribute(
      "aria-label",
      "Compare " + r.engine + " " + r.pattern + " " + r.id,
    );
    check.onchange = () => {
      if (check.checked) {
        if (selected.size >= 2)
          selected.delete(selected.values().next().value!);
        selected.add(r.id);
      } else selected.delete(r.id);
      render();
    };
    td.append(check);
    tr.append(td);
    for (const [key] of columns) {
      const cell = document.createElement("td");
      cell.textContent = display(r, key);
      if(eligible.includes(r)&&best.has(key)&&(r as any)[key]===best.get(key)){
        cell.classList.add('best-metric');cell.title='Best recorded value in this view. Workloads and budgets may differ.';
        const badge=document.createElement('span');badge.className='best-label';badge.textContent='BEST';cell.append(badge);
      }

      if (key === "engine") {
        const sub = document.createElement("small");
        sub.textContent = `${r.resolution}p · revision ${r.revision}`;
        cell.append(sub);
      }
      if (key === "state") {
        cell.className =
          r.state === "Invalid" || r.mode === "gate" ? "warning" : "";
        cell.title = r.reason;
      }
      tr.append(cell);
    }
    const raw = document.createElement("td");
    if(r.raw.kind==='musical-run'){
      const reload=document.createElement('button');reload.textContent='Reload';reload.className='reload-run';reload.title="Load this run's settings in Playback lab";
      reload.onclick=()=>window.dispatchEvent(new CustomEvent('benchmark-reload',{detail:r.raw}));raw.append(reload);
    }

    if (r.raw.file) {
      const a = document.createElement("a");
      a.textContent = "JSON ↗";
      a.href = "/benchmark-results/" + encodeURIComponent(r.raw.file);
      raw.append(a);
    } else raw.append(document.createTextNode(" Imported"));
    tr.append(raw);
    body.append(tr);
  }
  if (!data.length) {
    const tr = document.createElement("tr"),
      td = document.createElement("td");
    td.colSpan = 16;
    td.textContent =
      "No matching runs. Change the filters or run a test in Playback lab.";
    tr.append(td);
    body.append(tr);
  }
  const compare = $("comparison");
  compare.replaceChildren();
  const picked = [...runs, ...imported]
    .map(summarizeRun)
    .filter((r) => selected.has(r.id));
  compare.hidden = picked.length === 0;
  if (picked.length) {
    const title = document.createElement("h3");
    title.textContent =
      picked.length === 1
        ? "Select one more run to compare"
        : "Side-by-side comparison";
    compare.append(title);
  }
  if (picked.length === 2) {
    const mismatch = differences(picked[0].raw, picked[1].raw),
      note = document.createElement("p");
    note.className = "compare-warning";
    note.textContent = mismatch.length
      ? "Different conditions: " +
        mismatch.join(", ") +
        ". Inspect the tradeoffs; this is not a controlled winner comparison."
      : "Matching recorded conditions. Short previews still do not establish a repeatable winner.";
    compare.append(note);
    const table = document.createElement("table");
    for (const [key, title] of columns) {
      const tr = document.createElement("tr");
      for (const text of [
        title,
        display(picked[0], key),
        display(picked[1], key),
      ]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        tr.append(cell);
      }
      table.append(tr);
    }
    compare.append(table);
  }
}
async function refresh() {
  try {
    const response = await fetch("/benchmark-results");
    if (!response.ok) throw Error("Could not load saved runs");
    runs = [...await response.json(),...(hosted?await browserResults():[])];
    $("results-status").textContent =
      `${runs.length} saved runs. Showing the latest run per setup; tick Show history for older revisions, legacy runs and probes.`;
    render();
  } catch (e) {
    $("results-status").textContent = String(e);
    render();
  }
}
for (const view of ["results", "lab", "method"])
  $("tab-" + view).onclick = () => {
    if (view !== "lab") window.dispatchEvent(new Event("benchmark-leave-lab"));
    document.body.classList.toggle("lab-view", view === "lab");
    for (const v of ["results", "lab", "method"]) {
      $(v + "-panel").hidden = v !== view;
      $("tab-" + v).setAttribute("aria-pressed", String(v === view));
    }
    if (view === "results") void refresh();
  };
for (const id of ["filter-engine", "filter-mode", "filter-search", "filter-history"])
  $(id).addEventListener("input", render);
$("refresh-results").onclick = () => void refresh();
$("print-results").onclick = () => window.print();
$("import-results").onclick = () =>
  ($("import-file") as HTMLInputElement).click();
$("import-file").onchange = async () => {
  try {
    for (const file of ($("import-file") as HTMLInputElement).files ?? []) {
      if (file.size > 32 * 1024 * 1024)
        throw Error("Result file exceeds 32 MiB");
      const parsed = JSON.parse(await file.text());
      for (const r of Array.isArray(parsed) ? parsed : [parsed]) {
        validateRun(r);
        const { file: ignored, ...summary } = r;
        imported.push({ ...summary, id: "import-" + crypto.randomUUID() });
      }
    }
    $("results-status").textContent =
      "Imported results stay in this page session.";
    render();
  } catch (e) {
    $("results-status").textContent = String(e);
  }
};
$("export-results").onclick = () => {
  const escape = (s: string) =>
    '"' + (/^[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  const data = rows();
  const csv = [
    columns.map((c) => c[1]),
    ...data.map((r) => columns.map(([k]) => display(r, k))),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "frame-lab-results.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("benchmark-result-saved", () => void refresh());
void refresh();

$("export-json").onclick = async () => {
  try {
    const reports = await Promise.all(
      rows().map(async (row) => {
        if (!row.raw.file) return row.raw;
        const response = await fetch(
          "/benchmark-results/" + encodeURIComponent(row.raw.file),
        );
        if (!response.ok)
          throw Error("Could not retrieve raw result " + row.raw.file);
        return response.json();
      }),
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(reports, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "frame-lab-results.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("results-status").textContent =
      `Exported ${reports.length} full results, including recorded events.`;
  } catch (error) {
    $("results-status").textContent = String(error);
  }
};
