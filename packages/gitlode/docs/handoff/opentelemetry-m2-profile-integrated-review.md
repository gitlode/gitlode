# M2 integrated profile display review

Status: overall display accepted for v0.13.0 with known limitations; not implemented output or a new
measurement run. The [detailed design](opentelemetry-m2-profile-design.md) defines the final contract.

## Evidence and display conventions

This example transforms every profile observation row in
[the supplied current capture](cli-output-sample-v0.13.0-current.md).
Canonical names and scopes are recovered from `src/presentation/reporting/profile-view.ts`.
Values come from already formatted text; no raw durations or missing observations are inferred.
The extraction summary is outside this display review.

The example applies the accepted Scope/name hierarchy, field order, precision, relative attributes,
and stable ordering. Source attribute-summary notation (`670…670`, `ready(1)`) and entity unit
spelling (`1 files`) are retained for v0.13.0.

Display conventions:

- Two spaces per level; one attribute per supplementary line; no global column padding.
- A name that is also a namespace node carries values on that node's line. Its attributes use
  that node's namespace as their relative base. In particular, `projection` has its own span
  values and a child `duration` observation.
- Scope versions use existing `name@version` spelling.
- Plain text cannot verify bold/subdued/bright styling. Terminal review remains necessary after
  implementation; this example does not claim visual style validation.

## Complete transformation of the supplied profile

