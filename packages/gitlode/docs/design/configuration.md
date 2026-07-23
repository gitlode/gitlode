# Configuration File Design

## Purpose

The `--config` file is an explicit, versioned JSON document used to provide default extraction
settings and optional plugin declarations.

Phase 4 expands the file beyond plugin loading while preserving the existing `extensions`
contract.

## Scope (v1)

Supported top-level sections:

- `extraction`
- `output`
- `repository`
- `runtime`
- `extensions`

The root object is strict (`additionalProperties: false`). Unknown top-level keys are user errors.
Included sections are also strict.

## Canonical Shape

```json
{
  "version": 1,
  "extraction": {
    "refs": ["main", "develop"],
    "range": { "sinceRef": "origin/main" }
  },
  "output": {
    "directory": "./out",
    "prefix": "gitlode",
    "rotation": {
      "lines": 100000,
      "size": "1G"
    }
  },
  "repository": {
    "name": "my-repo",
    "url": "https://example.com/org/my-repo.git"
  },
  "runtime": {
    "profile": true,
    "gitAdapter": "isomorphic-git"
  },
  "extensions": {
    "my-plugin": {
      "entrypoint": "./my-plugin.js",
      "config": { "threshold": 10 },
      "failurePolicy": "skip-fact"
    }
  }
}
```

## Section Rules

### extraction

- `refs`: optional, non-empty string array
- `range`: optional object with exactly one key: `sinceRef` or `sinceDate`
- `sinceDate` uses the same ISO 8601 validation rule as `--since-date`
- `range` is snapshot-only (no config-level incremental mode)

### output

- `directory`: optional path string
- `prefix`: optional non-empty string
- `rotation.lines`: optional positive integer
- `rotation.size`: optional size string using the same grammar as `--rotate-size`

### repository

- `name`: optional default for `--repo-name`
- `url`: optional default for `--repo-url`
- These fields affect output metadata only.

### runtime

- `profile`: optional default for `--profile`
- `gitAdapter`: optional Git implementation selector. Supported values are `isomorphic-git` and
  `git-cli`; default is `isomorphic-git`. The `git-cli` adapter uses the Git executable for commit
  traversal, file-blob change discovery, and blob reads. Both implementations use the same Core
  file-change and line-diff policy.

### extensions

- Optional at file level.
- When present, must be a non-empty object.
- Internal plugin entry schema and runtime semantics are unchanged.

## Path Resolution

Path-valued fields in the config file resolve relative to the config file directory.

Current v1 path fields:

- `output.directory`
- `extensions.<namespace>.entrypoint` (for relative entrypoints)

## Precedence Model

### Scalar/path settings

`CLI explicit value > config value > built-in default`

Applies to:

- output directory / prefix
- repository name / url

### refs

- If CLI `--ref` is present, it replaces `extraction.refs` for that run.
- Otherwise, `extraction.refs` is used.
- If neither source provides refs, validation fails.

### snapshot range

- CLI `--since-ref` or `--since-date` replaces config `extraction.range` as a whole.
- CLI `--since-ref` and `--since-date` remain mutually exclusive.

### rotation thresholds

`lines` and `size` are resolved independently:

- `--rotate-lines` overrides only `output.rotation.lines`
- `--rotate-size` overrides only `output.rotation.size`

### profile

Effective profiling is:

`CLI --profile OR config runtime.profile OR false`

### git adapter

Effective Git adapter is:

`config runtime.gitAdapter OR "isomorphic-git"`

There is intentionally no CLI override for this setting.

## Conflict Rule

When `--incremental` is used and the config contains `extraction.range`, gitlode fails fast as a
user error before Git traversal.

## Validation Pipeline

1. CLI-only parse / format checks
2. Config read + JSON/schema validation (`--config` only)
3. CLI/config merge and conflict checks
4. Filesystem validation with effective settings
5. Git validation with effective refs/range

## Out of Scope (v1)

- `extends`
- environment variable interpolation
- config auto-discovery
- YAML/TOML formats
- config defaults for `--incremental`, `--state`, `--missing-state`, `--quiet`, `--per-file`, `--max-diff-size`
