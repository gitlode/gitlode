# @gitlode/plugin-identity-profile

Official gitlode plugin package for identity normalization and profile enrichment.

This plugin rewrites the emitted `author` and `committer` identities from an inline master mapping
table and can optionally attach additional profile attributes for downstream analysis.

## Installation

```bash
npm install -g @gitlode/plugin-identity-profile
```

## Usage

Configure gitlode with `--config`:

```json
{
  "version": 1,
  "extensions": {
    "identity-profile": {
      "entrypoint": "@gitlode/plugin-identity-profile",
      "config": {
        "attributeFields": ["team", "costCenter"],
        "profileMappings": [
          {
            "matchEmail": "author@example.com",
            "name": "Author Canonical",
            "email": "author.canonical@example.com",
            "team": "platform",
            "costCenter": 42
          },
          {
            "matchName": "Committer Alias",
            "name": "Committer Canonical",
            "email": "committer.canonical@example.com",
            "team": "ops"
          }
        ]
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
    "identity-profile": {
      "author": {
        "name": "Author Canonical",
        "email": "author.canonical@example.com",
        "attributes": {
          "team": "platform",
          "costCenter": 42
        }
      },
      "committer": {
        "name": "Committer Canonical",
        "email": "committer.canonical@example.com",
        "attributes": {
          "team": "ops"
        }
      }
    }
  }
}
```

If one side does not match any mapping row, that side is passed through with the original input
`name` and `email`.

## Configuration

`config` value schema for this plugin:

```json
{
  "debug": false,
  "attributeFields": ["team", "costCenter"],
  "profileMappings": [
    {
      "matchEmail": "author@example.com",
      "matchName": "Author Alias",
      "name": "Author Canonical",
      "email": "author.canonical@example.com",
      "team": "platform",
      "costCenter": 42
    }
  ]
}
```

Rules:

- `profileMappings` is required and must contain at least one row.
- Each row must define non-empty `name` and `email` values.
- Each row must define at least one effective matcher: `matchEmail` or `matchName`.
- `matchEmail` and `matchName` use raw exact matching. `matchEmail` is tried first; `matchName`
  is used only when no email match is found.
- Empty string and `null` in `matchEmail` or `matchName` are treated as absent.
- `attributeFields` is optional. If omitted, it behaves as `[]` and no custom attributes are
  emitted.
- Attribute values may be `string`, `number`, `boolean`, or `null`.
- Reserved field names are `matchEmail`, `matchName`, `name`, and `email`; they must not appear in
  `attributeFields`.
- Unknown row fields that are neither reserved nor listed in `attributeFields` are ignored and
  warned once per distinct field name during `init()`.
- Duplicate `matchEmail` or `matchName` values are allowed. The first matching row wins, and the
  plugin emits a warning for overlapping keys during `init()`.

## Debug Output

Set `debug: true` to include `_debug` metadata per emitted side:

```json
{
  "extensions": {
    "identity-profile": {
      "author": {
        "name": "Author Canonical",
        "email": "author.canonical@example.com",
        "_debug": {
          "source": "master",
          "matchedBy": "email"
        }
      },
      "committer": {
        "name": "Committer Alias",
        "email": "committer@example.com",
        "_debug": {
          "source": "input"
        }
      }
    }
  }
}
```

`_debug` is omitted unless `debug` is enabled.

## Diagnostics

This plugin validates configuration during `init()`.

- Fatal configuration problems are reported through gitlode's plugin runtime `error()` channel and
  then fail initialization.
- Tolerated issues, such as unknown fields or overlapping match keys, are reported through
  `warn()` and extraction continues.

## Compatibility

This package declares:

```json
"peerDependencies": {
  "gitlode": "^0.8.0"
}
```

If the running gitlode version does not satisfy this range, gitlode emits a warning and
continues.

## License

[MIT](LICENSE)

## Changelog

[Changelog](CHANGELOG.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
