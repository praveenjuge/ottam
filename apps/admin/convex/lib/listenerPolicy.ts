export function shouldApplyProgress(
  existingClientSequence: number | undefined,
  incomingClientSequence: number,
): boolean {
  return (
    Number.isSafeInteger(incomingClientSequence) &&
    incomingClientSequence >= 0 &&
    (existingClientSequence === undefined ||
      incomingClientSequence > existingClientSequence)
  );
}

export function isDuplicateGuestMerge(
  storedIdempotencyKey: string | undefined,
  incomingIdempotencyKey: string,
): boolean {
  return storedIdempotencyKey === incomingIdempotencyKey;
}
