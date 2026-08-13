import type { ProductionMessage } from "./production-agent";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJson(entry)]),
  );
}

function isEqualJson(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right))
  );
}

function mergeApprovalPart(persisted: unknown, incoming: unknown): unknown {
  if (isEqualJson(persisted, incoming)) return persisted;
  if (
    !isRecord(persisted) ||
    !isRecord(incoming) ||
    persisted.state !== "approval-requested" ||
    incoming.state !== "approval-responded" ||
    !isRecord(persisted.approval) ||
    !isRecord(incoming.approval) ||
    typeof incoming.approval.approved !== "boolean"
  ) {
    throw new Error("A persisted assistant message cannot be changed.");
  }
  const reason = incoming.approval.reason;
  if (
    reason !== undefined &&
    (typeof reason !== "string" || reason.length > 500)
  ) {
    throw new Error("An approval reason must be at most 500 characters.");
  }
  const mergedApproval = {
    ...persisted.approval,
    approved: incoming.approval.approved,
    ...(reason === undefined ? {} : { reason }),
  };
  const merged = {
    ...persisted,
    approval: mergedApproval,
    state: "approval-responded",
  };
  if (!isEqualJson(merged, incoming)) {
    throw new Error("An approval response cannot change its tool call.");
  }
  return merged;
}

function mergeAssistantMessage(
  persisted: ProductionMessage,
  incoming: ProductionMessage,
): ProductionMessage {
  if (persisted.parts.length !== incoming.parts.length) {
    throw new Error("A persisted assistant message cannot be changed.");
  }
  const merged = {
    ...persisted,
    parts: persisted.parts.map((part, index) =>
      mergeApprovalPart(part, incoming.parts[index]),
    ),
  } as ProductionMessage;
  if (!isEqualJson(merged, incoming)) {
    throw new Error("A persisted assistant message cannot be changed.");
  }
  return merged;
}

export function mergeIncomingMessage(
  persisted: ProductionMessage[],
  incoming: ProductionMessage,
): ProductionMessage[] {
  const existingIndex = persisted.findIndex(
    (message) => message.id === incoming.id,
  );
  if (existingIndex === -1) {
    if (incoming.role !== "user") {
      throw new Error(
        "A new assistant message cannot originate in the browser.",
      );
    }
    const previous = persisted.at(-1);
    if (
      (previous?.parts as unknown[] | undefined)?.some(
        (part) => isRecord(part) && part.state === "approval-requested",
      )
    ) {
      throw new Error("Respond to the pending approval before continuing.");
    }
    return [...persisted, incoming];
  }
  const existing = persisted[existingIndex];
  if (existing?.role !== incoming.role) {
    throw new Error("A persisted message role cannot be changed.");
  }
  if (incoming.role === "user") {
    if (!isEqualJson(existing, incoming)) {
      throw new Error("A persisted user message cannot be changed.");
    }
    return persisted;
  }
  if (incoming.role !== "assistant" || existingIndex !== persisted.length - 1) {
    throw new Error("Only the latest assistant approval can be answered.");
  }
  const merged = mergeAssistantMessage(existing, incoming);
  return persisted.map((message, index) =>
    index === existingIndex ? merged : message,
  );
}
