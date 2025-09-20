export async function withRateLimit<T>(fn: () => Promise<T>, ms = 800): Promise<T> {
  const result = await fn();
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  return result;
}
