# Deferred Test-Code Type Checking

Production TypeScript projects intentionally exclude test source. A follow-up should add a
non-emitting `tsconfig.test.json` and `typecheck:test` script to each test-owning workspace, fix the
existing test-code type errors, orchestrate the check from the repository root, and make it
mandatory only after every workspace passes.

This task is separate from the completed package split. Package export boundaries, dependency
ownership, Rev-dep checks, and runtime tests already apply.
