# Domain Design

> Status: Working draft. This document is being developed section by section and is not yet a
> canonical replacement for the domain descriptions in `architecture.md`.

## Purpose

This document defines how gitlode divides its source code into domains and how those domains may
depend on one another. Its purpose is to make future classification decisions repeatable: adding,
splitting, merging, or renaming a domain should follow the same principles rather than depend on an
ad hoc judgment about the files involved at the time.

## 1. Domain Design Principles

### 1.1 Domain definition and charter

A domain is a set of modules governed by one architectural charter. The charter identifies:

- **Purpose:** the responsibility it owns.
- **Admissions and exclusions:** what may and may not belong.
- **Dependencies:** allowed and forbidden domains, runtime APIs, and external packages.
- **Runtime and lifecycle:** environment assumptions, side effects, resources, and disposal.
- **Stability:** whether it is a contract, product policy, internal mechanism, or implementation.

A domain must be defined before files are classified into it. Names and current contents are
evidence for discovering a charter, but they do not define one. A charter that is too broad to
exclude anything is not useful.

### 1.2 Cohesion and dependency scope

Domain design balances:

- **Cohesion:** code with the same responsibility and reasons to change should stay together.
- **Dependency scope:** consumers should not acquire unrelated implementations, runtime
  assumptions, side effects, or external dependencies.

A consumer accepts a domain's charter and dependency envelope, not every symbol it exports.
Different consumers may use different utilities from the same domain when all of those utilities
obey the same charter. Conversely, related responsibilities may require separate domains when their
dependency or runtime characteristics differ.

Code volume and the ability to imagine a finer taxonomy are not, by themselves, domain boundaries.
Growth in code volume may trigger a review of whether the domain still has a coherent charter and
dependency envelope. That review justifies a domain split only when it identifies a concrete
boundary to protect; otherwise, code volume may justify splitting modules within the existing
domain.

### 1.3 Dependencies and implementation boundaries

Domain analysis distinguishes:

- **Type dependencies**, which affect source and declarations but are erased from JavaScript.
- **Runtime dependencies**, which are loaded or invoked by JavaScript.
- **Implementation dependencies**, which select or construct a concrete implementation.
- **Environment dependencies**, such as Node.js, filesystems, workers, or executables.
- **External-package dependencies**, which add separately versioned libraries.

These dependency kinds may justify different domains even when responsibilities are closely
related.

Interfaces and implementations should be separated into different domains when doing so protects a
real boundary, for example when:

- a consumer needs the contract without a concrete implementation;
- multiple implementations exist or are expected;
- the implementation adds environment, package, side-effect, or lifecycle dependencies;
- the contract and implementation have different stability expectations.

An interface does not require a separate domain mechanically. A module-local interface used only by
one implementation may remain with that implementation when separation protects no dependency,
stability, or lifecycle boundary.

Contract domains must not depend on their implementation domains. Concrete implementations and the
composition root point inward toward contracts.

### 1.4 Splitting and merging domains

A domain should be split when its modules cannot observe one coherent charter without weakening the
charter until it becomes uninformative. Split when doing so protects a concrete boundary such as:

- incompatible allowed dependency sets;
- different runtime or environment requirements;
- type-only code mixed with runtime implementation in a way that widens consumer dependencies;
- stable contracts mixed with volatile implementations;
- pure computation mixed with I/O or resource lifecycle ownership;
- opposing dependency directions or repeated exceptions to the charter.

A split is not justified merely because:

- different consumers use different exported symbols;
- modules cover different subtopics within the same charter;
- the directory contains a large amount of code;
- a finer taxonomy can be imagined;
- the code might theoretically become a separate package someday.

Domains may be merged when their charters are compatible and their separation no longer protects
dependency scope, runtime, stability, lifecycle, or ownership. Low code volume alone is not a merge
reason.

### 1.5 Composition and dependency direction

The domain dependency graph must be acyclic. Cycles should be resolved by finding the correct owner
for shared knowledge, extracting a dependency-light contract, or moving orchestration upward—not by
hiding the cycle inside a broad domain.

A policy that combines lower-level domains belongs to the higher-level domain that owns the
decision. Lower-level domains must not acquire knowledge of one another merely because a consumer
composes them. A new domain is warranted only when that composition has its own reusable charter.

Future package extraction is a useful test of dependency quality, not a classification goal. A
coherent domain with explicit one-way dependencies should become extractable as a consequence.

### 1.6 gitlode-specific policies

- The `gitlode` package currently targets Node.js 22 or later. Cross-runtime portability is not a
  default split criterion; it becomes one when a concrete portability requirement exists.
