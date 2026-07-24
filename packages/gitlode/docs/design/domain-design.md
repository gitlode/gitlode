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

To be developed after the principles in Section 1 are accepted. Each domain definition will use the
charter fields from Section 1.1 and will document its allowed incoming and outgoing dependency
directions.

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
