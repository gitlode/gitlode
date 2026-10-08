# Build, Test, and Release Validation

## Purpose and scope

This document is the canonical contributor guide for TypeScript projects, development builds,
source tests, release bundling, package validation, and publish gates. Run commands from the
repository root unless a workspace command is shown.

The logical software architecture is defined in
[`../design/architecture.md`](../design/architecture.md). Domain ownership, package dependencies,
and official package exports are defined in
[`../design/domain-design.md`](../design/domain-design.md). This document explains how those
packages are built and assembled; it does not grant source dependencies or redefine their domain
boundaries.

## Build model overview

The monorepo deliberately has two build forms:

| Build form  | Purpose                    | Shape                                                                           |
| ----------- | -------------------------- | ------------------------------------------------------------------------------- |
| Development | Repository development     | Every workspace emits independently consumable, unbundled TypeScript output.    |
| Release     | Public `gitlode` packaging | Private workspaces are bundled into `gitlode`; plugin packages remain separate. |

This distinction lets repository packages enforce ownership during development without making the
private packages consumer dependencies or public compatibility contracts.

## Development build

All production workspaces are TypeScript composite projects. The root `tsconfig.json` is a solution
project, and project references determine build order:

1. private foundation and contract workspaces;
2. private adapter workspaces;
3. the public `gitlode` workspace; and
4. plugin workspaces.

```bash
npm run build:dev
npm run build:watch
npm run build:clean
```

Development builds emit unbundled NodeNext ESM, declarations, declaration maps, and source maps
into each workspace's `dist` directory. Incremental metadata is stored under `.cache/tsc/` rather
than published output. Cross-workspace imports use official package specifiers and resolve the
referenced workspace's built exports, so a clean solution build must start at the root and allow
TypeScript project references to build dependencies first.

`npm run build:watch` watches the complete solution. Use it alongside a test watch command when a
change crosses workspace boundaries.

### Tooling and editor TypeScript project

The root solution also references `packages/gitlode/tsconfig.tooling.json`. This non-emitting
project owns gitlode's tests, scripts, and package-level TypeScript configuration files. It ensures
that editors use the repository's Node.js types and compiler settings instead of assigning those
files to an inferred project.

The tooling project currently uses `noCheck`. Repository-wide test-code type checking remains a
separately deferred migration because existing test fixtures require additional typing work.
Production projects continue to perform full type checking. `noCheck` is therefore an explicit
scope boundary for tooling code, not a relaxation of production compilation.

## Source tests

The root Vitest configuration runs every workspace project in one process:

```bash
npm test
npm run test:watch
```

Each test-owning workspace keeps a `vitest.config.ts` and can run independently, for example:

```bash
npm test -w gitlode
```

Normal test commands perform an incremental development build first. The root watch command does
not rebuild cross-workspace output continuously; run `npm run build:watch` alongside it when the
code under test spans workspace boundaries.

### Optional coverage

```bash
npm run test:coverage
```

Coverage is a local diagnostic. It is not collected by CI and is not part of the publish gate.
Coverage configuration and dependencies remain available so targeted measurement can be performed
when it is useful.

## Release build and bundling

```bash
npm run build:release
```

The release command first completes the TypeScript solution, then runs tsdown for the public
`gitlode` package. Plugin packages retain their normal TypeScript output. tsdown bundles
`@gitlode/internal-foundation`, `@gitlode/internal-contracts`, `@gitlode/git-adapters`, and
`@gitlode/line-diff-adapters`, including public-facing types from those packages. Third-party
runtime dependencies such as `diff` and `isomorphic-git` remain external and are declared by the
public package.

The public release contains three ESM runtime entries at stable paths:

- `dist/index.js`
- `dist/plugin-api.js`
- `dist/worker-entry.js`

Only `dist/index.d.ts` and `dist/plugin-api.d.ts` are public declarations. The worker entry is a
runtime asset located relative to the release bundle, not a package export. Shared application code
may be emitted as hashed chunks directly under `dist`.

Development TypeScript and tsdown both write `packages/gitlode/dist`, but the output represents
different build forms. Before tsdown cleans that directory, the release hook invalidates only
`.cache/tsc/gitlode.tsbuildinfo`. A later `tsc -b` must therefore rebuild gitlode's unbundled
development output rather than mistake the release bundle for current TypeScript output, while
unrelated workspace build caches remain valid.

Source maps remain enabled for release builds. Their embedded content, exact file count, chunk
names, and other tsdown-internal layout details are not custom release contracts.

## Installed-package validation