- Runtime-neutral and type-only domains must not acquire Node.js dependencies merely because the
  application itself requires Node.js.
- External packages, executables, workers, filesystem access, and disposable processes are material
  dependencies and must be allowed explicitly by the domain charter.
- Top-level process and worker composition may depend on concrete implementations. Lower-level
  contracts and policies may not depend on the composition root.

### 1.7 Decision procedure

Use the following procedure before adding, moving, splitting, merging, or renaming a domain:

1. Write or update the domain charter.
2. Identify the affected modules' responsibilities and dependency kinds.
3. Verify that all modules satisfy the same admissions, exclusions, runtime, and lifecycle rules.
4. Verify that consumers can accept the resulting dependency envelope.
5. State the boundary protected by a split or removed by a merge.
6. Verify that the dependency graph remains acyclic.
7. Prefer module organization when no domain boundary is protected, and record the accepted design
   before moving code.

If step 5 has no concrete answer, do not change the domain boundary yet.

## 2. gitlode Domain Definitions

This section defines the responsibility and scope of each top-level source domain. Dependency
directions are added separately after the domain charters are accepted.

Domains are not split in anticipation of a possible future need. A domain is reconsidered when a
concrete change exposes a boundary described in Section 1.4.

### 2.1 `type-utils`

**Purpose:** Globally available TypeScript type utilities that complement the language's built-in
utilities.

- Includes generic type transformations such as `Brand<T, Name>`.
- May use TypeScript language features and standard ECMAScript types.
- Excludes product-specific types, runtime values, source imports, ambient augmentation, Node.js
  types, and types from external packages.
- Is type-only, runtime-free, and independent of every other source domain.

Every domain may use `type-utils`; this is the sole global exception to the closed dependency
allowlist in Section 2.22.

### 2.2 `support`

**Purpose:** Product-independent runtime utilities for the supported Node.js environment.

- Includes collections, iterable operations, assertions, date formatting, and path utilities that
  are meaningful without gitlode product context.
- Excludes product policy, external-package-based implementations, import-time side effects, and
  long-lived resource management.
- May use JavaScript and Node.js standard APIs.

Different utility topics do not require separate domains while they continue to satisfy this
charter.

### 2.3 `model`

**Purpose:** Stable values and identities shared by multiple gitlode product domains.

- Includes commit and blob OIDs, object-format profiles, ref types, person identities, and their
  pure constants and guards.
- Excludes repository access, extraction workflows, I/O, backend representations, and types that
  exist only for CLI or output concerns.
- Must remain a deliberately small common model rather than a general location for shared code.

### 2.4 `instrumentation`

**Purpose:** Record and summarize execution measurements.

- Includes instrumentation contracts, spans, counters, attributes, noop behavior, local recording,
  iterable instrumentation, and profile summary data.
- Excludes progress reporting, user presentation, and product workflow decisions.
- Owns measurement collection, not the interpretation or display of measurements.

The contract and local implementation remain in one domain until a concrete need requires a
separate implementation boundary.

### 2.5 `dag`

**Purpose:** Generic directed-acyclic-graph traversal algorithms and their internal state.

- Includes topology and frontier contracts, reachable and difference traversal, certification
  algorithms, algorithm state machines, scheduling extension points, and graph-work telemetry.
- Excludes Git objects, refs, timestamps interpreted as Git policy, repository access, and
  Git-specific strategy selection.
- Must remain usable and explainable without Git concepts.

### 2.6 `git`

**Purpose:** Backend-independent Git repository access contracts.

- Includes the Git adapter contract, raw commit and blob facts, repository object-format contracts,
  adapter errors, and behavior shared by every backend.
- Excludes backend libraries, executable invocation, process management, backend parsers, extraction
  policy, and line-diff implementation.
- Defines what repository access provides, not how a backend provides it.

### 2.7 `git-impl`

**Purpose:** Concrete implementations of Git repository access.

- Includes isomorphic-git and Git CLI adapters, command protocols, cat-file sessions,
  backend-specific parsing and caching, Git-specific traversal strategy selection, and Git-specific
  scheduling policy.
- Excludes backend-independent contracts, extraction filtering and projection, file-size and binary
  policy, line-diff policy, and generic DAG algorithms.
- May own backend resources and backend-specific error translation.

### 2.8 `line-diff`

**Purpose:** Define the contract for calculating line-level addition and deletion statistics
between text contents.

- Includes the calculation contract and invariants of the calculation result.
- Excludes blob acquisition, binary detection, size limits, file-change classification, and Git tree
  comparison, as well as any particular calculation implementation.
