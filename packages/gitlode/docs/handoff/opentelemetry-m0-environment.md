# M0 Linux Environment Preparation

## Status and scope

Environment preparation is complete as of 2026-09-09. The environment is ready for the separate M0
harness-supervision assignment in the [recovery plan](instrumentation-opentelemetry-recovery-plan.md).
M0 itself remains incomplete: neither formal calibration nor performance acceptance was performed.

This document records machine-specific continuation context, not a new telemetry contract. The
preparation scripts and raw evidence are in the archive below, outside published package contents.

## Prepared environment

| Item                      | Value                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| WSL distribution          | Existing Ubuntu 26.04 LTS, WSL2; Docker Desktop was not modified                          |
| Kernel / architecture     | `6.18.33.1-microsoft-standard-WSL2` / x64                                                 |
| Toolchain                 | Linux Node `22.23.1`, bundled npm `10.9.8`, Git `2.53.0`                                  |
| CPU / visible memory      | AMD Ryzen 9 3900X, 24 logical CPUs; 67,389,493,248 bytes visible to Linux                 |
| Linux root                | `/home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b`                             |
| Filesystem                | Linux ext4 for source, bundles, smoke repository, outputs, and temporary files            |
| Windows archive           | `D:\gitlode_test\m0-20260909-a97829b`                                                     |
| Candidate source revision | `a97829b5315d42fbfa2212b718258099e7c90498`                                                |
| Legacy revision           | `76b124e23fcc069be1278629cf01b62ae1456c7a` (previously accepted installed 0.12.0 release) |

The Linux toolchain is a private extracted official distribution. Its archive passed the official
`SHASUMS256.txt` check. No shell startup file, global Node installation, WSL setting, or Windows
development bundle was changed. Elevated tool execution was used for the authorized WSL preparation.

In an Ubuntu bash session, activate the prepared environment explicitly:

```bash
source /home/t-wakabayashi/gitlode-performance/m0-20260909-a97829b/environment.sh
node --version
npm --version
git --version
```

The activation script sets `GITLODE_M0_ROOT`, a Linux-only `PATH`, `TMPDIR` below that root, and an
isolated npm cache. Do not execute measurements on `/mnt/c` or `/mnt/d`. The D-drive archive is for
evidence transfer and preservation, not the timed filesystem.

## Release snapshots and provenance

Paths below are relative to the Linux root:

- `source/`: clean detached checkout of the candidate revision from `inputs/candidate.bundle`.
  Linux `npm ci` used the committed lockfile, and `npm run build:release` passed.
- `releases/legacy-0.12.0/dist/index.js`: copied with the complete existing nested dependency tree
  from the previously accepted Windows-installed release. The CLI SHA-256 remains
  `379ed9dca9c25c2a7715371f3c64631317c98a3c2dd7a55f64bcbbac3cca5779`.
- `releases/candidate/node_modules/gitlode/dist/index.js`: the Linux-built, npm-packed candidate,
  installed into an isolated consumer. Its consumer `package-lock.json` and installed dependencies
  are preserved. Runtime resolution is recorded separately from the source build lockfile.
- `bundle-provenance.json`: file-by-file hashes and symlink targets for both release trees, input
  hashes, identities, and paths. All release symlinks were verified to stay inside their snapshot.
- `logs/legacy-dependencies.json` and `logs/candidate-dependencies.json`: successful
  `npm ls --omit=dev --all --json` results for the preserved runtime dependency closures.

The release trees and extracted Node toolchain have write permissions removed. Do not rebuild or
install into them. A later source change requires a new candidate identity; this preparation snapshot
is not automatically the eventual M1 or release candidate. Both CLIs display package version 0.12.0,
so use revisions and content inventories, not the displayed version, to distinguish them.

## Checks completed

- Both preserved CLIs start under Linux Node and report their version.
- A separate Node child holding an allocation for 2.5 seconds was sampled through the existing
  `sampleChildRss` helper: 127 samples, configured 20 ms interval, maximum observed gap about 21.08 ms.
- Six installed-CLI per-file smoke extractions ran: both Git adapters with `legacy_off`,
  `target_off`, and `target_on`. Every run exited successfully and supplied external RSS samples.
- The deterministic smoke fixture yielded five commits and twelve records in each run. For each
  adapter, legacy/new-disabled and new-disabled/new-enabled output and normalized checkpoint
  comparisons passed using the existing performance behavior comparator.
- The largest observed sample gap across those CLI runs was about 21.22 ms; none exceeded 25 ms.
  This establishes observed probe cadence, not a guarantee about every future formal run.
- The source checkout remained clean after build and probe. The recovery fixture manifest was not
  calibrated or changed.

These sub-second smoke extractions provide environment and behavioral evidence only. They are not
the cataloged repeated performance comparisons. Profile sidecar acceptance, aggregation N/4N,
formal calibration, and the full verification matrix remain to be run in their planned slices.

## Evidence archive

`D:\gitlode_test\m0-20260909-a97829b` contains:

- `environment-readiness.json`: environment, raw RSS samples, child outcomes, normalized behavior,
  comparison results, and an explicit `formalPerformanceEvidence: false` marker;
- `bundle-provenance.json` and `environment.sh`;
- `logs/`: dependency installation, build, packing, dependency inventory, and probe logs; and
- `environment-snapshot.tar.gz` with its `environment-snapshot.sha256` checksum.

The 42,313,675-byte archive preserves release trees, Git bundle, source lockfile, unchanged fixture
manifest, official Node download/checksums, preparation/probe scripts, logs, and readiness evidence.
Its SHA-256 is `2f12bdf12d0b675517ebd057f6477aafc628b4b1a3e39be0c9da82e10aaf45a2`; verification after
archiving passed. Linux build dependencies can be restored using the preserved source lockfile;
their mutable installation directory is not part of the archive.

Preserve this evidence. Any repeat must use a new attempt directory; the archived probe script
records this original environment and is not an instruction to overwrite the original run.

## Next bounded assignment: M0 harness supervision

Read the recovery plan, this environment record, and the canonical telemetry performance design,
catalog, and contributor harness guide. Inspect the current source diff before choosing the next
fixed revision; the preparation candidate does not include future supervision changes.

Own only development harness observability and bounded execution. Establish durable supervision
contracts, then implement stage/iteration/PID/elapsed reporting, bounded failure diagnostics,
separate preparation and child deadlines, and cleanup of owned processes with preserved evidence.
Use deliberate stalled/failed children and test-scale workflows to validate those mechanisms.

Do not change production telemetry, accepted overhead thresholds, calibration selection, frozen
quantities, profile presentation, or workspace layout. Do not start full formal measurements in this
implementation session. Return the fixed harness revision, required test evidence, and an exact
one-target measurement packet for a separate execution session using Linux-native paths.

The preparation probe had its own outer deadline and child cleanup. Those temporary probe safeguards
do not repair the production development harness; its indefinite-waiting risk is still open.
