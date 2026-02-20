export const PERFORMANCE_TARGETS = {
  frameRateFps: 60,
  objectSyncLatencyMs: 100,
  cursorSyncLatencyMs: 50,
  zoomSpeedPercentPerSecond: 60,
  panDragFps: 45,
  aiPromptExecutionMs: 3000,
  objectCapacity: 500,
  concurrentUsers: 5,
} as const;

export type MetricStatus = 'good' | 'warn' | 'unknown';

export function classifyFpsStatus(fps: number | null): MetricStatus {
  if (fps === null) return 'unknown';
  return fps >= PERFORMANCE_TARGETS.frameRateFps ? 'good' : 'warn';
}

export function classifyLatencyStatus(
  latencyMs: number | null,
  targetMaxMs: number,
): MetricStatus {
  if (latencyMs === null) return 'unknown';
  return latencyMs <= targetMaxMs ? 'good' : 'warn';
}

export function classifyZoomSpeedStatus(
  zoomSpeedPercentPerSecond: number | null,
): MetricStatus {
  if (zoomSpeedPercentPerSecond === null) return 'unknown';
  return zoomSpeedPercentPerSecond >= PERFORMANCE_TARGETS.zoomSpeedPercentPerSecond
    ? 'good'
    : 'warn';
}

export function classifyAIPromptExecutionStatus(
  aiPromptExecutionMs: number | null,
): MetricStatus {
  if (aiPromptExecutionMs === null) return 'unknown';
  return aiPromptExecutionMs <= PERFORMANCE_TARGETS.aiPromptExecutionMs ? 'good' : 'warn';
}

export function classifyPanDragFpsStatus(
  panDragFps: number | null,
): MetricStatus {
  if (panDragFps === null) return 'unknown';
  return panDragFps >= PERFORMANCE_TARGETS.panDragFps ? 'good' : 'warn';
}

export function classifyCapacityStatus(count: number): MetricStatus {
  return count >= PERFORMANCE_TARGETS.objectCapacity ? 'good' : 'warn';
}

export function classifyConcurrentUsersStatus(count: number): MetricStatus {
  return count >= PERFORMANCE_TARGETS.concurrentUsers ? 'good' : 'warn';
}

export function formatFps(fps: number | null): string {
  if (fps === null) return '—';
  return `${Math.round(fps)} FPS`;
}

export function formatLatencyMs(latencyMs: number | null): string {
  if (latencyMs === null) return '—';
  return `${latencyMs.toFixed(1)} ms`;
}

export function formatZoomSpeed(zoomSpeedPercentPerSecond: number | null): string {
  if (zoomSpeedPercentPerSecond === null) return '—';
  return `${zoomSpeedPercentPerSecond.toFixed(1)} %/s`;
}

export function formatAIPromptExecutionMs(aiPromptExecutionMs: number | null): string {
  if (aiPromptExecutionMs === null) return '—';
  return `${aiPromptExecutionMs.toFixed(1)} ms`;
}

export function formatPanDragFps(panDragFps: number | null): string {
  if (panDragFps === null) return '—';
  return `${Math.round(panDragFps)} FPS`;
}
