# Stage B cleanup correction round 2 assignment (2026-10-19)

Trunk adopts all five mandatory findings in the
[independent review](opentelemetry-m2-stage-b-independent-review.md), delivered at `35aeff4`.
Stage B remains corrections-required; P2 remains accepted. Work on
`feature/otel-redesign_M2_fixture` from this packet's documentation checkpoint. Parent M2
`4f09265`, F2 `4ea24d5`, product/no-owner helpers and numeric budgets remain unchanged.

## Coherent repair, not a new framework

Before editing, record a compact exit-path table: trigger, admission cutoff, remaining cleanup
deadline, stop/close actions, observations still possible, primary/secondary failures and final
settled/unknown result. Cover the five findings together. Bounded waiting is not completed work:
non-preemptible native calls and pending filesystem operations cannot become settled through
Promise.race. Identify the enclosing independent owner/watchdog and retain uncertainty where
observation is impossible. Do not promise kernel-I/O preemption or treat kill/close as absence.

1. Route BOTH stdout/stderr read errors through bounded redacted failure handling; seal admission,
   preserve the original error and attempt cleanup. Add emitted-error regressions for both streams.
2. Apply actual work cutoffs to native sends/input/admission; check existing-entry expiry before new
   launch and account for construction/launch from their start. A late native return enters cleanup
   rather than sending started. Handle non-preemptible calls through the enclosing owner. Test delayed
   send/launch behavior, not only arithmetic; do not spend the cleanup reserve on ordinary work.
3. Disposal timeout actively requests stop/close within the existing shared cleanup budget. Cached
   disposal must not disable fallback close attempts. Settle controllable tasks/pipes; unknown host
   settlement remains unknown. Test stalled shutdown/write plus delayed close and primary-error
   preservation. Do not add another timeout after the first expires.
4. Arm case/campaign control before initial filesystem work and retain it through final receipts.
   Gate/bound setup and final I/O, cancel/join where supported, retain incomplete settlement elsewhere.
   Inject delayed read/write without real workloads. Receipt failure cannot erase the original
   outcome or prevent later bounded cleanup. Killing the runner is not evidence of settled I/O.
5. Guard every cleanup phase, including input.Dispose and transient thread/pipe/NUL CloseHandle.
   Attempt later phases despite exceptions within the same remainder. Preserve primary plus all
   distinct secondary failures; retain failed-handle ownership/identity without unsafe retry on
   reused handles. Inject the specified failure paths.

## Validation order and stopping boundary

Run strict typing, relevant lint, finite unit/native failure vectors, format/diff first. Demonstrate
fail-before/pass-after for the concrete paths where deterministic; use review probes as starting
evidence. Assert actual actions, uncertainty/settlement and error identity, not just helper arithmetic.
Restore temporary mutations. Expected old-source failures are not unexplained campaign failures.

Checkpoint the correction before real-process validation. Only after the injected checks pass, run
one sequential source-bound nine-entry regression campaign with existing deadlines and first-failure
admission stop. Preserve original round-1 evidence separately. No retry-until-green or duration
increase. If safe correction requires another owner architecture or cannot fit current budgets,
return that concrete limitation before runtime execution rather than expanding the platform design.

After regression success, allow one minimal normal-contributor-user transport check and one runtime
inherited-handle audit, combinable in one workload. Record actual identity/token, handle types and
ownership, job/control-handle exclusion, absence/output settlement and limitations. Use existing
tooling only. If prerequisites are unavailable, return the gate unverified. Do not disclose inherited
environment values. Sandbox/static evidence does not substitute for these checks.

Append outcome here with the exit-path table, five finding mappings, fixed OIDs, reached/unreached
assertions, primary/secondary failures, retained roots and sealed sanitized receipts. Keep prior
seals immutable. Warn before real-process execution about its elapsed work time. Commit source and
outcome separately, normal push, verify actual remote/clean/unchanged parent/F2 and remain on child.
Return for independent focused re-review only if correction gates pass; otherwise return incomplete
with the earliest failure. A recurring same-boundary finding returns to trunk diagnosis, not automatic
further repairs. No helper integration, Unix P1 repair, full OS/package campaign, PR, merge, freeze,
formal measurement or acceptance update. Do not self-accept Stage B/P1/PR readiness.
