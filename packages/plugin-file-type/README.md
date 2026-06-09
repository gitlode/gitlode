# @gitlode/plugin-file-type

Official gitlode plugin package for file type classification.

This plugin enriches per-file gitlode records with file type information derived from the file
path. It is intended for use with `--per-file`; commit-only output does not carry file path facts
for this plugin to classify.

The plugin is intentionally limited to mechanically determined file type classification based on
file path signatures. It does not classify source/test role, architecture domain, ownership, or
other interpretation-heavy concerns.

## Installation

```bash
npm install @gitlode/plugin-file-type
```

## Usage

Configure gitlode with `--config`:

```json
{
  "version": 1,
  "extensions": {
    "file-type": {
      "entrypoint": "@gitlode/plugin-file-type"
    }
  }
}
```

Run gitlode with per-file output enabled:

```bash
gitlode -r main --per-file --config ./gitlode.config.json ./my-repo
```

Example output in each record:

```json
{
  "extensions": {
    "file-type": {
      "name": "TypeScript"
    }
  }
}
```

## Configuration

Default effective plugin config:

```json
{
  "debug": false,
  "ruleSets": ["common"],
  "mappings": {},
  "unknownPolicy": "emit"
}
```

Supported config fields:

- `debug`: optional boolean. Default is `false`.
- `ruleSets`: optional string array. V1 supports only `"common"`. Default is `["common"]`.
- `mappings`: optional object from path signature to non-empty file type name.
- `unknownPolicy`: optional string, either `"emit"` or `"skip"`. Default is `"emit"`.

Validation behavior:

- Unknown top-level config fields are treated as fatal config errors.
- Duplicate `ruleSets` values are invalid.
- Invalid mapping signatures are invalid.

### Mapping Key Syntax

`mappings` uses a single object for both suffix and basename matching.

- Keys beginning with `*.` are suffix mappings.
- Keys not beginning with `*.` are exact basename mappings.
- General glob syntax is not supported.
- Compound suffixes are supported (for example `*.d.ts`).
- Dot-prefixed basename keys are valid (for example `.gitignore`, `.config.json`, `.ts`).

Example:

```json
{
  "mappings": {
    "*.vue": "Vue",
    "*.d.ts": "TypeScript",
    "Dockerfile": "Dockerfile",
    ".config.json": "Tool config"
  }
}
```

### Matching Semantics

Matching precedence is:

1. user basename mapping
2. user suffix mapping
3. built-in basename mapping
4. built-in suffix mapping
5. unknown handling

Additional rules:

- Basename matching is case-sensitive.
- Suffix matching is case-insensitive.
- Longest suffix wins among suffix matches.
- Deleted file changes are classified the same as added/modified file changes.

### Built-In Rule Set

V1 provides one built-in rule set: `common`.

`common` is a pragmatic curated set that includes widely used language, format, archive, and
repository filename mappings. The full mapping table lives in
`src/rule-sets.ts` and is grouped by maintenance categories in source comments.

Examples from `common` include:

- `*.ts` -> `TypeScript`
- `*.json` -> `JSON`
- `package.json` -> `npm package manifest`
- `.gitignore` -> `Git ignore file`

Strongly ambiguous signatures are intentionally omitted in V1 and can be added later when needed.

### Unknown Handling

- `unknownPolicy: "emit"` (default) emits `{ "name": "Unknown" }`.
- `unknownPolicy: "skip"` returns plugin `skip`, so gitlode writes `null` for this namespace.

### Debug Output

When `debug: true`, the plugin adds `_debug` metadata:

```json
{
  "name": "TypeScript",
  "_debug": {
    "source": "common",
    "matched": "*.ts"
  }
}
```

`source` values:

- `common`: built-in rule set match
- `plugin-config`: user mapping match
- `unknown`: unknown classification

### Commit Facts

For commit facts (`fact.type === "commit"`), the plugin always returns `skip`.

## Compatibility

This package declares:

```json
"peerDependencies": {
  "gitlode": "^0.8.2"
}
```

If the running gitlode version does not satisfy this range, gitlode emits a warning and
continues.

## License

[MIT](LICENSE)

## Changelog

[Changelog](CHANGELOG.md)
