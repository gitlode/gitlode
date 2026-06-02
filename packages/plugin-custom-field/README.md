# @gitlode/plugin-custom-field

Add static custom fields to every gitlode output record under `extensions["custom-field"]`.

This plugin is intended as a simple, practical
session-labeling tool. Typical use cases include tagging extraction output with branch,
environment, run id, or other pipeline metadata.

## Installation

```bash
npm install -g @gitlode/plugin-custom-field
```

## Usage

Configure gitlode with `--config`:

```json
{
  "version": 1,
  "extensions": {
    "custom-field": {
      "entrypoint": "@gitlode/plugin-custom-field",
      "config": {
        "value": {
          "branch": "develop",
          "run_id": 20260526,
          "is_backfill": false,
          "notes": null
        }
      }
    }
  }
}
```

Run gitlode:

```bash
gitlode -r main --config ./gitlode.config.json ./my-repo
```

Each emitted record will include:

```json
{
  "extensions": {
    "custom-field": {
      "branch": "develop",
      "run_id": 20260526,
      "is_backfill": false,
      "notes": null
    }
  }
}
```

## Configuration

`config` value schema for this plugin:

```json
{
  "value": "<string|number|boolean>"
}
```

or

```json
{
  "value": {
    "<fieldName>": "<string|number|boolean|null>"
  }
}
```

Rules:

- `value` is required and must be either:
  - a scalar: `string`, finite `number`, or `boolean`, or
  - an object containing at least one entry.
- Field names must match `^[A-Za-z_][A-Za-z0-9_-]*$`.
- Field values must be scalar JSON values only: `string`, `number`, `boolean`, or `null`.
- Number values must be finite (`NaN`, `Infinity`, and `-Infinity` are rejected).

## Notes on Numeric Values

This plugin writes parsed JSON values as-is. Some number literals may not preserve their lexical
form through JSON parse/serialize boundaries (for example, large integers beyond IEEE-754 safe
range, exponent forms, or trailing decimal zeros).

Use strings when exact lexical preservation is required (for example, external ids).

## Compatibility

This package declares:

```json
"peerDependencies": {
	"gitlode": "^0.8.0"
}
```

If the running gitlode version does not satisfy this range, gitlode emits a warning and continues.

## License

[MIT](LICENSE)
