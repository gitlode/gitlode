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

On Windows, the root Vitest configuration sets `maxWorkers: 2` for the workspace projects. This is
the supported resource policy for the ordinary root `npm test`, including its unchanged test
deadlines and assertions. Linux retains Vitest's existing defaults. Explicit CLI `--maxWorkers`
overrides still take precedence; running a workspace independently uses that workspace's own config.
The Windows cap does not establish that unrestricted concurrency or historical timeout/EBUSY
failures were repaired. Shared fixture ownership helpers remain for product behavioral regressions; see
the [test layout guide](../../../../tests/README.md) for their purpose and retirement condition.

### Windows with Volta: invocation-local executable setup

Some Volta installations remove their standard shim directories from the PATH passed into an npm
lifecycle. The interactive shell can resolve npm while a Vitest worker or its tsx child sees only
`npm.cmd` and fails with `spawn npm ENOENT`. The tooling launches `npm` directly through Node's
`execFile`, without a command shell; `npm.cmd` alone does not satisfy that executable launch.

For this supported setup, use the installed `npm.exe`, verify a byte-identical local copy, and prepend
its new directory only for the current invocation. No global PATH, toolchain installation or
repository npm-resolution code change is needed. Run the following PowerShell procedure from the
repository root after dependencies are installed. It records installed executable identity and
versions, checks direct npm execution in both an actual npm lifecycle Vitest worker and its tsx
child, and restores PATH even if validation fails. It uses installed dependencies in offline mode.
The preflight is a resolution check, not the repository test campaign.

```powershell
$ErrorActionPreference = 'Stop'
$originalPath = $env:PATH
$npmExecutable = (Get-Command npm.exe -CommandType Application -ErrorAction Stop).Source
$nodeVersion = (& node --version).Trim()
$npmVersion = (& $npmExecutable --version).Trim()
$nodeExecutable = (& volta which node).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the installed Volta Node' }
$setupRoot = Join-Path (Get-Location) ('.cache/windows-npm-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $setupRoot | Out-Null
$localNpm = Join-Path $setupRoot 'npm.exe'
Copy-Item -LiteralPath $npmExecutable -Destination $localNpm
$sourceHash = (Get-FileHash -LiteralPath $npmExecutable -Algorithm SHA256).Hash
if ((Get-FileHash -LiteralPath $localNpm -Algorithm SHA256).Hash -ne $sourceHash) {
    throw 'Installed npm executable copy differs'
}
@{ npmSource = $npmExecutable; npmCopy = $localNpm; sha256 = $sourceHash
   nodeExecutable = $nodeExecutable; node = $nodeVersion; npm = $npmVersion } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $setupRoot 'binding.json') -Encoding utf8
@'
import { execFileSync } from 'node:child_process';
console.log(JSON.stringify({
  node: process.version,
  execPath: process.execPath,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8', timeout: 3000 }).trim(),
  path: process.env.PATH,
}));
'@ | Set-Content -LiteralPath (Join-Path $setupRoot 'child.mjs') -Encoding utf8
@'
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
it('resolves installed npm through the lifecycle worker and tsx child', () => {
  const binding = JSON.parse(readFileSync(join(import.meta.dirname, 'binding.json'), 'utf8').replace(/^\uFEFF/, ''));
  const worker = {
    node: process.version, execPath: process.execPath, path: process.env.PATH,
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8', timeout: 3000 }).trim(),
  };
  const child = JSON.parse(execFileSync(process.execPath, [
    resolve('node_modules/tsx/dist/cli.mjs'), join(import.meta.dirname, 'child.mjs'),
  ], { encoding: 'utf8', timeout: 10000 }));
  writeFileSync(join(import.meta.dirname, 'resolution.json'), JSON.stringify({ binding, worker, child }, null, 2));
  for (const result of [worker, child]) {
    expect(result.node).toBe(binding.node);
    expect(result.npm).toBe(binding.npm);
    expect(result.execPath.toLowerCase()).toBe(binding.nodeExecutable.toLowerCase());
  }
});
'@ | Set-Content -LiteralPath (Join-Path $setupRoot 'resolution.test.mjs') -Encoding utf8
$testPath = (Join-Path $setupRoot 'resolution.test.mjs').Replace('\', '/')
"export default { test: { include: ['$testPath'], maxWorkers: 2 } };" |
    Set-Content -LiteralPath (Join-Path $setupRoot 'vitest.config.mjs') -Encoding utf8
try {
    $env:PATH = $setupRoot + ';' + $originalPath
    if ((& node --version).Trim() -ne $nodeVersion -or
        (& $localNpm --version).Trim() -ne $npmVersion) { throw 'Toolchain version changed' }
    & $npmExecutable exec --offline -- vitest run --config (Join-Path $setupRoot 'vitest.config.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'npm lifecycle worker/child resolution failed' }
    # Run the required repository commands here, before PATH is restored.
} finally {
    $env:PATH = $originalPath
    Write-Output "Setup receipts retained at $setupRoot; original PATH restored"
}
```

