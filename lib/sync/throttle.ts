export function createThrottle<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  intervalMs: number,
  now: () => number = Date.now,
): (...args: TArgs) => void {
  let lastExecutionAt = -Infinity;

  return (...args: TArgs): void => {
    const currentTime = now();
    if (currentTime - lastExecutionAt < intervalMs) {
      return;
    }

    lastExecutionAt = currentTime;
    callback(...args);
  };
}