```text
Profile
  Scope: @gitlode/plugin-conventional-commits@0.6.0
    /gitlode
      plugin
        init : calls=1, total=449.4 µs, avg=449.4 µs, max=449.4 µs, errors=0
          init.result = ready(1)
        projection.duration : samples=670, total=87.61 ms, avg=130.8 µs, min=12.3 µs, max=2.187 ms
          projection.outcome = success
          /gitlode.projection.fact.type = commit
        projection.operation : 670 operations
          projection.outcome = success
          /gitlode.projection.fact.type = commit
  Scope: @gitlode/plugin-custom-field@0.7.0
    /gitlode
      plugin
        init : calls=1, total=543.2 µs, avg=543.2 µs, max=543.2 µs, errors=0
          init.result = ready(1)
        projection.duration : samples=670, total=1.723 ms, avg=2.571 µs, min=1.9 µs, max=54.7 µs
          projection.outcome = success
          /gitlode.projection.fact.type = commit
        projection.operation : 670 operations
          projection.outcome = success
          /gitlode.projection.fact.type = commit
  Scope: gitlode.dag
    /gitlode
      dag
        node.yielded : 670 nodes
          has_exclusion = true
          operation = difference
          strategy = certified-lazy
        operation.completion : 1 operations
          has_exclusion = true
          operation = difference
          operation.completion = success
          strategy = certified-lazy
        step.processed : 673 steps
          has_exclusion = true
          operation = difference
          strategy = certified-lazy
        step.stale : 2 steps
          has_exclusion = true
          operation = difference
          strategy = certified-lazy
        successor.expansion : 2 expansions
          has_exclusion = true
          operation = difference
          role = exclude
          strategy = certified-lazy
        successor.expansion : 670 expansions
          has_exclusion = true
          operation = difference
          role = main
          strategy = certified-lazy
        traversal : calls=1, total=6.9 s, avg=6.9 s, max=6.9 s, errors=0
          certification.result = certified(1)
          has_exclusion = true(1)
          strategy = certified-lazy(1)
          termination.reason = frontier-exhausted(1)
          /gitlode.stream.completion = exhausted(1)
  Scope: gitlode.execution
    /gitlode
      extraction
        range.resolve : calls=1, total=13.58 ms, avg=13.58 ms, max=13.58 ms, errors=0
          range.kind = ref
      repository
        access.validate : calls=1, total=26.83 ms, avg=26.83 ms, max=26.83 ms, errors=0
        metadata.resolve : calls=1, total=1.061 ms, avg=1.061 ms, max=1.061 ms, errors=0
          name.source = remote_url
          url.source = remote
        object_format.resolve : calls=1, total=1.914 ms, avg=1.914 ms, max=1.914 ms, errors=0
          /gitlode.git.object_format = sha1
      run : calls=1, total=6.982 s, avg=6.982 s, max=6.982 s, errors=0
        /gitlode.commit.unique.count = 670…670
        /gitlode.extraction.granularity = commit
        /gitlode.extraction.range.kind = ref
        /gitlode.git.adapter = isomorphic-git
        /gitlode.git.object_format = sha1
        /gitlode.output.file.count = 1…1
        /gitlode.output.record.count = 670…670
        /gitlode.output.size = 827788…827788
        result = success
      state
        validate : calls=1, total=134.7 µs, avg=134.7 µs, max=134.7 µs, errors=0
          /gitlode.ref.prior.count = 0…0
  Scope: gitlode.extraction
    /gitlode
      extract : calls=1, total=6.918 s, avg=6.918 s, max=6.918 s, errors=0
        /gitlode.commit.unique.count = 670…670
        /gitlode.extraction.granularity = commit
        /gitlode.extraction.range.kind = ref
        /gitlode.output.record.count = 670…670
        /gitlode.ref.requested.count = 1…1
      extraction
        commit.accepted : 670 commits
          granularity = commit
      output
        byte.written : 808.4 KiB
        close : calls=1, total=287.3 µs, avg=287.3 µs, max=287.3 µs, errors=0
        file.created : 1 files
        write.duration : samples=670, total=43.44 ms, avg=64.84 µs, min=33.3 µs, max=1.198 ms
          /gitlode.extraction.granularity = commit
          write.outcome = success
        write.record : 670 records
          /gitlode.extraction.granularity = commit
      planning : calls=1, total=15.16 ms, avg=15.16 ms, max=15.16 ms, errors=0
        /gitlode.extraction.mode = snapshot
        /gitlode.extraction.range.kind = ref
        /gitlode.ref.prior.count = 0…0
        /gitlode.ref.requested.count = 1…1
        /gitlode.ref.skipped.count = 0…0
        /gitlode.traversal.plan.count = 1…1
      projection : calls=1, total=6.901 s, avg=6.901 s, max=6.901 s, errors=0
        mode = plugin_enriched
        /gitlode.stream.completion = exhausted(1)
        duration : samples=670, total=4.611 ms, avg=6.882 µs, min=5 µs, max=201.3 µs
          fact.type = commit
          outcome = success
      traversal : calls=1, total=6.9 s, avg=6.9 s, max=6.9 s, errors=0
        /gitlode.extraction.range.kind = ref
        /gitlode.stream.completion = exhausted(1)
        plan.count = 1…1
  Scope: gitlode.git
    /gitlode
      git
        classify_ref : calls=1, total=1.223 ms, avg=1.223 ms, max=1.223 ms, errors=0
          adapter = isomorphic-git
          ref.type = branch(1)
        commit.walk : calls=1, total=6.9 s, avg=6.9 s, max=6.9 s, errors=0
          adapter = isomorphic-git
          commit.walk.has_exclusion = true(1)
          commit.walk.strategy = certified-lazy(1)
          /gitlode.stream.completion = exhausted(1)
        commit.yielded : 670 commits
          adapter = isomorphic-git
          commit.walk.has_exclusion = true
          commit.walk.strategy = certified-lazy
        object.cache.hit : 670 objects
          adapter = isomorphic-git
          object.purpose = materialize
          object.type = commit
        object.cache.hit : 1 objects
          adapter = isomorphic-git
          object.purpose = topology
          object.type = commit
        object.cache.lookup : 670 objects
          adapter = isomorphic-git
          object.purpose = materialize
          object.type = commit
        object.cache.lookup : 672 objects
          adapter = isomorphic-git
          object.purpose = topology
          object.type = commit
        object.read : 671 objects
          adapter = isomorphic-git
          object.purpose = topology
          object.type = commit
        remote_url.resolve : calls=1, total=717.5 µs, avg=717.5 µs, max=717.5 µs, errors=0
          adapter = isomorphic-git
          remote_url.result = found(1)
        repository_object_format : calls=1, total=1.679 ms, avg=1.679 ms, max=1.679 ms, errors=0
          adapter = isomorphic-git
          object_format = sha1
        resolve_ref : calls=3, total=52.4 ms, avg=17.47 ms, max=25.9 ms, errors=0
          adapter = isomorphic-git
  Scope: gitlode.plugin_runtime
    /gitlode
      plugin
        bootstrap : calls=1, total=14.14 ms, avg=14.14 ms, max=14.14 ms, errors=0
          configured.count = 2…2
          failed.count = 0…0
          ready.count = 2…2
          resolved.count = 2…2
        compatibility.check : calls=1, total=5.047 ms, avg=5.047 ms, max=5.047 ms, errors=0
          compatibility.warning.count = 0…0
          resolved.count = 2…2
        resolve : calls=1, total=7.638 ms, avg=7.638 ms, max=7.638 ms, errors=0
          configured.count = 2…2
          resolved.count = 2…2
```

## Hypothetical collection issues (not present in the supplied capture)

