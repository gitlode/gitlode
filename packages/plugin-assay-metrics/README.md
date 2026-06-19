# @gitlode/plugin-assay-metrics

Official gitlode plugin for heuristic development activity metrics.

This plugin attaches assay metrics to per-file gitlode records.

Assay metrics are heuristic measures derived from diff data.
They do not represent absolute ground truth about developer effort or code value, but provide quantitative signals that can surface patterns in development activity when aggregated across authors, time periods, or repositories.

These measures are intended to be compared over time or across repositories rather than interpreted as point-in-time absolute values.

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
      "net-change": 15
    }
  }
}
```

## Measures

All measures in this section are computed from per-file `addition`/`deletion` line counts and attached to per-file gitlode records.

### delta

```
delta = additions - deletions
```

Signed difference between addition and deletion.
Positive values indicate growth, negative values indicate reduction.
This measure is direction-aware: a large rewrite with equal addition and deletion results in a `delta` of zero, even though substantial work occurred.

### churn

```
churn = additions + deletions
```

Total lines touched, combining addition and deletion without offsetting them.
Unlike `delta`, `churn` does not cancel out rewrites; a file with equal addition and deletion will show a non-zero `churn`, reflecting that work occurred even when the net line count did not change.

### net-change

```
net-change = max(additions, deletions)
```

A heuristic measure intended to approximate the volume of deliberate code change while avoiding the double-counting that `churn` can introduce for rewrites.
It rests on the assumption that, within a single commit, addition and deletion in the same file are likely to originate from related work rather than unrelated changes — and that under this assumption, the overlapping portion of addition and deletion represents the same underlying work rather than two separate units of work.

`net-change` does not distinguish between pure addition, pure deletion, and rewrites of equal size — all three are treated as comparable in volume.
This is a deliberate simplification, not an attempt to model code value or correctness.

### Interpreting these measures together

`delta`, `churn`, and `net-change` are not alternative formulas for the same underlying quantity — they represent different assumptions about what counts as "work," and are intended to be read alongside one another rather than in isolation.
A divergence between them (for example, a near-zero `delta` alongside a large `churn` or `net-change`) can itself be a useful signal, suggesting rewrite-heavy activity rather than net growth or reduction.

As with all assay metrics, these values are heuristic.
They do not measure developer effort or code value directly, and are best used in aggregate — across time periods, authors, or repositories — rather than interpreted from a single record.

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
