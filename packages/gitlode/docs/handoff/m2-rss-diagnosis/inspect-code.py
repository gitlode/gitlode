"""Inspect fixed Git blobs and preserved bundles without running product code."""
import hashlib
import json
import pathlib
import subprocess
import tarfile

OUT = pathlib.Path(__file__).resolve().parent
REPO = OUT.parents[4]
FIXED = "8fffcc0d8e11bb061d70bf870f262092d559c5f2"
LEGACY = "76b124e23fcc069be1278629cf01b62ae1456c7a"
FILES = [
    "packages/gitlode/test/support/performance-harness.ts",
    "packages/gitlode/src/index.ts",
    "packages/gitlode/src/execution/execute-run.ts",
    "packages/gitlode/src/execution/worker-client.ts",
    "packages/gitlode/src/execution/worker-entry.ts",
    "packages/gitlode/src/extraction/extraction-pipeline.ts",
    "packages/gitlode/src/output/jsonl-file-writer.ts",
    "packages/git-adapters/src/git-impl/isomorphic-git-adapter.ts",
]
FILES += ["packages/gitlode/src/execution/telemetry/worker-telemetry-session.ts"]
blobs = []
for revision in [LEGACY, FIXED]:
    for name in FILES:
        result = subprocess.run(["git", "-c", f"safe.directory={REPO.as_posix()}", "show", f"{revision}:{name}"], cwd=REPO, capture_output=True)
        if result.returncode:
            assert revision == LEGACY and ("telemetry" in name or "performance-harness" in name)
            continue
        blobs.append({"revision": revision, "path": name, "sha256": hashlib.sha256(result.stdout).hexdigest(), "bytes": len(result.stdout)})

archives = []
for archive in ["candidate-consumer", "legacy-runtime"]:
    path = pathlib.Path("D:/gitlode_test/m2-freeze-8fffcc0-20261002/inputs") / f"{archive}.tar.gz"
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    bundles = []
    with tarfile.open(path, "r|gz") as tar:
        for member in tar:
            if not member.isfile() or "/dist/" not in member.name or not member.name.endswith(".js"):
                continue
            if archive == "candidate-consumer" and "/node_modules/gitlode/" not in member.name:
                continue
            if archive == "legacy-runtime" and not member.name.startswith("legacy-0.12.0/dist/"):
                continue
            data = tar.extractfile(member).read()
            text = data.decode("utf8")
            tokens = ["sdk-trace-base", "sdk-metrics", "BasicTracerProvider", "MeterProvider", "AlwaysOffSampler", "createDegradedProviders", "LocalSpanProcessor", "ProfileReportBuilder", "new Worker", "new Worker(", "noopInstrumentation"]
            bundles.append({"member": member.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "tokens": {t: text.count(t) for t in tokens}})
            # New review copies are derived artifacts, outside sealed inputs.
            review = REPO / ".cache/m2-rss-diagnosis"
            review.mkdir(parents=True, exist_ok=True)
            (review / f"{archive}-{pathlib.PurePosixPath(member.name).name}.txt").write_text(text, encoding="utf8")
    archives.append({"path": str(path), "sha256": digest, "bundles": bundles})
(OUT / "code-identities.json").write_bytes((json.dumps({"blobs": blobs, "archives": archives}, indent=2) + "\n").encode("utf8"))
print(json.dumps(archives, indent=2))