These are independent excerpts, not one execution. Notification placement and `!` follow the accepted detailed design.
The arbitrary numeric values below are synthetic. Attribute lists unrelated to the illustrated
issue are omitted explicitly for brevity; the complete real-data example above omits none.

### A. Additional datapoints lost, retained datapoints still valid

```text
Profile
  ! Collection issues detected; see affected observations below.
  Scope: gitlode.git
    /gitlode
      git
        object.cache.lookup
          ! Additional attribute combinations omitted: datapoint retention limit reached.
        object.cache.lookup : 670 objects
          adapter = isomorphic-git
          object.purpose = materialize
          object.type = commit
        object.cache.lookup : 672 objects
          adapter = isomorphic-git
          object.purpose = topology
          object.type = commit
```

The notification applies to the instrument, not to the numeric accuracy of either retained point.
No omitted combination, quantity or zero is invented. The shared issue-only name line is the selected
way to place one explanation beside repeated rows without creating a third namespace group.

### B. Identified observation with no surviving result

```text
Profile
  ! Collection issues detected; see affected observations below.
  Scope: gitlode.extraction
    /gitlode
      output
        write.duration : unavailable
          ! No valid result retained: invalid aggregation discarded.
```

This scenario assumes evidence that no valid result for this identified observation survived.
It does not infer that every possible attribute combination was measured and lost.

### C. Attribute detail lost while measurements survive

```text
Profile
  ! Collection issues detected; see affected observations below.
  Scope: gitlode.git
    /gitlode
      git
        commit.walk : calls=20, total=2 s, avg=100 ms, max=150 ms, errors=0
          commit.walk.strategy = …
          ! commit.walk.strategy: additional attribute values omitted; retention limit reached.
```

Here `…` stands for an omitted synthetic retained-value list in this explanatory excerpt, not a
proposed runtime placeholder. Measurement fields are not marked incomplete for attribute-only loss.

### D. Broad failure without identified observations

```text
Profile
  ! Collection issues detected.
  ! Metric collection failed; affected scopes and observation names are unknown.
```

Surviving span rows would follow in their normal locations. No missing metric names or empty
Scopes are inferred from the catalog. This wording uses a technical term to delimit impact;
it does not restore signal-kind sections or routine row badges.

## Interpretation and limitations

- All 44 measured rows from the supplied Profile are retained across seven Scopes. In this example,
  the Profile occupies 178 lines, with a longest line of 98 characters (before terminal styling).
  This is a layout measurement of this sample, not a general width guarantee.
- The original current capture puts Git operation spans and object counters in different signal
  sections. They are now together under one Scope/namespace; each datapoint remains independent.
- Plugin initialization, operation counts and duration distributions appear together per Scope.
  Lexical ordering puts package Scopes before core Scopes; this is the accepted order applied,
  not an accidental preservation of an old priority list.
- Attribute repetition and vertical length remain substantial, especially for DAG and Git metrics.
  No attribute pivot or new verbose flag is introduced to compensate; these are accepted tradeoffs.
- Unlike the legacy table, field columns are not aligned globally. This avoids padding every row
  for the longest name but can make cross-row numeric comparison harder. The selected layout uses
  minimal spacing without global alignment.
- `gitlode.projection` is both an observation and a namespace with a child. Its values appear on
  its heading, its attributes first, then child observations. `=` identifies attributes and `:`
  identifies measurement rows. This structure does not assert trace parentage or exclusive cost.
- Attribute summaries retain current semantics for v0.13.0: `ready(1)` counts ended Spans with that
  final attribute value, not calls to `setAttribute`. The early follow-up on Span aggregation and
  information retention is specified in the [detailed design](opentelemetry-m2-profile-design.md).
- Notification syntax in hypothetical examples illustrates the accepted conventions. The structured
  contract, retention budget and edge rules are specified in the detailed design.

## Synthetic file-workload field example

This excerpt is not a captured file extraction. It checks that the same generic rules work with a
size histogram, a duration histogram and an explicit zero counter. It does not replace representative
file-workload execution and human review during implementation acceptance. Attributes are omitted
here to focus on units; the actual display must retain all collected attributes.

```text
Scope: gitlode.git
  /gitlode
    git
      blob.read.byte : 0 B
      blob.read.duration : samples=2, total=3 ms, avg=1.5 ms, min=1 ms, max=2 ms
      blob.read.size : samples=2, total=0 B, avg=0 B, min=0 B, max=0 B
```

The hypothetical input is two successfully read empty blobs. Zero is an actual retained value,
not a placeholder for missing data. In a separate hypothetical histogram with optional extrema
absent, those fields would use `—`; that absence alone does not create a collection warning.
