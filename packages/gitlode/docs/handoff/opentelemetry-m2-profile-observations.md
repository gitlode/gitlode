# M2 profile remaining observations

Follow the [integration evidence](opentelemetry-m2-profile-integration.md) and
[M2 continuation plan](instrumentation-opentelemetry-recovery-plan.md). These observations remain
unresolved; cumulative first-run success does not establish a fix. No further reproduction campaign
or retry-until-green is assigned. Existing Attributes fixture typing is separate and is not expanded
into an integration blocker. Publish acceptance stays blocked.

## Windows timeout / EBUSY

The original Windows failure log was not found in the bounded evidence review. The report first
appears at `f0558856f018f24b5766d6ed8b5d241f9cb02747`: a five-second repository-fixture timeout and
EBUSY cleanup preceded a successful suite. Failed test/source OID, dirty state, command, exit, syscall,
path, stack, fixture/process ownership and timeout-to-cleanup order remain unknown. Do not infer them
from the successful run or catalog correction `8123fb5`. The catalog correction does not repair
fixture cancellation or cleanup. Full search boundary/results remain in Git in the former styling
review at `9fc0ee9c80858ca14e7cabd019421614c94fe9cf`. No concrete implementation fix is supported.

## Linux ENOTEMPTY and supervisor attribution

Saved CI attempt 1 at `f0558856f018f24b5766d6ed8b5d241f9cb02747` failed in
`release-acceptance.test.ts` / `rejects unknown and wrong-scope checks`, removing
`/tmp/gitlode-release-acceptance-DNM8KB/.git/objects/pack`. Historical fixture/writer identity and
process/file timeline are unavailable. CI used Ubuntu 24.04.5, Node 22.23.2, Git 2.55.0; kernel,
fixture filesystem and effective maintenance configuration are unknown.

Bounded diagnosis at `68daa1f1656eb02ec8f31c226ce4a274e295371d` compared entry `76486d2` and
failure `f055885`: exactly three selected-test invocations per source (six total), each one pass /
49 skipped, 45-second limits; only round 3 used a fixed bounded CPU workload. ENOTEMPTY was not
reproduced. Local Ubuntu 26.04/WSL2, Node 22.23.1, Git 2.53.0, ext4 checkouts and tmpfs fixtures
differed from CI. Trace2 observed detached automatic-maintenance launch, but no pack writes or
attributable writer. No final owned live process was observed; scans were not exhaustive. The
Node child-close wrapper was bypassed by `execFile`'s custom promisifier, leaving zero measured
close records. Trace2 exit is not Node close or descendant quiescence. Instrumentation and workload
can affect scheduling. Automatic maintenance remains a hypothesis; no repair is justified.

Evidence: `/home/t-wakabayashi/gitlode-performance/m2-fixture-20261002-68daa1f`, hash-verified mirror
`D:/gitlode_test/m2-fixture-20261002-68daa1f`, 58 evidence files. Anchors:

- `SHA256SUMS`: `c2200a2e067c0b0c3a06ef43ce4c25afed882d4d387c20ba43284c3340505c4e`.
- `ci-attempt-1.log`: `b6f0b19b02e91229c9f2e2389db6c7dfe02dcf1254cef091f93019179889bdf0`.
- `timeline.json`: `2a291c6e722a0acf746d5beecbc25c61b6ae36f433dae9e1557ab02b4f217e62`.

The separate attempt-2 supervisor R observation is mapped to the same CI source and
`performance-supervisor.test.ts` / `kills an owned grandchild that ignores TERM when the worker exits first`.
Correction `97cab518ddd77667e56010ca1d902ded0f309c8d` is accepted at
`68daa1f1656eb02ec8f31c226ce4a274e295371d`; historical R causation remains uncertain. Correction
evidence is `/home/t-wakabayashi/gitlode-performance/m2-cleanup-20261001-c53206a`, 76-file pre-CI
manifest anchor `ed01f92ffdd4f8b9da96f4aa41d68c0b62223d3250af801d96c805591c56e480`; independent
review evidence is `/home/t-wakabayashi/gitlode-performance/m2-cleanup-review-20261001`. These are
separate from the unavailable Windows failure log and cumulative candidate evidence.

If ordinary validation fails again, preserve full unedited logs, exact command/cwd/OID/dirty diff,
test/config/timeout/exit, platform/toolchain/filesystem, fixture paths, stacks and syscall, known
spawn/exit/close and cleanup timestamps, PID/ownership and safely retained failing fixture. Record
missing observations explicitly. Do not kill unrelated processes, weaken assertions, extend timeouts
or retry cleanup as a supposed ownership fix. Further diagnosis requires a separately bounded packet.

## Future work outside v0.13.0 gates

### Early follow-up: Span aggregation and retention

Preserve OTel measurement meaning and let consumers specify aggregation needs. Current Scope/name
aggregation and independent `single`/`distinct`/`min_max` reducers lose duration/attribute associations
and joint attribute combinations. A formatter cannot recover them. This is a concrete design debt
to address early, not optional presentation polish. No target release is assigned yet.

Distinguish one Span's attribute updates (same-key overwrite in the SDK) from aggregation across
separate same-name Span instances. `(1)` establishes a final-value frequency, not API invocation
count. Review all three reducers together, including the impact of `single` conflicts being treated
as collection issues. Compare bounded attribute-set aggregation with retaining individual completed
observations; do not preselect unbounded raw storage. Define required analysis capabilities, memory
bounds, admission, privacy, loss reporting and future export boundaries before implementation.

Reference: [OTel Set Attributes](https://opentelemetry.io/docs/specs/otel/trace/api/#set-attributes).
The current reducers are gitlode's local analysis policy, not OTel's Span attribute semantics.

### Feedback-driven topics

Domain-specific pivots such as `gitlode.git.object.purpose`, alternative grouping axes, display
filtering, style refinements and compact attribute summaries remain candidates. Add semantic
relationships to metadata only when they are meaningful independently of a preferred view. Naming
policy documentation and suspected semantic inconsistencies deserve audit; no bulk attribute rename
or interpretation inferred solely from matching name prefixes is authorized here.
