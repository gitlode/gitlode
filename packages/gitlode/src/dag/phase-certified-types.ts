import type { InstrumentationSpan } from "../instrumentation/index.js";
import type { Brand } from "../type-utils/index.js";
import type { DagFrontier } from "./types.js";

/** Shared contracts for the phase-certified prototype facade and internal state modules. */
export type BranchId = Brand<number, "BranchId">;

export type CertifiedClosurePhaseResult<NodeId extends PropertyKey> =
  | {
      readonly kind: "closed-boundary";
      readonly certifiedNodes: ReadonlySet<NodeId>;
      readonly closedBoundary: NodeId;
    }
  | {
      readonly kind: "exhausted";
      readonly certifiedNodes: ReadonlySet<NodeId>;
      readonly terminalNodes: readonly NodeId[];
    };

export interface DifferenceFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly role: "main" | "exclude";
  readonly nodeId: NodeId;
  readonly domainHint?: DomainHint;
}

export interface ClosureFrontierItem<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly nodeId: NodeId;
  readonly branchId: BranchId;
  readonly domainHint?: DomainHint;
}

export interface PhaseCertifiedStrategyOptions<NodeId extends PropertyKey, DomainHint = undefined> {
  readonly createDifferenceFrontier?: () => DagFrontier<DifferenceFrontierItem<NodeId, DomainHint>>;
  readonly createClosureFrontier?: () => DagFrontier<ClosureFrontierItem<NodeId, DomainHint>>;
}

export interface DagPhaseCertifiedTelemetry {
  readonly span: InstrumentationSpan;
}

export interface CertifiedClosurePhaseResolution<
  NodeId extends PropertyKey,
  DomainHint = undefined,
> {
  readonly result: CertifiedClosurePhaseResult<NodeId>;
  readonly closedBoundaryDomainHint?: DomainHint;
}