```bash
npm run validate:publint -w gitlode
npm run test:system:package -w gitlode
npm run test:package
```

Release validation deliberately separates responsibilities:

- tsdown produces the runtime and declaration bundle;
- `publint --strict --pack npm` validates metadata from the package produced by `npm pack`; and
- the installed-package system test validates representative product behavior from a consumer's
  perspective.

The system test creates an npm tarball, installs it into a temporary consumer outside the
monorepo, and exercises the installed CLI and worker. It covers both Git adapters, representative
per-file line-diff output, dynamic plugin enrichment, the published configuration schema, and a
NodeNext TypeScript consumer of `gitlode/plugin-api`.

Successful installed extraction is evidence that the runtime bundle and worker can operate, and
successful consumer compilation is evidence that public declarations have a valid dependency
closure. The test does not duplicate tsdown's own tests by asserting exact chunks, source-map
contents, or other incidental output structure.

`npm run test:package` builds the release before running both metadata and installed-package
validation. The individual commands are useful when the release output has already been built.

## Architecture, schemas, and dependency maintenance

Architecture checks operate on built private-package exports as well as source domains, so the root
command performs a development build first:

```bash
npm run architecture:check
npm run schema:check -w gitlode
```

Every workspace declares the production and development dependencies used by its source, tests,
configuration, and scripts. Common dependency versions should remain aligned unless a deliberate,
documented incompatibility requires otherwise. The four private packages remain pinned to
`0.0.0`. Syncpack checks these repository conventions:

```bash
npm run syncpack:check
npm run syncpack:fix
```

Package manifests define dependency ownership. The Rev-dep configuration verifies that imports do
not rely on undeclared root development dependencies, while the domain rules documented in
`domain-design.md` constrain which declared dependencies may actually be used.

## CI and publish gates

CI runs source validation and then exercises the release pipeline as explicit steps: development
build, generated-artifact checks, source tests, release build, packed metadata validation, and the
installed-package system test. Coverage is intentionally absent.

```bash
npm run validate:release
```

`validate:release` is the functional and package-validation half of release readiness. It checks
dependency consistency, formatting, lint, architecture, generated schema consistency, and source
tests before building the release and running publint and the installed-package system test. It does
not establish empirical telemetry acceptance by itself.

The supported Changesets publish path has a second, migration-specific gate:

```bash
npm run validate:telemetry-release-acceptance -w gitlode
```

The root `changeset:publish` command runs this validator immediately before `changeset publish`, and
the Changesets Action publish callback continues to converge through `npm run release`. Ordinary CI,
`validate:release`, release builds, and Version PR creation do not run the migration gate. The release
checkout fetches complete history so the validator can prove candidate ancestry.

The versioned record at `.release/telemetry-migration-acceptance.json` starts in `blocked` state. An
`accepted` record must contain reviewed attestations for all five calibrations and legacy captures,
the ten canonical comparisons, aggregation N/4N bounded-growth checks, and three `target_on` checks
for every repository target. Those repository checks attest to profile-report validity, report size,
and prohibited host spans. The profile-report validity attestation requires literal `pass` outcomes
for sidecar availability, report presence, schema validity, complete spans, complete counters,
complete histograms, diagnostics presence, and empty diagnostics. It cannot carry a performance
exception. Report size and prohibited host spans retain the reviewed performance-exception path.
The record also requires applicable Git CLI command parity and explicit behavioral outcomes, and it
must cover profile readability (including partial and unavailable output), staged system-test and
contributor-navigation work, final Windows/Linux functional and installed-package checks, bundle
identity, candidate delta assessment, T13C closure, and release-authority approval. Each attestation
identifies its evidence and archive, records a SHA-256, names the exact final candidate for which it
is accepted, and identifies the reviewer and review date. A performance exception must also contain
every exception field in the telemetry performance catalog and a separate release-authority approval;
it cannot waive calibration, missing or inconclusive evidence, report validity, or behavioral
correctness.

Performance attestations separately name the product and harness revisions that generated their
evidence. Those revisions, the preserved legacy revision and the frozen migration candidate must be
available Git commits. The legacy revision must precede the frozen candidate, and the frozen candidate
must be an ancestor of the final candidate; separately versioned harness commits need only exist.
Calibration and legacy capture remain baseline evidence. Reuse of evidence from an older redesigned
candidate requires a reviewed, evidence-specific delta binding over its evidence ID, source product
and harness OIDs, and final destination OID. The gate rejects absent, mismatched and dangling reuse
claims without attempting to judge the reviewer's semantic rationale.

