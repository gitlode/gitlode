# gitlode Contributing Documentation

This directory contains durable contributor-facing policies for work that affects the gitlode
repository but is not itself a product behavior or implementation design contract.

Use [`../design/`](../design/) for gitlode architecture, CLI, traversal, schema, configuration, and
plugin runtime contracts. Use this directory for repository maintenance policies that contributors
and coding agents need while changing the codebase.

## Policies

- [`build-test-release.md`](build-test-release.md): development build, root test orchestration,
  release bundle, package validation, and publish-gate workflow.
- [`lint-policy.md`](lint-policy.md): oxlint rule adoption policy, including rule category handling,
  LLM autonomy boundaries, severity, and review cadence.

For normal telemetry verification, start with
[`../design/telemetry-verification.md`](../design/telemetry-verification.md) and run the applicable
repository checks described in [`build-test-release.md`](build-test-release.md). Empirical acceptance
follows [empirical comparison guidance](build-test-release.md#empirical-comparisons). Changes to publish policy
start with [`build-test-release.md`](build-test-release.md); migration acceptance and empirical
evidence are separate from the functional and package validation performed by `validate:release`.
