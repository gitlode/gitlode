# gitlode — Copilot Instructions

## What This Project Is

`gitlode` is a CLI tool that extracts Git repository commit history and outputs it as JSON Lines (`.jsonl`) files, suitable for ingestion into data warehouses and analytical systems.

Key characteristics:

- Reads Git repository data via **isomorphic-git** (no dependency on system-installed Git)
- Outputs one commit per line in JSON Lines format
- Supports incremental (differential) extraction via a state file
- Designed for npm publication as a standalone CLI package

## Tech Stack

| Layer         | Choice                   | Rationale                                     |
| ------------- | ------------------------ | --------------------------------------------- |
| Language      | TypeScript (strict mode) | Type safety, npm ecosystem                    |
| Runtime       | Node.js                  | CLI target environment                        |
| Git access    | isomorphic-git           | Pure JS, no native build, actively maintained |
| CLI framework | citty                    | TypeScript-native, zero legacy overhead       |
| Output format | JSON Lines (JSONL)       | Streaming-friendly, DWH-compatible            |

## Repository Structure

```
gitlode/
├── .github/
├── .github/
│   ├── copilot-instructions.md       # This file
│   ├── instructions/
│   │   ├── architecture.instructions.md
│   │   ├── cli.instructions.md
│   │   ├── schema.instructions.md
│   │   ├── git-traversal.instructions.md
│   │   └── development-workflow.instructions.md
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── plan.md
│   └── roadmap.md
├── src/
│   ├── index.ts                      # CLI entry point
│   ├── cli/                          # CLI argument parsing
│   │   ├── args.ts
│   │   └── index.ts
│   ├── core/                         # Core extraction logic
│   │   ├── extractor.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── git/                          # Git Adapter layer
│   │   ├── errors.ts
│   │   ├── index.ts
│   │   ├── isomorphic-git-adapter.ts
│   │   └── types.ts
│   └── output/                       # JSON serialization and file rotation
│       ├── index.ts
│       ├── types.ts
│       ├── utils.ts
│       └── writer.ts
├── test/                             # Mirrors src/ layout
│   ├── cli/
│   ├── core/
│   ├── git/
│   └── output/
├── package.json
└── tsconfig.json
```

## Design Principles

1. **Layered architecture**: CLI → Core Logic → Git Adapter Interface → isomorphic-git. Each layer has a single responsibility. See [architecture.instructions.md](instructions/architecture.instructions.md).
2. **Adapter pattern for Git access**: Core logic depends on an abstract `GitAdapter` interface, not directly on isomorphic-git. This allows future library substitution without touching core logic.
3. **Streaming-first**: Commit traversal and file output are designed as streams/async iterables to handle large repositories without loading all data into memory.
4. **Fail-safe state management**: The state file is updated only after successful output. Partial failures must not corrupt state.
5. **Stable core, volatile edges**: Keep policy and domain decisions in the core, and push runtime-specific mechanisms — such as file I/O, clocks, logging, console output, and framework bindings — to the system boundary through explicit abstractions.

## Key Design Decisions (do not revisit without reason)

- Git library: **isomorphic-git** (not nodegit, not simple-git)
- Output format: **JSON Lines**, `\n` line endings, `.jsonl` extension
- Branch specification: required (no default); represents "ref to use as traversal starting point"
- Differential extraction: controlled by `--state` file (preferred) or `--since-commit` / `--since-date`
- Timestamp format: **ISO 8601** using the offset embedded in each commit object
- Package/command name: **gitlode**

## Detailed Specifications

- [Architecture & Component Design](instructions/architecture.instructions.md)
- [CLI Interface Specification](instructions/cli.instructions.md)
- [Output JSON Schema](instructions/schema.instructions.md)
- [Git Traversal & Differential Extraction](instructions/git-traversal.instructions.md)
- [Phase Section Template](instructions/phase-template.instructions.md)
- [Development Workflow](instructions/development-workflow.instructions.md)

## Coding Conventions

- **Code comments must be written in English.** This applies to all source files, configuration files, and CI/CD definitions.
- **Always run `npm run format:write` before finishing any implementation session.** CI enforces `npm run format:check`; failing to format locally will cause CI failures on push. The verification checklist for every phase must include `npm run format:check` as the final step.

## Planning & Phase-Execution Guidance

The full development lifecycle — session types, planning stages, implementation cycle, summary formats, and role expectations — is defined in [development-workflow.instructions.md](instructions/development-workflow.instructions.md). Refer to that document for all workflow-related guidance.

Key principles for implementation sessions:

- Treat the phase file and starting prompt as the **implementation contract**.
- Do **not** reopen a design choice specified in the phase file unless verification evidence shows it is blocked or incorrect.
- If an important technical decision is ambiguous, pause and escalate rather than making an architectural choice during implementation.
- Use [phase-template.instructions.md](instructions/phase-template.instructions.md) as the standard structure when authoring phase files.

## Autonomy

This is an early-stage greenfield project with no existing users or production dependencies.

Favor autonomous execution for local work inside an already authorized step.

Always follow workflow-specific gate rules when a referenced workflow document
requires explicit human authorization before the next step.

**Proceed without asking for confirmation** for all local, reversible actions:

- Creating, editing, or moving files
- Installing or updating dependencies
- Running builds, tests, linters, or formatters
- Creating commits

**Always ask before:**

- Deleting any file or directory
- Running `git push`, `git reset --hard`, or any history-altering command
