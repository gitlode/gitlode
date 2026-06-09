# @gitlode/plugin-file-type

Official gitlode plugin package for file type classification.

This plugin enriches per-file gitlode records with file type information derived from the file
path. It is intended for use with `--per-file`; commit-only output does not carry file path facts
for this plugin to classify.

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

## Configuration

Configuration details will be completed with the plugin implementation.

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
