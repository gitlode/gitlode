# Controller continuation

Instruction checkpoint: 1f65e95c076c0b106ce7111a47011f6f314b9a1f.
Controller parent: a514034c10eb193304f482bb5783c02d5a200431.
Quiet window: 2026-10-07 14:06–17:06 JST; hard stop: 17:06 JST.
Fresh root: /home/t-wakabayashi/gitlode-performance/m2-rss-corrected-20261007T1406.

Reuse the original sealed runtimes, Node and saved fixture without rebuilding.
Compare the exact dist path/size/hash set. Check package.json against the sealed
runtime tar, and allow only dist directories, package.json and the documented
node_modules link. Verify its original target from the tar and its restored target;
the complete dependency inventory is checked separately against preserved evidence.
The operator wrapper requires command success plus the matching persisted successful
gate and snapshot. Python failures propagate through bash and WSL to PowerShell;
the invoking PowerShell must exit with $LASTEXITCODE immediately.
Use bash operator.sh gate, then bash operator.sh runs. No stale success markers.
Synthetic tests exercise positive/negative layouts and the actual shell wrapper.

Old failures and sealed archives remain unchanged. V1 span IDs and V2 omitted empty
finalization calls remain confounders. Exactly V0,V1,V2,V2,V1,V0, no retry/warmup.
No product variant change, formal measurement, PR, merge or acceptance authority.