- Is independent of repository semantics and concrete diff libraries.

### 2.9 `line-diff-impl`

**Purpose:** Implement the line-diff calculation contract.

- Includes concrete calculators such as the `diff`-package-backed implementation.
- Excludes binary and size policy, repository access, and file-change interpretation.
- Owns implementation-specific package use without widening the line-diff contract.

### 2.10 `extraction-api`

**Purpose:** Define the facts, records, and stage contracts of gitlode extraction.

- Includes canonical extraction facts, projected records, stage ports, extraction request and
  result contracts, and the checkpoint model carried by those contracts.
- Excludes traversal, filtering, deduplication, expansion and projection implementations, Git
  backends, output mechanics, and plugin hosting.
- Provides the stable vocabulary used by extraction consumers without exposing product-policy
  implementations.

### 2.11 `extraction`

**Purpose:** Execute gitlode's policy for transforming Git facts into analytical records.

- Includes traversal planning, filtering, cross-ref deduplication, file-change expansion policy,
  base projection, and extraction coordination.
- Excludes Git backend implementation, JSONL filesystem output, CLI parsing, presentation, plugin
  module loading, and checkpoint-file I/O.
- Owns product extraction semantics independently of delivery mechanisms.

### 2.12 `progress`

**Purpose:** Describe the progress of one gitlode run independently of its presentation.

- Includes progress phases, events, reporters, and neutral progress snapshots.
- Excludes terminal control, spinners, stderr output, timing instrumentation, and the work being
  reported.
- Defines progress meaning but not how progress is rendered.

### 2.13 `plugin-api`

**Purpose:** Define the public contract between plugin authors and gitlode.

- Includes plugin factories, plugin interfaces, projection contexts, initialization and projection
  results, failure policies, namespaces, and plugin runtime context contracts.
- Excludes module resolution, dynamic import, package compatibility checks, host registries, config
  file parsing, and host-side invocation.
- Is a stable public-facing contract even while identifier compatibility remains relaxed during
  prerelease development.

### 2.14 `plugin-runtime`

**Purpose:** Host and execute configured plugins inside gitlode.

- Includes entrypoint resolution, dynamic import, factory invocation, compatibility checks,
  initialization, runtime registration, per-fact invocation, and plugin enrichment orchestration.
- Excludes the public plugin contract, generic config parsing, base extraction projection, and
  concrete diagnostic rendering.
- Owns host-side plugin lifecycle and failure handling.

### 2.15 `state`

**Purpose:** Adapt persisted checkpoint information to and from the extraction contract.

- Includes pure validation and factories for persisted checkpoint information, persistence ports,
  and state-side missing-state concepts.
- Uses the checkpoint model defined by `extraction-api`; it does not define extraction input or
  result vocabulary.
- Excludes traversal-boundary selection, CLI option validation, extraction execution, and unrelated
  application state, as well as concrete filesystem persistence.
- Uses the established user-facing term `state`; its charter prevents the name from becoming a
  general-purpose state bucket.

### 2.16 `state-impl`

**Purpose:** Persist checkpoint state in the supported Node.js environment.

- Includes state-file reading and writing, JSON decoding, loaded-state validation at the I/O
  boundary, and atomic file replacement.
- Excludes checkpoint semantics, traversal policy, CLI validation, and unrelated persistence.
- Owns filesystem and serialization details without widening the state contract.

### 2.17 `output`

**Purpose:** Persist projected records as JSON Lines files.

- Includes JSON serialization, LF termination, output filename generation, line and byte rotation,
  file-handle lifecycle, sink implementation, and output byte and file counts.
- Excludes record semantics, fact projection, plugin enrichment, CLI output, and progress or summary
  rendering.
- Owns output mechanics rather than the meaning of the data being written.

### 2.18 `config`

**Purpose:** Define and load the versioned gitlode project configuration document.

- Includes configuration types and schema, JSON loading and parsing, schema diagnostics, path
  rebasing, and defaults that are part of the document format.
- Excludes command-line parsing, CLI/config precedence, effective run input, plugin module loading,
  and extraction execution.
- Owns the configuration document independently of a particular invocation.

### 2.19 `cli`

**Purpose:** Convert command-line input and project configuration into validated invocation input.

- Includes command definitions, CLI value schemas, CLI-specific validation, precedence resolution,
  path-option resolution and preflight checks, termination results, and CLI-facing input types.
- Excludes worker execution, extraction construction, repository traversal, presentation
  implementation, state persistence, and plugin module loading.
- Owns invocation semantics specific to the command-line interface.

