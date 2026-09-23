export function logMemory(
  stage: string,
): void {
  const memory =
    process.memoryUsage();

  const toMB = (bytes: number) =>
    Math.round(
      bytes / 1024 / 1024,
    );

  console.log(
    `[MEMORY] ${stage} | ` +
      `rss=${toMB(memory.rss)}MB | ` +
      `heapUsed=${toMB(memory.heapUsed)}MB | ` +
      `heapTotal=${toMB(memory.heapTotal)}MB | ` +
      `external=${toMB(memory.external)}MB`,
  );
}