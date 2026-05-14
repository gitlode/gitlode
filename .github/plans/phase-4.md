### Phase 4: `--rotate-size` Size Suffixes

_Add human-readable size suffix support (`K`, `M`, `G`) to `--rotate-size` while preserving full backward compatibility for plain byte integers. Keep all behavior outside rotate-size parsing/validation unchanged and fail invalid input before any extraction work starts._

#### Status

- [x] Planned
- [ ] In progress
- [ ] Completed

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/cli.instructions.md` — Parameter Reference, Validation Rules, Mutual Exclusion Rules
- `.github/roadmap.md` — Entry: "CLI UX: `--rotate-size` human-readable size suffixes"
- `.github/plan.md` — v0.4.1 scope and phase ordering notes
- `.github/instructions/phase-template.instructions.md` — required phase file structure and completion criteria

#### Design Decisions

- **Accepted suffix set**: Support single-letter suffixes `K`, `M`, `G` only.
  Case policy: case-insensitive (`k|m|g` also accepted).
  Not accepted in this phase: `KB`, `MB`, `GB`, `KiB`, `MiB`, `GiB`, `T`.
  Rationale: keep grammar minimal and predictable for a patch release, aligned with the roadmap wording.

- **Numeric base policy**: Binary base (`1K = 1024`, `1M = 1024^2`, `1G = 1024^3`).
  Rationale: consistency with existing byte-oriented rotation semantics and common CLI storage-size conventions.

- **Backward compatibility policy**: Plain integer input remains supported and interpreted as raw bytes exactly as before.
  Example: `--rotate-size 104857600` continues to mean 104,857,600 bytes.

- **Input normalization and grammar**:
  - Trim leading/trailing whitespace before parsing.
  - Accept only integer numeric parts (`^\d+$`) optionally followed by one suffix char (`K|M|G`, case-insensitive).
  - Reject decimal forms (`1.5M`), signed forms (`+1M`, `-1M`), empty values, and mixed-token forms (`1 MB`).

- **Lower/upper bounds**:
  - Minimum: `1M` (`1,048,576` bytes)
  - Maximum: `64G` (`68,719,476,736` bytes)
  - Apply bounds after suffix expansion; plain integers and suffixed values are checked by the same normalized-byte guard.
    Rationale:
  - Minimum prevents impractical tiny files/rotation churn.
  - Maximum prevents operationally unrealistic thresholds from being accepted silently.

- **Overflow and numeric safety**:
  - Parse numeric part with `BigInt` to avoid precision/overflow ambiguity.
  - After suffix multiplication and bound checks, convert to `number` only when value is within safe/allowed range.

- **Validation and exit behavior**:
  - Validation remains in CLI validation phase 1 (format/mutual exclusion; before filesystem and Git validation).
  - Invalid `--rotate-size` exits with code `1` via existing `userError()` behavior.
  - No extraction, output, or state update work begins on invalid input.

- **Error message contract**:
  - Invalid format message:
    `--rotate-size must be a positive integer (bytes) or an integer with suffix K, M, or G (e.g. 500M, 1G)`
  - Out-of-range message:
    `--rotate-size must be between 1048576 and 68719476736 bytes`
    Keep wording stable and test-asserted.

- **Parsing ownership and location**:
  - Own parsing in `src/cli/args.ts` (CLI boundary), using a local helper such as `parseRotateSizeBytes(raw: string): number`.
  - Do not place parsing in output-layer utilities (`src/output/**`) because suffix syntax is a CLI-input concern, not an output-domain concern.

- **Commander interaction policy (post-Phase-3 structure)**:
  - Continue receiving `--rotate-size` as a string option value from commander.
  - Perform custom parse/validation in `parseArgs()` phase 1 so all user-facing validation errors stay under gitrail-controlled messages.

- **No scope expansion**:
  - No new flags/aliases.
  - No change to output JSON schema/JSONL format.
  - No change to state file schema.
  - No change to traversal or rotation trigger semantics beyond interpreting rotate-size input text.

#### Non-Goals

- Supporting `KB/MB/GB` or `KiB/MiB/GiB` suffix variants in this release.
- Introducing additional size suffixes beyond `K/M/G`.
- Any refactor unrelated to `--rotate-size` parsing/validation.
- Changing rotate trigger behavior when both `--rotate-lines` and `--rotate-size` are set.

#### Target Files

| File                                       | Action | Notes                                                                                         |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------- |
| `src/cli/args.ts`                          | Modify | Add rotate-size parser helper, integrate format + range validation, keep existing parse flow. |
| `test/cli/args.test.ts`                    | Modify | Add/adjust valid and invalid rotate-size cases, including compatibility and range boundaries. |
| `.github/instructions/cli.instructions.md` | Modify | Update parameter/validation text to include suffix support and confirmed min/max bounds.      |

#### Documentation Touchpoints

| File                                       | Section                                              | Action                                                    |
| ------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| `README.md`                                | CLI Reference (`--rotate-size`)                      | Update                                                    |
| `docs/usage.md`                            | File Rotation examples + CLI Reference               | Update                                                    |
| `.github/instructions/cli.instructions.md` | Parameter Reference + Validation Rules               | Update                                                    |
| `.github/roadmap.md`                       | `CLI UX: --rotate-size human-readable size suffixes` | Remove after implementation in release documentation task |

#### Implementation Notes

- Keep parser helper private to `args.ts` unless reuse demand appears; avoid premature utility extraction.
- Validate `--rotate-size` before `--since-date` filesystem/Git checks to preserve "fail fast on argument format" behavior.
- Preserve existing error style (`userError` single-line stderr message + exit code 1).
- Ensure normalization (`trim`) is explicit in code and covered by tests.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```bash
npm run build
npm test
npm run format:check
```

**Behavioral checks** (manual CLI invocations):

- Valid plain integer compatibility:
  - `gitrail -b main --rotate-size 104857600 ./repo` succeeds and sets maxBytes to 104857600.
- Valid suffixes:
  - `gitrail -b main --rotate-size 500M ./repo` succeeds.
  - `gitrail -b main --rotate-size 1g ./repo` succeeds (case-insensitive).
- Invalid suffix/format:
  - `gitrail -b main --rotate-size 1MiB ./repo` exits 1 with invalid format message.
  - `gitrail -b main --rotate-size 1.5G ./repo` exits 1 with invalid format message.
- Bounds:
  - `< min` value exits 1 with out-of-range message.
  - `> max` value exits 1 with out-of-range message.
- Regression:
  - Existing invocations without `--rotate-size` are unaffected.
  - Existing `--rotate-lines` behavior is unaffected.
