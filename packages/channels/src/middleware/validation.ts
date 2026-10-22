export function assertPositiveInteger(name: string, value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`Invalid ${name}: ${String(value)}. Expected a positive integer.`);
  }
}

export function assertPositiveFiniteNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${String(value)}. Expected a positive finite number.`);
  }
}
