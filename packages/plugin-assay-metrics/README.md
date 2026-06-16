# @gitlode/plugin-assay-metrics

Official gitlode plugin for heuristic development activity metrics.

This plugin attaches assay metrics to per-file gitlode records.

Assay metrics are heuristic measures derived from diff data. They do not represent
absolute ground truth about developer effort or code value, but provide quantitative signals
that can surface patterns in development activity when aggregated across authors, time periods,
or repositories.

These measures are intended to be compared over time or across repositories rather than
interpreted as point-in-time absolute values.

## Installation

```bash
npm install -g @gitlode/plugin-assay-metrics
```

## Usage

Configure gitlode with `--config`:

```json
{
  "version": 1,
  "extensions": {
    "assay-metrics": {
      "entrypoint": "@gitlode/plugin-assay-metrics"
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
    "assay-metrics": {
      "delta": -5,
      "churn": 25,
      "max": 15
    }
  }
}
```

## Configuration

This plugin does not define any plugin-specific configuration.

You can omit `config` entirely:

```json
{
  "version": 1,
  "extensions": {
    "assay-metrics": {
      "entrypoint": "@gitlode/plugin-assay-metrics"
    }
  }
}
```

## Compatibility

This package declares:

```json
"peerDependencies": {
	"gitlode": "^0.9.0"
}
```

If the running gitlode version does not satisfy this range, gitlode emits a warning and continues.

## License

[MIT](LICENSE)

## Changelog

[Changelog](CHANGELOG.md)