The reviewer is responsible for verifying the referenced bytes and deciding whether the evidence is
acceptable. The repository gate verifies only that committed attestations are complete and
consistent; it neither has access to external archives nor proves artifact authenticity from a hash
alone. The final candidate must be an ancestor of the publish checkout, and their trees may differ
only at the acceptance-record path. Any tracked or untracked checkout change fails closed. Ignored
generated build output is omitted by normal Git status handling and therefore does not appear as a
source edit. Actions publishing is accepted only from `refs/heads/main`; local publishing reads
the attached branch from Git and requires `main` rather than trusting an environment override.

The record remains enforced after the initial v0.13.0 publication until a separate reviewed change
retires this temporary migration gate while preserving accepted evidence in history. Repository
enforcement cannot prevent a credential holder from bypassing the supported command or modifying the
guard; branch review and npm Trusted Publishing remain the authority boundary for those actions.

Use the narrower commands while developing. Assess publish readiness from both `validate:release`
and an accepted telemetry migration record; do not change a blocked record without the required
independent review evidence.

### Lazy telemetry release boundary

The [telemetry verification contract](../design/telemetry-verification.md#failure-injection) requires
independent emitted graph, host/worker runtime load and packed dynamic asset checks for the SDK-free
disabled path. Shared chunks and external transitive dependencies count toward the static closure of
all three stable entries. Packed enabled execution must positively produce a report, and aggregation
child bundles must retain dynamic targets. Source-only D1 tests do not discharge these obligations;
The release build runs `typecheck:release-boundary` and a product-owned tsdown metadata verifier
(`scripts/tooling/release-telemetry-boundary.ts`). It follows static chunk edges for each stable entry,
checks module ownership and conservatively follows declared external dependency identities. Lazy
edges remain distinct and must name emitted assets. A forbidden eager owner or private workspace
specifier fails the build; names and chunk counts are not fixed.

The installed runner observes ESM resolve/load and CommonJS resolution/load in the actual CLI and
worker via inherited Node preloads. Each isolate positively exercises both guard mechanisms.
SDK-free plugin fixtures keep product evidence separate; a separate plugin-owned SDK fixture proves
importer attribution. Both adapters run Disabled, Enabled and denied SDK cases with JSONL equality.
Enabled must return a complete schema-2 report with observations and positively load SDK/lazy assets;
a disposable missing asset must fail that assertion despite successful degraded extraction.
The package identity output includes the tarball/runtime SHA-256 values and consumer compiler version.
Optional `GITLODE_PACKAGE_EVIDENCE` retains guard traces, identities and first failures outside the
consumer; these are verification artifacts, not formal measurement evidence. No bundling or installation success implies formal
performance acceptance.

## Checked system tooling and commands

`tests/system/tsconfig.json` independently checks all owned `scripts/**/*.ts` with strict NodeNext,
`noCheck: false` and `noEmit: true`. It is non-composite, outside the solution build, with no product
references or aliases. Package tooling's deferred noCheck and existing fixture typing are unchanged.

Canonical commands are `npm run typecheck:system` and `npm run test:system:package` from the root.
The latter delegates to the private workspace's typecheck plus runner and requires existing release
output. The retained `npm run test:system:package -w gitlode` alias delegates one way to the root;
its later removal requires a separate change. `npm run test:package` still builds release output,
runs publint and reaches that alias. Do not run build:dev between bundling and packing: dist is shared.
CI and validate:release explicitly check system typing and invoke the canonical root package command.
Neither command starts formal performance measurements or establishes migration acceptance.

Node 22+, npm and Git are host prerequisites. Repository paths resolve from the script, not caller
cwd. Children use explicit cwd, shell-free argument arrays and sequential execution without retries.
The real OS temp parent must be outside the real checkout before creation; spaces and different
drives are supported. Only the newly created temporary root is deleted in finally after awaited
children. Rejection creates no directory and deletes no existing data. Errors retain stdout/stderr.
Each child has a 180-second deadline. Timeout kills the owned child (and its Windows process tree);
Windows locks can still prevent cleanup. There is no retry. Preserve failure evidence and return for
diagnosis. Package runs are sequential; an outer campaign deadline still bounds the entire chain.

The consumer installs the actual tarball and `typescript@^7.0.2`; registry access and resolved compiler
version are execution inputs. Public consumer typing uses skipLibCheck false. The private workspace
has no build/publish script or production entry points. It is outside product `files: [dist, schemas]`;
exports, bin, bundler inputs and runtime dependencies remain unchanged. Workspace-wide source tests
do not invoke packaging. Migration publish enforcement remains unchanged.
