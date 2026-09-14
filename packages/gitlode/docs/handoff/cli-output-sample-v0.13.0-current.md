# CLI output sample gitlode@v0.13.0

```
✓ Initializing plugins  elapsed 0.0s
✓ Preparing extraction  elapsed 0.0s
✓ Extracting history  refs 1/1  commits 670  records 670  written 808.4KB  elapsed 6.9s
✓ Finalizing output  elapsed 0.0s

Extraction complete
  Records written   : 670
  Commits traversed : 670
  Files created     : 1
  Bytes written     : 808.4KB
  Elapsed time      : 7.0s
  Refs              : master

Profile
  Spans
    Overview
      Run: total=6.9819153 s, calls=1, avg=6.9819153 s, max=6.9819153 s, errors=0, gitlode.commit.unique.count=670…670, gitlode.extraction.granularity=commit, gitlode.extraction.range.kind=ref, gitlode.git.adapter=isomorphic-git, gitlode.git.object_format=sha1, gitlode.output.file.count=1…1, gitlode.output.record.count=670…670, gitlode.output.size=827788…827788, gitlode.run.result=success
    Setup
      Repository access: total=26.83 ms, calls=1, avg=26.83 ms, max=26.83 ms, errors=0
      Object format: total=1.914 ms, calls=1, avg=1.914 ms, max=1.914 ms, errors=0, gitlode.git.object_format=sha1
      State validation: total=134.7 µs, calls=1, avg=134.7 µs, max=134.7 µs, errors=0, gitlode.ref.prior.count=0…0
      Repository metadata: total=1.061 ms, calls=1, avg=1.061 ms, max=1.061 ms, errors=0, gitlode.repository.name.source=remote_url, gitlode.repository.url.source=remote
      Extraction range: total=13.58 ms, calls=1, avg=13.58 ms, max=13.58 ms, errors=0, gitlode.extraction.range.kind=ref
      Plugin bootstrap: total=14.14 ms, calls=1, avg=14.14 ms, max=14.14 ms, errors=0, gitlode.plugin.configured.count=2…2, gitlode.plugin.failed.count=0…0, gitlode.plugin.ready.count=2…2, gitlode.plugin.resolved.count=2…2
      Plugin resolution: total=7.638 ms, calls=1, avg=7.638 ms, max=7.638 ms, errors=0, gitlode.plugin.configured.count=2…2, gitlode.plugin.resolved.count=2…2
      Plugin compatibility: total=5.047 ms, calls=1, avg=5.047 ms, max=5.047 ms, errors=0, gitlode.plugin.compatibility.warning.count=0…0, gitlode.plugin.resolved.count=2…2
    Pipeline
      Extraction: total=6.9184131 s, calls=1, avg=6.9184131 s, max=6.9184131 s, errors=0, gitlode.commit.unique.count=670…670, gitlode.extraction.granularity=commit, gitlode.extraction.range.kind=ref, gitlode.output.record.count=670…670, gitlode.ref.requested.count=1…1
      Planning: total=15.16 ms, calls=1, avg=15.16 ms, max=15.16 ms, errors=0, gitlode.extraction.mode=snapshot, gitlode.extraction.range.kind=ref, gitlode.ref.prior.count=0…0, gitlode.ref.requested.count=1…1, gitlode.ref.skipped.count=0…0, gitlode.traversal.plan.count=1…1
      Traversal: total=6.9003786 s, calls=1, avg=6.9003786 s, max=6.9003786 s, errors=0, gitlode.extraction.range.kind=ref, gitlode.stream.completion=exhausted(1), gitlode.traversal.plan.count=1…1
      Projection: total=6.900747 s, calls=1, avg=6.900747 s, max=6.900747 s, errors=0, gitlode.projection.mode=plugin_enriched, gitlode.stream.completion=exhausted(1)
      Output close: total=287.3 µs, calls=1, avg=287.3 µs, max=287.3 µs, errors=0
    Git operations
      Resolve ref: total=52.40 ms, calls=3, avg=17.47 ms, max=25.90 ms, errors=0, gitlode.git.adapter=isomorphic-git
      Classify ref: total=1.223 ms, calls=1, avg=1.223 ms, max=1.223 ms, errors=0, gitlode.git.adapter=isomorphic-git, gitlode.git.ref.type=branch(1)
      Repository object format: total=1.679 ms, calls=1, avg=1.679 ms, max=1.679 ms, errors=0, gitlode.git.adapter=isomorphic-git, gitlode.git.object_format=sha1
      Resolve remote URL: total=717.5 µs, calls=1, avg=717.5 µs, max=717.5 µs, errors=0, gitlode.git.adapter=isomorphic-git, gitlode.git.remote_url.result=found(1)
    Git traversal
      Commit walk: total=6.8999261 s, calls=1, avg=6.8999261 s, max=6.8999261 s, errors=0, gitlode.git.adapter=isomorphic-git, gitlode.git.commit.walk.has_exclusion=true(1), gitlode.git.commit.walk.strategy=certified-lazy(1), gitlode.stream.completion=exhausted(1)
    DAG
      DAG traversal: total=6.8995647 s, calls=1, avg=6.8995647 s, max=6.8995647 s, errors=0, gitlode.dag.certification.result=certified(1), gitlode.dag.has_exclusion=true(1), gitlode.dag.strategy=certified-lazy(1), gitlode.dag.termination.reason=frontier-exhausted(1), gitlode.stream.completion=exhausted(1)
    Plugins
      @gitlode/plugin-conventional-commits@0.6.0
        Initialization: total=449.4 µs, calls=1, avg=449.4 µs, max=449.4 µs, errors=0, gitlode.plugin.init.result=ready(1)
      @gitlode/plugin-custom-field@0.7.0
        Initialization: total=543.2 µs, calls=1, avg=543.2 µs, max=543.2 µs, errors=0, gitlode.plugin.init.result=ready(1)
  Counters
    Pipeline
      Accepted commits: 670 commits, gitlode.extraction.granularity=commit
    Git traversal
      Yielded commits: 670 commits, gitlode.git.adapter=isomorphic-git, gitlode.git.commit.walk.has_exclusion=true, gitlode.git.commit.walk.strategy=certified-lazy
    Git object access
      Object reads: 671 objects, gitlode.git.adapter=isomorphic-git, gitlode.git.object.purpose=topology, gitlode.git.object.type=commit
      Cache lookups: 670 objects, gitlode.git.adapter=isomorphic-git, gitlode.git.object.purpose=materialize, gitlode.git.object.type=commit
      Cache lookups: 672 objects, gitlode.git.adapter=isomorphic-git, gitlode.git.object.purpose=topology, gitlode.git.object.type=commit
      Cache hits: 670 objects, gitlode.git.adapter=isomorphic-git, gitlode.git.object.purpose=materialize, gitlode.git.object.type=commit
      Cache hits: 1 objects, gitlode.git.adapter=isomorphic-git, gitlode.git.object.purpose=topology, gitlode.git.object.type=commit
    DAG
      Operation completion: 1 operations, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.operation.completion=success, gitlode.dag.strategy=certified-lazy
      Processed steps: 673 steps, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.strategy=certified-lazy
      Stale steps: 2 steps, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.strategy=certified-lazy
      Successor expansions: 2 expansions, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.role=exclude, gitlode.dag.strategy=certified-lazy
      Successor expansions: 670 expansions, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.role=main, gitlode.dag.strategy=certified-lazy
      Yielded nodes: 670 nodes, gitlode.dag.has_exclusion=true, gitlode.dag.operation=difference, gitlode.dag.strategy=certified-lazy
    Output
      Records written: 670 records, gitlode.extraction.granularity=commit
      Files created: 1 files
      Bytes written: 808.4 KiB
    Plugins
      @gitlode/plugin-conventional-commits@0.6.0
        Projection operations: 670 operations, gitlode.plugin.projection.outcome=success, gitlode.projection.fact.type=commit
      @gitlode/plugin-custom-field@0.7.0
        Projection operations: 670 operations, gitlode.plugin.projection.outcome=success, gitlode.projection.fact.type=commit
  Histograms
    Projection
      Built-in projection: count=670, total=4.611 ms, avg=6.882 µs, min=5.000 µs, max=201.3 µs, gitlode.projection.fact.type=commit, gitlode.projection.outcome=success
    Output
      Write duration: count=670, total=43.44 ms, avg=64.84 µs, min=33.30 µs, max=1.198 ms, gitlode.extraction.granularity=commit, gitlode.output.write.outcome=success
    Plugins
      @gitlode/plugin-conventional-commits@0.6.0
        Projection duration: count=670, total=87.61 ms, avg=130.8 µs, min=12.30 µs, max=2.187 ms, gitlode.plugin.projection.outcome=success, gitlode.projection.fact.type=commit
      @gitlode/plugin-custom-field@0.7.0
        Projection duration: count=670, total=1.723 ms, avg=2.571 µs, min=1.900 µs, max=54.70 µs, gitlode.plugin.projection.outcome=success, gitlode.projection.fact.type=commit
```
