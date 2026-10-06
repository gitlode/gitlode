"""Read saved evidence only; write derived RSS tables beside this script."""
import csv
import hashlib
import json
import pathlib
import statistics as st
import sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "D:/gitlode_test")
OUT = pathlib.Path(__file__).resolve().parent
ATTEMPTS = {
    "M0": "m0-one-target-20260910T065854Z-a53a5b8",
    "first": "m2-first-target-8fffcc0-20261002",
    "controlled": "m2-controlled-8fffcc0-20261005",
}
inputs, trajectories, summaries, manifests = [], [], [], []

def consume(path):
    data = path.read_bytes()
    inputs.append({"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return json.loads(data)

def stats(values):
    med = st.median(values)
    mad = st.median(abs(v - med) for v in values)
    return {"median": med, "mad": mad, "madRatio": mad / med}

for attempt, folder in ATTEMPTS.items():
    root = ROOT / folder
    manifest_path = root / ("evidence.sha256" if attempt == "M0" else "sealed-manifest.json")
    manifest_bytes = manifest_path.read_bytes()
    manifests.append({"path": str(manifest_path), "sha256": hashlib.sha256(manifest_bytes).hexdigest()})
    if attempt == "M0":
        expected = {line.split("  ", 1)[1][2:]: line.split("  ", 1)[0] for line in manifest_bytes.decode().splitlines()}
    else:
        expected = {v["path"]: v["sha256"] for v in json.loads(manifest_bytes)["files"]}
    input_start = len(inputs)
    for stage, suffix in [("legacy", "capture-legacy"), ("disabled", "measure")]:
        directory = ROOT / folder / stage
        artifact = consume(directory / f"commit_heavy_repository-isomorphic-git-{suffix}.json")
        supervision = [consume(p) for p in sorted(directory.glob("supervision-*.json")) if "-run-" not in p.name]
        events = [e for s in supervision for e in s.get("events", [])]
        groups = {}
        for label, runs in artifact["runs"].items():
            if not isinstance(runs, list):
                continue
            measured = [r for r in runs if r["phase"] == "measured"]
            assert len(measured) == 7 and len(runs) == 9
            groups[label] = {"wallMs": stats([r["elapsedMs"] for r in measured]), "peakBytes": stats([r["peakRss"]["peakBytes"] for r in measured])}
            for r in runs:
                samples = r["peakRss"]["samples"]
                peak = max(s["rssBytes"] for s in samples)
                assert peak == r["peakRss"]["peakBytes"]
                assert all(a["elapsedMs"] < b["elapsedMs"] for a, b in zip(samples, samples[1:]))
                peaks = [s["elapsedMs"] for s in samples if s["rssBytes"] == peak]
                # Left-held sampled estimate, excluding the unsampled start/end intervals.
                high = sum(b["elapsedMs"] - a["elapsedMs"] for a, b in zip(samples, samples[1:]) if a["rssBytes"] >= peak * .95)
                longest, current = 0, 0
                for a, b in zip(samples, samples[1:]):
                    current = current + b["elapsedMs"] - a["elapsedMs"] if a["rssBytes"] >= peak * .95 else 0
                    longest = max(longest, current)
                gaps = [b["elapsedMs"] - a["elapsedMs"] for a, b in zip(samples, samples[1:])]
                matches = [e for e in events if (p := e.get("progress", {})).get("stage") == "execution" and p.get("operation") == "release-cli" and p.get("state") == r["state"] and p.get("phase") == r["phase"] and p.get("iteration") == r["pairIndex"] + 1]
                trajectories.append({"attempt": attempt, "stage": stage, "label": label, "phase": r["phase"], "pairIndex": r["pairIndex"], "order": r["order"], "wallMs": r["elapsedMs"], "sampleCount": len(samples), "firstMs": samples[0]["elapsedMs"], "firstBytes": samples[0]["rssBytes"], "peakBytes": peak, "firstPeakMs": peaks[0], "lastPeakMs": peaks[-1], "lastMs": samples[-1]["elapsedMs"], "lastBytes": samples[-1]["rssBytes"], "above95PeakMs": high, "longestAbove95PeakMs": longest, "medianGapMs": st.median(gaps), "maxGapMs": max(gaps), "eventMatches": len(matches), "eventElapsedMs": matches[0]["elapsedMs"] if matches else None, **{f"bin{i}MedianBytes": st.median([s["rssBytes"] for s in samples if i / 5 <= s["elapsedMs"] / r["elapsedMs"] < (i + 1) / 5]) for i in range(5)}})
        summary = {"attempt": attempt, "stage": stage, "revisions": artifact["revisions"], "groups": groups, "savedEvaluation": artifact.get("evaluation", artifact.get("formalEvaluation"))}
        if stage == "disabled":
            b = [r for r in artifact["runs"]["baseline"] if r["phase"] == "measured"]
            c = [r for r in artifact["runs"]["candidate"] if r["phase"] == "measured"]
            assert [r["pairIndex"] for r in b] == [r["pairIndex"] for r in c] == list(range(7))
            summary["pairs"] = [{"pairIndex": x["pairIndex"], "order": x["order"], "ratio": y["elapsedMs"] / x["elapsedMs"], "deltaPeakBytes": y["peakRss"]["peakBytes"] - x["peakRss"]["peakBytes"]} for x, y in zip(b, c)]
            base = groups["baseline"]["peakBytes"]["median"]
            delta = groups["candidate"]["peakBytes"]["median"] - base
            summary.update(allowedBytes=max(8 * 1024**2, base * .05), deltaBytes=delta, overhead=st.median(p["ratio"] for p in summary["pairs"]) - 1)
            assert delta == artifact["evaluation"]["peakRssIncreaseBytes"]
            assert summary["overhead"] == artifact["evaluation"]["wallClockOverhead"]
        summaries.append(summary)
    for item in inputs[input_start:]:
        relative = pathlib.Path(item["path"]).relative_to(root).as_posix()
        assert item["sha256"] == expected[relative], relative

(OUT / "derived.json").write_bytes((json.dumps({"manifests": manifests, "inputs": inputs, "summaries": summaries}, indent=2) + "\n").encode("utf8"))
with (OUT / "trajectories.csv").open("w", newline="", encoding="utf8") as f:
    writer = csv.DictWriter(f, fieldnames=list(trajectories[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(trajectories)
print(json.dumps({"runs": len(trajectories), "summaries": summaries}, indent=2))
