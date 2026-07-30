import nodeFs from "node:fs";

import { GitCliAdapter, IsomorphicGitAdapter } from "@gitlode/git-adapters";
import {
  EXPERIMENTAL_COMMIT_TRAVERSAL_ENV,
  createCommitTraversalStrategy,
  resolveCommitTraversalStrategyName,
} from "@gitlode/git-adapters/experimental";
import type { GitAdapter } from "@gitlode/internal-contracts/git";
import type { Instrumentation } from "@gitlode/internal-foundation/instrumentation";

import type { ExecutionGitAdapterName } from "./types.js";

export interface GitAdapterFactoryDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
}

type BuildGitAdapterResult =
  | {
      readonly kind: "success";
      readonly adapter: GitAdapter;
      readonly gitVersion?: string;
    }
  | { readonly kind: "user-error"; readonly message: string };

function resolveIsomorphicCommitTraversalStrategyFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  return createCommitTraversalStrategy(
    resolveCommitTraversalStrategyName(environment[EXPERIMENTAL_COMMIT_TRAVERSAL_ENV]),
  );
}

export async function buildGitAdapter(
  adapterName: ExecutionGitAdapterName,
  instrumentation: Instrumentation,
  dependencies: GitAdapterFactoryDependencies,
): Promise<BuildGitAdapterResult> {
  switch (adapterName) {
    case "isomorphic-git": {
      let commitTraversalStrategy;
      try {
        commitTraversalStrategy = resolveIsomorphicCommitTraversalStrategyFromEnvironment(
          dependencies.environment,
        );
      } catch (error) {
        return {
          kind: "user-error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
      return {
        kind: "success",
        adapter: new IsomorphicGitAdapter({
          fs: nodeFs,
          instrumentation,
          commitTraversalStrategy,
        }),
      };
    }
    case "git-cli": {
      const adapter = new GitCliAdapter({
        instrumentation,
      });
      try {
        const gitVersion = await adapter.validateGitExecutable();
        return {
          kind: "success",
          adapter,
          gitVersion,
        };
      } catch (error) {
        return {
          kind: "user-error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
}
