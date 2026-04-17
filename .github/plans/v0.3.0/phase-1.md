# Phase 1: `erasableSyntaxOnly` and Non-Erasable Syntax Refactor

_Enable the `erasableSyntaxOnly` TypeScript compiler flag to statically prevent non-erasable syntax from entering the codebase, and refactor the single existing violation (a parameter property in `NodeStateStore`) to comply._

## Status

- [ ] Planned
- [ ] In progress
- [ ] Completed

## Design References

- Roadmap item: "Preparation: Introduce `erasableSyntaxOnly` and refactor non-erasable syntax"

## Design Decisions

- **Flag to add**: `"erasableSyntaxOnly": true` in `tsconfig.json` under `compilerOptions`, in the "Type Checking" group alongside the existing strict flags.
- **Only known violation**: the parameter property `constructor(private readonly stateFilePath: string) {}` in `NodeStateStore` (`src/index.ts`). Expand it to an explicit field declaration and regular assignment:
  ```typescript
  private readonly stateFilePath: string;
  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
  }
  ```
- **No other violations**: a codebase scan confirms no `const enum`, `namespace`, legacy decorators, or other parameter properties in `src/`. The flag will compile cleanly after the single refactor.
- **New runtime dependencies**: none.
- **Owning layer**: `tsconfig.json` (compiler config) and `src/index.ts` (CLI boundary). No changes to core, git, or output layers.

## Non-Goals

- Changing any runtime behavior, CLI behavior, or output format.
- Adding a separate `tsconfig.dev.json` or modifying the build pipeline — that belongs to the "Migrate to Node.js built-in TypeScript support" roadmap item.
- Refactoring any other class or module beyond the single `NodeStateStore` violation.

## Target Files

| File            | Action | Notes                                                                                                                                                           |
| --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json` | Modify | Add `"erasableSyntaxOnly": true` under `compilerOptions`, in the "Type Checking" group.                                                                         |
| `src/index.ts`  | Modify | Expand `NodeStateStore` parameter property into an explicit `private readonly stateFilePath: string` field declaration plus assignment in the constructor body. |

## Documentation Touchpoints

| File                 | Section                                                                        | Action                                                    |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `.github/roadmap.md` | "Preparation: Introduce `erasableSyntaxOnly` and refactor non-erasable syntax" | Remove (completed item; cleanup happens in Release Tasks) |

## Implementation Notes

- No test changes are expected: the refactor is type-only with no observable behavioral change.

## Verification

**Automated:**

```
npm run build
npm test
npm run format:check
```

**Behavioral checks:**

- Confirm `npm run build` produces zero type errors with `erasableSyntaxOnly: true` enabled.
- Introduce a parameter property temporarily (e.g. `constructor(private x: number) {}`) in any source file and confirm `tsc` rejects it — then revert.
