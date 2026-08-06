# Deferred Test-Code Type Checking

Production TypeScript projects intentionally exclude test source.

`packages/gitlode/tsconfig.tooling.json` now gives gitlode's tests, scripts, and TypeScript
configuration files a configured editor project with the repository's Node.js types. It is
non-emitting and uses `noCheck`; it does not complete this deferred task. A preliminary strict
check found roughly 60 existing errors in gitlode alone, primarily fixtures that have not migrated
to branded path and object-ID types.

A follow-up should add a non-emitting checked project and `typecheck:test` script to each
test-owning workspace, fix the existing test-code type errors, orchestrate the check from the
repository root, and make it mandatory only after every workspace passes. Once gitlode's test and
tooling files pass, replace or tighten its current tooling project so `noCheck` is no longer
necessary.

This task is separate from the completed package split. Package export boundaries, dependency
ownership, Rev-dep checks, and runtime tests already apply.
