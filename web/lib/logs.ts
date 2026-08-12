export async function getLogsInChunks<T>(
  fromBlock: bigint,
  toBlock: bigint,
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[]>,
  chunkSize = 10n,
): Promise<T[]> {
  if (chunkSize <= 0n) throw new Error("Log chunk size must be greater than zero");
  if (toBlock < fromBlock) return [];

  const logs: T[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const chunkEnd = cursor + chunkSize - 1n > toBlock ? toBlock : cursor + chunkSize - 1n;
    const chunk = await fetchRange(cursor, chunkEnd);
    logs.push(...chunk);
    cursor = chunkEnd + 1n;
  }

  return logs;
}