At the marked location inside `try`, run `npm test` or the required build/test commands; those commands
inherit the corrected environment. Running them after `finally` uses the restored environment.
Retain `binding.json`, `resolution.json` and the complete command logs with the source commit when
reporting results. The unique `.cache/windows-npm-*` directory keeps receipts and the executable copy
without deleting other invocations' evidence. Do not download a replacement executable or use an
agent-specific cache location as the installed source.

The verified correction preserves the installed versions rather than prescribing a replacement
version. A successful campaign with this procedure is evidence for the corrected invocation only;
it does not establish that the unmodified Volta environment works. If executable resolution or the
version assertions fail, preserve the first log and resolve the setup before running the campaign.

### Timeouts for process integration tests

Tests that exercise real Git processes, OS process containment or process shutdown may use an
explicit per-test finite timeout rather than the general five-second unit-test default. Document
the affected cases and budget rationale, including startup, workload, output settlement and a
separate bounded cleanup opportunity. Keep outer driver deadlines consistent with those phases.
Timeouts detect hangs; they are not performance acceptance thresholds. Preserve cancellation fault
injection and cleanup assertions. A timeout failure requires diagnosis, not repeated increases until
the test passes. Do not raise global defaults or weaken process-quiescence and evidence-retention
requirements to accommodate these tests.

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

The supported release command remains `npm run release`: it runs `validate:release` before
`changeset:publish` (`changeset publish`). The Changesets Action uses this same callback.
`changeset:publish` itself is the publishing primitive, not a validation command. Do not invoke either
publishing command as a verification step. Repository review rules and npm Trusted Publishing remain
the publication authority boundary. Candidate acceptance does not authorize an agent
to publish, approve or merge a PR.

Ordinary product, release-boundary and installed-package checks remain required.

### Lazy telemetry release boundary

The [telemetry verification contract](../design/telemetry-verification.md#failure-injection) requires
independent emitted graph, host/worker runtime load and packed dynamic asset checks for the SDK-free
disabled path. Shared chunks and external transitive dependencies count toward the static closure of
all three stable entries. Packed enabled execution must positively produce a report and load the
emitted lazy assets. Source tests alone do not verify the installed-package boundary.
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
do not invoke packaging.

## Shared product test support

`tests/support` contains Node-only deterministic repository, behavioral comparison and fixture
ownership helpers used by product regressions. See the [layout guide](../../../../tests/README.md).
The former performance workspace, its commands and standalone Windows launcher have been retired.
The installed-package boundary in `tests/system` and normal product tests remain.

Run `npm run typecheck:test-support` for the independent strict, no-emit check of these helpers.
It is included in CI and `validate:release`, with no dependency on generated product declarations.

## Empirical comparisons

Keep timing and resource conclusions tied to the actual candidate, dependencies, input, extraction
settings and environment. Report absolute values as well as relative differences, preserve failed
attempts, and distinguish measurement validity from the release owner's acceptance decision. A
successful rerun does not explain an earlier failure. Scope the work to a concrete product question;
reassess its value before expanding verification infrastructure.

Compare JSONL content when feasible. Counts or file sizes alone do not prove content equality.
Functional/package checks do not establish performance across unmeasured workloads or operating
systems. Release-specific choices and outcomes belong in task coordination records, not product
design contracts.

For test repositories, Git maintenance defaults can change across Git versions. Process exit alone
does not prove all descendants have stopped; retain uncertain roots rather than deleting possibly
active data. These cautions do not require a particular benchmark or launcher implementation.
