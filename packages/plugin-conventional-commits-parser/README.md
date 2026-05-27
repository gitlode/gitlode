# @gitlode/plugin-conventional-commits-parser

Parse commit messages with [conventional-commits-parser](https://www.npmjs.com/package/conventional-commits-parser) and write the parsed result under
`extensions["conventional-commits"]` in every gitlode output record.

The plugin uses the commit message from the source commit for both commit facts and file-change
facts, so the same parsed payload is available on both record types.

## Installation

```bash
npm install -g @gitlode/plugin-conventional-commits-parser
```

## Usage

Configure gitlode with `--config`:

```json
{
  "version": 1,
  "extensions": {
    "conventional-commits": {
      "entrypoint": "@gitlode/plugin-conventional-commits-parser"
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
    "conventional-commits": {
      "merge": null,
      "revert": null,
      "header": "feat(parser): add plugin docs",
      "body": "Expand README and CHANGELOG.",
      "footer": "Refs: #123",
      "notes": [],
      "mentions": [],
      "references": [
        {
          "raw": "Refs: #123",
          "action": null,
          "owner": null,
          "repository": null,
          "prefix": "#",
          "issue": "123"
        }
      ],
      "type": "feat",
      "scope": "parser",
      "subject": "add plugin docs"
    }
  }
}
```

The exact payload shape follows the upstream `conventional-commits-parser` result. Common fields
include `type`, `scope`, `subject`, `body`, `footer`, `notes`, `mentions`, and `references`.

## Configuration

This plugin does not define any plugin-specific configuration.

You can omit `config` entirely:

```json
{
  "version": 1,
  "extensions": {
    "conventional-commits": {
      "entrypoint": "@gitlode/plugin-conventional-commits-parser"
    }
  }
}
```

## Compatibility

This package declares:

```json
"peerDependencies": {
	"gitlode": "^0.7.0"
}
```

If the running gitlode version does not satisfy this range, gitlode emits a warning and continues.

## License

[MIT](LICENSE)
