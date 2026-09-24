# P3 generic profile presentation: small real-output evidence

These are bounded excerpts from three real CLI runs, not synthetic formatter fixtures and not
formal performance measurements. They were captured from product source
`737f36338e45e08fbfed2095dcd2a81c5f09098d` after `npm run build:dev`, using the existing
deterministic five-commit fixtures. Each run used the ordinary schema-2 report and presentation
path; no fixed-fallback delivery diagnostic was present. Durations are runtime observations and
will vary on reproduction.

Reproduce from the repository root:

```powershell
npm run build:dev
npx tsx packages/gitlode/scripts/capture-profile-evidence.ts
```

The capture script creates and removes temporary repositories and output directories. It invokes
`node packages/gitlode/dist/index.js --profile --ref main --output-dir <temp> --config <temp>
[--per-file] <temp-repository>`. CLI stdout was captured in memory and was empty for all three
runs. Summary, warnings and Profile were captured from stderr; the script prints one complete Scope
excerpt per run to keep this committed evidence small. JSONL went to the temporary output directory
and was removed after each successful run.

## Commit-granularity excerpt

Fixture: `commit_heavy_repository`, isomorphic-git, five commits, no plugins. CLI stdout: 0 bytes.

```text
  Scope: gitlode.execution
    /gitlode
      extraction
        range.resolve : calls=1, total=204.4 µs, avg=204.4 µs, max=204.4 µs, errors=0
          range.kind = none
      repository
        access.validate : calls=1, total=12.37 ms, avg=12.37 ms, max=12.37 ms, errors=0
        metadata.resolve : calls=1, total=1.041 ms, avg=1.041 ms, max=1.041 ms, errors=0
          name.source = path
          url.source = missing
        object_format.resolve : calls=1, total=1.971 ms, avg=1.971 ms, max=1.971 ms, errors=0
          /gitlode.git.object_format = sha1
      run : calls=1, total=39.04 ms, avg=39.04 ms, max=39.04 ms, errors=0
        /gitlode.commit.unique.count = 5…5
        /gitlode.extraction.granularity = commit
        /gitlode.extraction.range.kind = none
        /gitlode.git.adapter = isomorphic-git
        /gitlode.git.object_format = sha1
        /gitlode.output.file.count = 1…1
        /gitlode.output.record.count = 5…5
        /gitlode.output.size = 2008…2008
        result = success
      state
        validate : calls=1, total=86.6 µs, avg=86.6 µs, max=86.6 µs, errors=0
          /gitlode.ref.prior.count = 0…0
```

## File-granularity excerpt

Fixture: `file_heavy_repository`, isomorphic-git, five commits, two requested fixture files,
`--per-file`, no plugins. CLI stdout: 0 bytes.

```text
  Scope: gitlode.line_diff@""
    /gitlode
      line_diff
        compute.duration : samples=11, total=1.505 ms, avg=136.8 µs, min=29 µs, max=609.9 µs
          compute.outcome = success
        compute.input.size : samples=11, total=142 B, avg=12.91 B, min=0 B, max=41 B
          compute.outcome = success
        compute.operation : 11 operations
          compute.outcome = success
```

This run exposed and then verified the explicit-empty-version rendering rule:
`gitlode.line_diff@""` is distinct from a missing version.

## Plugin-enriched excerpt

Fixture: `plugin_heavy_projection`, isomorphic-git, five commits, two plugin registrations,
`--per-file`. CLI stdout: 0 bytes. Compatibility warnings preceded the summary because the local
fixture package intentionally has no `peerDependencies.gitlode`; they are outside this Scope excerpt.

```text
  Scope: @gitlode/performance-fixture-plugin@1.0.0
    /gitlode
      plugin
        init : calls=2, total=167.8 µs, avg=83.9 µs, max=92.1 µs, errors=0
          init.result = ready(2)
        projection.duration : samples=12, total=193.5 µs, avg=16.13 µs, min=3.2 µs, max=128.4 µs
          projection.outcome = skip
          /gitlode.projection.fact.type = file-change
        projection.duration : samples=12, total=86.5 µs, avg=7.208 µs, min=2.5 µs, max=18.2 µs
          projection.outcome = success
          /gitlode.projection.fact.type = file-change
        projection.operation : 12 operations
          projection.outcome = skip
          /gitlode.projection.fact.type = file-change
        projection.operation : 12 operations
          projection.outcome = success
          /gitlode.projection.fact.type = file-change
```

These non-TTY captures establish plain-text structure only. Human light/dark terminal readability,
color perception and wrapping remain pending after independent P3 review.
