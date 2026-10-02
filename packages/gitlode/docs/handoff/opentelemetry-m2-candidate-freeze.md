# M2 fixed candidate preparation (F)

## Assignment

The human starts a separate preparation conversation; trunk reviews its outcome before measurement.
Install/build/package checks and archive creation may take substantial execution time independently
of model reasoning. Announce stages and preflight the operator deadline before long commands.
No calibration, capture, comparison or aggregation measurement is authorized in this packet.

Fixed product and harness OID: `8fffcc0d8e11bb061d70bf870f262092d559c5f2`.
Legacy product OID: `76b124e23fcc069be1278629cf01b62ae1456c7a`.
The product OID is on M2 after readiness squash `7696c4c`; that delta is handoff documents only.
Trunk checked actual remote M2 at this OID, integration at `7e0055a`, and legacy ancestry.
The M2-only history contains accepted profile/system/readiness squashes and coherent design/planning
commits. Retain this history without rewriting; later M2-to-integration uses a human-approved normal
merge to preserve measured ancestry. This is a history disposition, not PR authorization.

Read the recovery plan, M0 result, profile integration evidence, readiness record, performance design
and catalog, harness guide, and build/test/release guidance. They own contracts and previous identities.

## Work location and preservation

Use an isolated Linux/ext4 detached checkout of the fixed OID, Linux-native toolchain and a fresh
external TEMP/cache/artifact root. Record exact commands and versions; keep TEMP paths short enough
for tsx Unix sockets. Do not rebuild historical release snapshots or alter sealed archives.
The shared Windows checkout remains on `feature/otel-redesign_M2`. This is preparation, not a new
implementation slice: no child branch is needed. Append only this packet's outcome on M2, commit and
normally push it; verify any concurrent M2 changes before doing so. Do not switch the shared checkout
to the detached measurement source. New code changes require return to trunk for a separate slice.

Create and normally push these preservation refs at the exact fixed OID, before measurement:

- `archive/otel-m2-product-8fffcc0d8e11`
- `archive/otel-m2-harness-8fffcc0d8e11`

If a ref exists, verify equality; never move or force it. Confirm actual remote OIDs. These refs keep
Git objects available; they do not prove runtime identity, test success or performance acceptance.

## Finite preparation

1. Verify clean fixed checkout and required legacy/product/harness Git objects and ancestry. Preserve
   a Git bundle sufficient to restore those revisions, and verify it. Keep the acceptance record blocked.
2. Inspect and preflight the Linux external launcher with a disposable deadline case before install
   or build. Preserve commands, original results, process identities and observation limits. Reuse
   existing launcher knowledge; do not build a new framework or claim its group covers escaped groups.
3. Run one `npm ci` and release build in the fresh fixed checkout. Validate the resulting package with
   publint and installed-package validation using existing canonical commands and their typing check.
   Record the actual commands and consumer/compiler/tarball identities. No full suite or Windows
   campaign is assigned: prior functional evidence and reviewed deltas remain explicitly attributed.
4. Preserve the built candidate CLI/worker and full runtime dependency closure, toolchain identity,
   harness execution dependencies and aggregation build inputs. Separate mutable execution work areas
   from sealed inputs. Record symlink targets and ensure archives are restorable without dangling
   references to an unpreserved checkout or dependency directory. Inventory hashes before/after checks.
5. Inspect the existing immutable legacy runtime identified by the M0 result. Verify its recorded
   provenance and complete usable closure; do not silently rebuild it or substitute another baseline.
   If unavailable or inconsistent, retain the finding and return the specific preparation blocker.
6. Preserve the M0 selected manifest/calibration artifacts separately from the fixed repository's
   incomplete manifest. Assess environment, recipe, harness/protocol and artifact compatibility,
   including schema v2 consumers. Report whether reuse of the old calibrated target is supported,
   unsupported or unresolved, with concrete reasons. Do not rewrite evidence, assume the old 4,430
   quantity is current acceptance, recalibrate, or run a one-target measurement as a smoke check.
7. Save a new archive under `D:/gitlode_test` and its Linux source area, with a sealed manifest and
   copy verification. Separate inputs/runtime archives from logs and output evidence. External backup
   is distinct from two local OS copies; report the actual preservation achieved.

Use existing bounded failure policy: retain first logs, correct clearly identified operator setup
errors with evidence, but stop on unexplained/product failures. No favorable automatic retries.
Do not clean old residue, expand scripts organization, fix unrelated TypeScript diagnostics, change
thresholds or recipes, update integration/main, create PRs, merge, or change release acceptance.

## Return and next boundary

Append a concise outcome here with exact product/harness/legacy OIDs and archive refs, Linux setup,
commands/results, runtime/package hashes, manifest locations/hash, bundle verification, closure and
copy checks, compatibility assessment and unresolved blockers. Distinguish old evidence from new
execution. Record final documentation checkpoint and remote equality in the session return.

Preparation can preserve the fixed candidate but cannot accept T13B, M2 or release. Trunk reviews F
evidence and decides calibration reuse versus a justified new attempt before issuing target-specific
measurement packets. GNOME, final combined-candidate verification and T13C remain separate obligations.
