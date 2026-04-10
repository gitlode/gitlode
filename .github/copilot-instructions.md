# gitrail — Copilot Instructions

## What This Project Is

`gitrail` is a CLI tool that extracts Git repository commit history and outputs it as JSON Lines (`.jsonl`) files, suitable for ingestion into data warehouses and analytical systems.

Key characteristics:

- Reads Git repository data via **isomorphic-git** (no dependency on system-installed Git)
- Outputs one commit per line in JSON Lines format
- Supports incremental (differential) extraction via a state file
- Designed for npm publication as a standalone CLI package

## Tech Stack

| Layer         | Choice                          | Rationale                                     |
| ------------- | ------------------------------- | --------------------------------------------- |
| Language      | TypeScript (strict mode)        | Type safety, npm ecosystem                    |
| Runtime       | Node.js                         | CLI target environment                        |
| Git access    | isomorphic-git                  | Pure JS, no native build, actively maintained |
| CLI framework | TBD (see `cli.instructions.md`) |                                               |
| Output format | JSON Lines (JSONL)              | Streaming-friendly, DWH-compatible            |

## Repository Structure (target)

```
gitrail/
├── .github/
│   ├── copilot-instructions.md       # This file
│   └── instructions/
│       ├── architecture.instructions.md
│       ├── cli.instructions.md
│       ├── schema.instructions.md
│       └── git-traversal.instructions.md
├── src/
│   ├── index.ts                      # CLI entry point
│   ├── cli/                          # CLI argument parsing
│   ├── core/                         # Core extraction logic
│   ├── git/                          # Git Adapter layer
│   └── output/                       # JSON serialization and file rotation
├── tests/
├── package.json
└── tsconfig.json
```

## Design Principles

1. **Layered architecture**: CLI → Core Logic → Git Adapter Interface → isomorphic-git. Each layer has a single responsibility. See [architecture.instructions.md](instructions/architecture.instructions.md).
2. **Adapter pattern for Git access**: Core logic depends on an abstract `GitAdapter` interface, not directly on isomorphic-git. This allows future library substitution without touching core logic.
3. **Streaming-first**: Commit traversal and file output are designed as streams/async iterables to handle large repositories without loading all data into memory.
4. **Fail-safe state management**: The state file is updated only after successful output. Partial failures must not corrupt state.

## Key Design Decisions (do not revisit without reason)

- Git library: **isomorphic-git** (not nodegit, not simple-git)
- Output format: **JSON Lines**, `\n` line endings, `.jsonl` extension
- Branch specification: required (no default); represents "ref to use as traversal starting point"
- Differential extraction: controlled by `--state` file (preferred) or `--since-commit` / `--since-date`
- Timestamp format: **ISO 8601** using the offset embedded in each commit object
- Package/command name: **gitrail**

## Detailed Specifications

- [Architecture & Component Design](instructions/architecture.instructions.md)
- [CLI Interface Specification](instructions/cli.instructions.md)
- [Output JSON Schema](instructions/schema.instructions.md)
- [Git Traversal & Differential Extraction](instructions/git-traversal.instructions.md)

## Coding Conventions

- **Code comments must be written in English.** This applies to all source files, configuration files, and CI/CD definitions.
- **Always run `npm run format:write` before finishing any implementation session.** CI enforces `npm run format:check`; failing to format locally will cause CI failures on push. The verification checklist for every phase must include `npm run format:check` as the final step.

## Autonomy

This is an early-stage greenfield project with no existing users or production dependencies.

**Proceed without asking for confirmation** for all local, reversible actions:

- Creating, editing, or moving files
- Installing or updating dependencies
- Running builds, tests, linters, or formatters
- Creating commits

**Always ask before:**

- Deleting any file or directory
- Running `git push`, `git reset --hard`, or any history-altering command
