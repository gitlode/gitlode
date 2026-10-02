// Read saved artifacts only; never launch a workload or modify source evidence.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.argv[2];
const historical = process.argv[3];
const identities = [];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sealed = read(path.join(root, "sealed-manifest.json"));
for (const entry of sealed.files) {
  const bytes = fs.readFileSync(path.join(root, entry.path));
  if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256)
    throw new Error("M2 sealed evidence mismatch: " + entry.path);
}
const m0Manifest = fs.readFileSync(path.join(historical, "evidence.sha256"));
const m0Entries = m0Manifest.toString().trim().split(/\r?\n/);
for (const line of m0Entries) {
  const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
  if (!match || hash(fs.readFileSync(path.join(historical, match[2]))) !== match[1])
    throw new Error("M0 evidence mismatch: " + line);
}
function read(file) {
  const bytes = fs.readFileSync(file);
  identities.push({ file, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
  return JSON.parse(bytes);
}
const median = (xs) => {
  const ys = [...xs].sort((a, b) => a - b);
  const i = Math.floor(ys.length / 2);
  return ys.length % 2 ? ys[i] : (ys[i - 1] + ys[i]) / 2;
};
const stats = (xs) => {
  const center = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - center)));
  return {
    medianMs: center,
    madMs: mad,
    madPercent: (100 * mad) / center,
    minimumMs: Math.min(...xs),
    maximumMs: Math.max(...xs),
  };
};
function stage(base, name) {
  const dir = path.join(base, name);
  const rows = fs
    .readdirSync(dir)
    .filter((f) => /-run-.*-(warmup|measured)-\d+-(legacy_off|target_off|target_on)\.json$/.test(f))
    .map((f) => {
      const x = read(path.join(dir, f));
      return { file: f, ...x.run };
    });
  const terminalFile = fs
    .readdirSync(dir)
    .find((f) => /^supervision-[\w-]+\.json$/.test(f) && !f.includes("-run-"));
  const terminal = read(path.join(dir, terminalFile));
  const starts = terminal.events.filter(
    (e) => e.progress.stage === "execution" && e.progress.operation === "release-cli",
  );
  const chronology = starts.map((e) => {
    const p = e.progress;
    const r = rows.find(
      (r) => r.phase === p.phase && r.state === p.state && r.pairIndex === p.iteration - 1,
    );
    if (!r) throw new Error("Missing raw run for saved execution event");
    const gaps = r.peakRss.samples
      .slice(1)
      .map((s, i) => s.elapsedMs - r.peakRss.samples[i].elapsedMs);
    return {
      phase: r.phase,
      pairIndex: r.pairIndex,
      order: r.order,
      state: r.state,
      elapsedMs: r.elapsedMs,
      startUtc: new Date(Date.parse(terminal.startedAt) + e.elapsedMs).toISOString(),
      sampleCount: r.peakRss.samples.length,
      medianSampleGapMs: median(gaps),
      maximumSampleGapMs: Math.max(...gaps),
    };
  });
  if (chronology.length !== rows.length) throw new Error("Incomplete chronology");
  const summary = {};
  for (const state of new Set(rows.map((r) => r.state))) {
    summary[state] = stats(
      rows.filter((r) => r.state === state && r.phase === "measured").map((r) => r.elapsedMs),
    );
  }
  const pairs = rows
    .filter((r) => r.phase === "measured" && r.state === "legacy_off")
    .sort((a, b) => a.pairIndex - b.pairIndex)
    .map((b) => {
      const c = rows.find(
        (r) => r.phase === "measured" && r.state === "target_off" && r.pairIndex === b.pairIndex,
      );
      if (!c) return null;
      if (b.order !== c.order || b.order !== (b.pairIndex % 2 ? "B-A" : "A-B"))
        throw new Error("Pair order mismatch");
      return { pairIndex: b.pairIndex, ratio: c.elapsedMs / b.elapsedMs };
    })
    .filter(Boolean);
  return {
    chronology,
    summary,
    pairs,
    overheadPercent: pairs.length ? 100 * (median(pairs.map((p) => p.ratio)) - 1) : null,
  };
}
const calibration = read(
  path.join(root, "inputs/m0/calibration/commit_heavy_repository-isomorphic-git-calibration.json"),
);
const selected = calibration.attempts.find((a) => a.quantity === calibration.selectedQuantity);
const formal = read(
  path.join(root, "disabled/commit_heavy_repository-isomorphic-git-measure.json"),
);
const progressFile = path.join(root, "evidence/disabled-progress.jsonl");
const progressBytes = fs.readFileSync(progressFile);
identities.push({ file: progressFile, sha256: hash(progressBytes) });
const progress = progressBytes
  .toString()
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
const output = {
  integrity: {
    m2EntriesVerified: sealed.files.length,
    m0EntriesVerified: m0Entries.length,
    m0EvidenceManifestSha256: hash(m0Manifest),
  },
  m2Capture: stage(root, "legacy"),
  m2Disabled: stage(root, "disabled"),
  m0Capture: stage(historical, "legacy"),
  m0Disabled: stage(historical, "disabled"),
  calibration: {
    selectedQuantity: calibration.selectedQuantity,
    attempts: calibration.attempts.map((a) => ({
      ordinal: a.ordinal,
      quantity: a.quantity,
      ...stats(a.measuredRuns.map((r) => r.elapsedMs)),
    })),
    selectedWarmupsMs: selected.warmupRuns.map((r) => r.elapsedMs),
    selectedMeasuredMs: selected.measuredRuns.map((r) => r.elapsedMs),
  },
  identities,
  formalEvaluation: formal.evaluation,
  progress: progress.map((p) => ({
    observedAt: p.observedAt,
    current: p.current,
    loadavg: p.loadavg,
  })),
};
const b = output.m2Disabled.summary.legacy_off;
const c = output.m2Disabled.summary.target_off;
const reasons = [];
if (b.madPercent > 5) reasons.push("baseline MAD exceeds 5 percent");
if (c.madPercent > 5) reasons.push("candidate MAD exceeds 5 percent");
if (b.medianMs < 10000)
  reasons.push("fixture median is below the 10 second wall-clock gate minimum");
output.recomputedReasons = reasons;
if (JSON.stringify(reasons) !== JSON.stringify(formal.evaluation.reasons))
  throw new Error("Formal reasons mismatch");
for (const runs of Object.values(formal.runs)) {
  for (const run of runs) {
    const raw = output.m2Disabled.chronology.find(
      (r) => r.state === run.state && r.phase === run.phase && r.pairIndex === run.pairIndex,
    );
    if (!raw || raw.elapsedMs !== run.elapsedMs || raw.order !== run.order)
      throw new Error("Formal/raw mismatch");
  }
}
process.stdout.write(JSON.stringify(output, null, 2) + "\n");
