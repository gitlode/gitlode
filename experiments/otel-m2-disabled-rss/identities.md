# Fixed variant identities

| Variant | Source OID | Build product OID | Runtime inventory SHA-256 |
| --- | --- | --- | --- |
| V0 | `6a9edfc4c4624c9efdeef3fcd06402f174809d67` | `b487272` | `0a27c8863e54906de32bdc836d6f6639892154767a75dc88cac87359153a9a7d` |
| V1 | `bdd4864b76d88ea7f0881ced911118d33ad40ab4` | `bdd4864b76d88ea7f0881ced911118d33ad40ab4` | `7ea6664f920ff16e02ca7806006b34eb5fd74f5e4345fd70791df799d8220d0c` |
| V2 | `26d1f034557d279f9271593b4091eb5424f8d481` | `26d1f034557d279f9271593b4091eb5424f8d481` | `e0aa809e5c7cf9f3a557e5be991484120f292cca1bed1b47f1fab5d542460088` |

Runtime inventories and raw evidence:
`/home/t-wakabayashi/gitlode-performance/m2-rss-experiment-20261006T1106/evidence/`.
Three independent dist directories under sibling `runtimes/V0`, `V1`, `V2` use
one unchanged restored dependency closure. No build occurs during CLI runs.
The V0 probe correction changes preparation scripts only; its product build
is exactly the previously saved b487272 source.

V2 uses an API-only disabled session object in place of the original class;
empty SDK-adapter finalization calls are omitted, while nonrecording root/context,
idempotent finalization and application-result behavior are verified. This is
an additional lifecycle/layout confounder of the import contrast. API no-op
spans have invalid IDs; SDK AlwaysOff spans have valid non-sampled IDs.
Neither path records spans or metrics.

Setup corrections retain original logs: V0 span-ID probe correction, one
shell quoting error before correction, and an uncompleted WSL push followed
by the successful normal Windows Git push. No CLI run was repeated.

## Preparation stop

Before the first diagnostic CLI spawn, fixture inventory equality failed.
The preparation snapshot contained .git/gc.pid; objects moved from loose
to packs (1 to 2), and commit-graph changed before the gate.
HEAD and 4,430 commits were unchanged. No manual repack or maintenance
policy change was made. All six CLI rows remain unexecuted; the controller
invocation stopped before creating any run directory or spawning any CLI.
No retries or subsequent diagnostic run are authorized by this return.
Prepared variants and first setup failures remain preserved.
Trunk should decide one bounded fixture-preparation closure before assigning
any new experiment; no attribution, acceptance or formal retry is granted.

## Restored-fixture assignment (2026-10-06)

Instruction checkpoint aa588794 authorizes a single restored-input gate and the
unexecuted six runs. Quiet window: 2026-10-06 18:43 to 2026-10-07 09:43 JST;
hard stop is the window end. New root: `/home/t-wakabayashi/gitlode-performance/m2-rss-restored-20261006T1843`.
Only controller input validation, paths, deadline and start markers change.
All product variants/builds are reused byte-for-byte. V1 span-ID and V2 empty
finalization omissions remain attribution confounders. Generation is disabled.
`controller-entered.json` marks controller entry; per-run invocation and saved
command/raw/supervision evidence distinguish attempted and completed workloads.
