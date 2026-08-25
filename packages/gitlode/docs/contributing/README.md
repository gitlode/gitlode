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
- [`telemetry-performance-harness.md`](telemetry-performance-harness.md): reference calibration,
  legacy baseline capture, and migration comparison workflow.
