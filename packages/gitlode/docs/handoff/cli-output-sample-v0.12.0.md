# CLI output sample gitlode@v0.12.0

```
✓ Initializing plugins  elapsed 0.0s
✓ Preparing extraction  elapsed 0.0s
✓ Extracting history  refs 1/1  commits 670  records 670  written 808.4KB  elapsed 7.0s
✓ Finalizing output  elapsed 0.0s

Extraction complete
  Records written   : 670
  Commits traversed : 670
  Files created     : 1
  Bytes written     : 808.4KB
  Elapsed time      : 7.1s
  Refs              : master

Profile
  span                                :      total  calls         avg         max  details
  gitlode.run                         : 7,097.29ms      1  7,097.29ms  7,097.29ms  git.adapter=isomorphic-git gitlode.granularity=commit gitlode.profile gitlode.result=success commits=670 records=670
  gitlode.validate_repository_access  :    24.31ms      1     24.31ms     24.31ms
  git.resolve_ref                     :     4.89ms      3      1.63ms      3.00ms
  gitlode.resolve_object_format       :     3.80ms      1      3.80ms      3.80ms  git.object_format=sha1
  git.repository_object_format        :     3.64ms      1      3.64ms      3.64ms
  gitlode.state.validate              :     0.05ms      1      0.05ms      0.05ms
  gitlode.repository_basics           :     0.92ms      1      0.92ms      0.92ms
  git.get_remote_url                  :     0.72ms      1      0.72ms      0.72ms
  gitlode.resolve_extraction_range    :    13.40ms      1     13.40ms     13.40ms  gitlode.range.kind=ref
  gitlode.plugins.resolve_entries     :     7.82ms      1      7.82ms      7.82ms
  gitlode.plugins.check_compatibility :     5.59ms      1      5.59ms      5.59ms
  gitlode.plugins.initialize          :     0.59ms      1      0.59ms      0.59ms  plugins=2
  gitlode.extract                     : 7,039.79ms      1  7,039.79ms  7,039.79ms  commits=670 records=670 refs=1 skipped_diffs=0
  gitlode.planning                    :    12.61ms      1     12.61ms     12.61ms  gitlode.mode=snapshot gitlode.range.kind=ref gitlode.refs=1
  gitlode.projection                  : 7,013.05ms      1  7,013.05ms  7,013.05ms
  gitlode.traversal                   : 7,012.98ms      1  7,012.98ms  7,012.98ms  gitlode.range.kind=ref plans=1
  git.walk_commits                    : 7,012.75ms      1  7,012.75ms  7,012.75ms  strategy=certified-lazy commit_reads=671 commits_yielded=670 materialize_commit_cache_hits=670 topology_commit_cache_hits=1 topology_commit_reads=671
  dag.traversal                       : 7,012.47ms      1  7,012.47ms  7,012.47ms  result=certified strategy=certifiedLazy exclude_expansions=2 main_expansions=670 stale_steps=2 successor_expansions=672 traversal_steps=673 yielded_nodes=670
  gitlode.traversal.process_commit    :     2.09ms    670      0.00ms      0.11ms
  gitlode.projection.project          :     3.84ms    670      0.01ms      0.13ms
  gitlode.output.write                :    40.44ms    670      0.06ms      1.70ms
  gitlode.output.close                :     0.30ms      1      0.30ms      0.30ms
```