### 2.20 `presentation`

**Purpose:** Present progress, diagnostics, and results to the user through stderr.

- Includes terminal sinks, TTY and quiet modes, spinners, heartbeat scheduling, progress rendering,
  diagnostic formatting, summary and profile formatting, and styling.
- Excludes progress-event meaning, measurement collection, product error classification, extraction
  execution, and CLI option parsing.
- Owns rendering and terminal interaction, not the events or data being rendered.

### 2.21 `execution`

**Purpose:** Compose and execute one gitlode run across the main-process and worker boundary.

- Includes run inputs and results, worker protocol and transport, concrete component construction,
  repository preflight and metadata resolution, run-scoped resource ownership, and extraction
  invocation.
- Excludes CLI parsing, extraction policy, concrete presentation, adapter internals, and
  configuration-document schema.
- Acts as the application composition boundary for one run.

### 2.22 Allowed domain dependencies

The following table is a closed allowlist of direct domain dependencies. A domain may not directly
depend on a domain absent from its row. Transitive dependencies do not grant permission for a direct
import.

`type-utils` is omitted from each domain's dependency list because every domain may depend on it. In
exchange for this global status, `type-utils` must preserve the stricter charter in Section 2.1. No
other domain is global. In particular, `support` remains explicit because its charter permits
Node.js runtime APIs.

| Domain            | Allowed direct domain dependencies                                                      |
| ----------------- | --------------------------------------------------------------------------------------- |
| `type-utils`      | None                                                                                    |
| `support`         | None                                                                                    |
| `model`           | None                                                                                    |
| `instrumentation` | None                                                                                    |
| `progress`        | None                                                                                    |
| `dag`             | `instrumentation`, `support`                                                            |
| `git`             | `model`                                                                                 |
| `git-impl`        | `dag`, `git`, `instrumentation`, `model`, `support`                                     |
| `line-diff`       | None                                                                                    |
| `line-diff-impl`  | `line-diff`                                                                             |
| `state`           | `extraction-api`, `model`, `support`                                                    |
| `state-impl`      | `state`, `support`                                                                      |
| `extraction-api`  | `model`, `progress`, `support`                                                          |
| `extraction`      | `extraction-api`, `git`, `instrumentation`, `line-diff`, `model`, `progress`, `support` |
| `plugin-api`      | `extraction-api`, `instrumentation`                                                     |
| `plugin-runtime`  | `extraction-api`, `instrumentation`, `plugin-api`, `progress`, `support`                |
| `output`          | `extraction-api`                                                                        |
| `config`          | `plugin-api`, `support`                                                                 |
| `cli`             | `config`, `state`, `support`                                                            |
| `presentation`    | `instrumentation`, `progress`, `support`                                                |
| `execution`       | Listed below because this composition domain has a larger direct dependency set.        |

`execution` may directly depend on:

- `extraction`
- `extraction-api`
- `git`
- `git-impl`
- `instrumentation`
- `line-diff-impl`
- `model`
- `output`
- `plugin-api`
- `plugin-runtime`
- `progress`
- `state`
- `state-impl`
- `support`

The allowlist applies to both type-only and runtime imports. The dependency kind remains relevant
when reviewing a domain's dependency envelope, but `import type` does not bypass the domain
boundary.

## 3. Supporting Guidance

### 3.1 Source layout and imports

- A top-level directory under `src/` represents a domain. Nested directories organize modules
  within that domain unless explicitly documented otherwise.
- Cross-domain imports use the target domain's supported barrel. Direct module imports are allowed
  within a domain.
- A barrel represents the domain contract. If consumers require materially different dependency
  envelopes, reconsider the domain boundary instead of bypassing the barrel with deep imports.

### 3.2 Enforcement

Architecture checks should distinguish type and runtime edges where practical and detect forbidden
edges, cross-domain deep imports, cycles, and contract-to-implementation violations.

### 3.3 Package and process entrypoints

Root-level entrypoint modules are facades, not domains:

- `src/index.ts` is the executable and top-level process boundary.
- `src/plugin-api.ts` is the package export facade for `gitlode/plugin-api`.

These modules connect external consumers to the owning domains and should not accumulate product
policy or implementation details.

### 3.4 Naming default selections

Do not use `Default` as a substitute for describing an implementation. Use it at a selection
boundary when several valid choices exist and one is selected if the caller does not specify one.
When both meanings matter, give the selection policy and concrete implementation separate
identifiers. For example, a default traversal-frontier factory may delegate to a FIFO-frontier
factory, preserving both the fallback policy and the implementation's ordering semantics.
