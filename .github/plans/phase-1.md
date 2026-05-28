### Phase 1: Plugin Contract Scalar Values and Type-Safety Boundary

_This phase widens successful plugin payloads from object-only values to object-or-scalar values while preserving `null` as a core-reserved skip sentinel. The change is expressed through core-owned type boundaries and documentation updates, without changing the projector flow for existing object-returning plugins._

#### Design Maturity

- [x] Implementation-ready
- [ ] Deferred design

#### Design References

- `.github/instructions/architecture.instructions.md` — faithful extractor boundary, plugin contract terms, and layer ownership
- `.github/instructions/schema.instructions.md` — `extensions` field schema and documentation obligations
- `.github/instructions/plugin-policy.instructions.md` — official plugin package policy and plugin contract documentation references
- Roadmap item: "Plugin Contract: Allow scalar values in `extensions.<namespace>`"

#### Design Decisions

- **Preferred API / library / Node.js built-in**: Use TypeScript type-alias widening only. No new runtime dependency, schema validator, or wrapper helper is introduced for this phase.
- **Owning layer**: Core owns both the plugin-facing contract types and the projected output types because this phase changes the enrichment boundary, not CLI loading, Git access, or output serialization mechanics. CLI continues to load and initialize plugins; Output continues to serialize projected records as-is.
- **Authoritative type locations**: `packages/gitlode/src/core/types.ts` remains the single source of truth for both plugin contract terms and projected record terms. The public plugin authoring entrypoint `packages/gitlode/src/plugin-api.ts` continues to re-export only the plugin-facing contract surface. Plugin authors should not need to import projected-output types to satisfy this phase.
- **Asymmetric type boundary**: Express the invariant with separate aliases rather than a single shared union. Plugin `success.data` must widen to object-or-scalar without `null`; projected `extensions.<namespace>` values must widen to the same success-value union plus `null`. This asymmetry is the authoritative type-level expression of the rule that `null` is core-reserved.
- **Scalar set for Phase 1**: Allow top-level `string`, `number`, and `boolean` success payloads in addition to objects. Arrays are explicitly excluded in this phase to keep the contract widening bounded and to avoid reopening downstream schema/documentation questions before there is a concrete need.
- **Null semantics**: `null` remains a core-reserved sentinel emitted only when the plugin skips a fact or when a `fatal` result is downgraded by `failurePolicy: "skip-fact"`. A plugin `success` result must not allow `null`, because that would make success and skip outcomes indistinguishable in output and would break the current warning/emission invariant.
- **Runtime behavior for scalar payloads**: `EnrichingFactProjector` should continue assigning `result.data` directly into `extensions[namespace]`. No scalar-specific wrapping, branching, or normalization is added unless required by correctness during implementation. Existing object-returning plugins must remain behaviorally unchanged.
- **Schema stability responsibility boundary**: gitlode guarantees the outer contract of `extensions` only: namespace key placement, omission when no plugins are active, declaration-order preservation, and the meaning of core-assigned `null`. gitlode does not guarantee the stable inner shape of a plugin's non-null payload. Stability of `extensions.<namespace>` is owned jointly by the plugin author and the user's chosen namespace/config pairing.
- **Official plugin package scope for this phase**: No official plugin package README or example update is required unless an existing package document would become factually incorrect after the contract change. `@gitlode/plugin-custom-field` does not gain scalar shorthand in this phase; that ergonomics change remains deferred follow-up work.
- **Output stream / CLI behavior**: No stderr/stdout policy, failure-policy behavior, or warning wording change is part of this phase.
- **Edge case behavior**: Existing object success payloads remain fully supported. Scalar success payloads must serialize as raw JSON scalars under the namespace key. Skip/fatal-with-skip-fact outcomes continue to serialize as `null`. Arrays remain unsupported at the top level of `success.data` in Phase 1.

#### Non-Goals

- Allowing top-level array payloads for `extensions.<namespace>` success values
- Adding scalar shorthand behavior to `@gitlode/plugin-custom-field` or other official plugin packages
- Changing plugin failure-policy semantics, warning behavior, or projector ordering
- Introducing runtime validation or normalization of plugin payload inner shapes beyond the existing contract boundary

#### Target Files

| File                                                          | Action | Notes                                                                                                                                            |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/gitlode/src/core/types.ts`                          | Modify | Introduce separate plugin-success and projected-extension value aliases; widen scalar support while keeping `null` out of plugin `success.data`. |
| `packages/gitlode/src/core/index.ts`                          | Modify | Re-export any new plugin-facing aliases needed to keep the public contract coherent.                                                             |
| `packages/gitlode/src/plugin-api.ts`                          | Modify | Keep public plugin authoring exports aligned with the plugin-facing contract surface only.                                                       |
| `packages/gitlode/src/core/enriching-fact-projector.ts`       | Modify | Preserve direct pass-through of `success.data`; adjust typings only if required so scalar results flow without special-case logic.               |
| `packages/gitlode/test/core/enriching-fact-projector.test.ts` | Modify | Add scalar success coverage and regression coverage for existing object-returning plugins plus `null` skip semantics.                            |
| `packages/gitlode/test/core/types.test.ts`                    | Modify | Add contract-focused type assertions, including that `null` is not assignable to plugin `success.data`.                                          |

#### Documentation Touchpoints

| File                                           | Section                                             | Action  |
| ---------------------------------------------- | --------------------------------------------------- | ------- |
| `packages/gitlode/docs/design/plugins.md`      | "Plugin Module Contract"                            | Replace |
| `packages/gitlode/docs/design/plugins.md`      | "Output Record: `extensions` Field"                 | Replace |
| `packages/gitlode/docs/design/plugins.md`      | "Ownership and Boundaries"                          | Update  |
| `packages/gitlode/docs/design/schema.md`       | "Commit-Granularity Schema"                         | Replace |
| `packages/gitlode/docs/design/schema.md`       | "`extensions`"                                      | Replace |
| `packages/gitlode/docs/design/architecture.md` | plugin contract / `ProjectedExtensions` description | Update  |
| `packages/gitlode/docs/usage.md`               | "Plugin output in records"                          | Update  |
| `.github/instructions/schema.instructions.md`  | commit schema and `extensions` field shape          | Update  |

#### Implementation Notes

- Prefer small named aliases for the widened unions so the plugin-facing contract and projected-output contract stay readable in both source and generated docs.
- If the existing projector implementation already type-checks after the type widening, keep the runtime path unchanged and limit the code change there to any necessary annotation cleanup.
- Use the existing TypeScript/Vitest test style for contract assertions rather than introducing a new type-test harness.

#### Verification

_The phase is not complete until all of these pass._

**Automated:**

```text
npm run build
npm test
npm run lint
npm run format:check
```

**Behavioral checks** (manual CLI invocations or observable output changes):

- Run extraction with a test plugin that returns a string, number, and boolean on success; confirm each value is written unchanged at `extensions.<namespace>` in the JSONL output.
- Run extraction with an existing object-returning plugin and confirm its output shape is unchanged from the pre-phase behavior.
- Run extraction with a plugin that returns `skip` or `fatal` under `failurePolicy: "skip-fact"`; confirm the namespace value is `null` and the warning path still distinguishes skip/failure from success.
