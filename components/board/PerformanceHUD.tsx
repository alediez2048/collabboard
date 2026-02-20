'use client';

import {
  classifyAIPromptExecutionStatus,
  classifyCapacityStatus,
  classifyConcurrentUsersStatus,
  classifyFpsStatus,
  classifyLatencyStatus,
  classifyPanDragFpsStatus,
  classifyZoomSpeedStatus,
  formatAIPromptExecutionMs,
  formatFps,
  formatLatencyMs,
  formatPanDragFps,
  formatZoomSpeed,
  PERFORMANCE_TARGETS,
  type MetricStatus,
} from '@/lib/utils/performance-indicators';

interface PerformanceHUDProps {
  fps: number | null;
  objectSyncLatencyMs: number | null;
  cursorSyncLatencyMs: number | null;
  zoomSpeedPercentPerSecond: number | null;
  panDragFps: number | null;
  aiPromptExecutionMs: number | null;
  objectCount: number;
  onlineUsers: number;
  yjsConnected: boolean;
  socketConnected: boolean;
}

function statusBadgeClass(status: MetricStatus): string {
  if (status === 'good') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status === 'warn') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export function PerformanceHUD({
  fps,
  objectSyncLatencyMs,
  cursorSyncLatencyMs,
  zoomSpeedPercentPerSecond,
  panDragFps,
  aiPromptExecutionMs,
  objectCount,
  onlineUsers,
  yjsConnected,
  socketConnected,
}: PerformanceHUDProps): React.ReactElement {
  const fpsStatus = classifyFpsStatus(fps);
  const objectSyncStatus = classifyLatencyStatus(
    objectSyncLatencyMs,
    PERFORMANCE_TARGETS.objectSyncLatencyMs,
  );
  const cursorSyncStatus = classifyLatencyStatus(
    cursorSyncLatencyMs,
    PERFORMANCE_TARGETS.cursorSyncLatencyMs,
  );
  const zoomSpeedStatus = classifyZoomSpeedStatus(zoomSpeedPercentPerSecond);
  const panDragFpsStatus = classifyPanDragFpsStatus(panDragFps);
  const aiPromptExecutionStatus = classifyAIPromptExecutionStatus(aiPromptExecutionMs);
  const capacityStatus = classifyCapacityStatus(objectCount);
  const concurrentUsersStatus = classifyConcurrentUsersStatus(onlineUsers);

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[340px] rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Performance Indicators</h3>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${yjsConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            Yjs
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            Socket
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Frame rate</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(fpsStatus)}`}>
            {formatFps(fps)} / {PERFORMANCE_TARGETS.frameRateFps} FPS
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Object sync latency</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(objectSyncStatus)}`}>
            {formatLatencyMs(objectSyncLatencyMs)} / &lt;{PERFORMANCE_TARGETS.objectSyncLatencyMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Cursor sync latency</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(cursorSyncStatus)}`}>
            {formatLatencyMs(cursorSyncLatencyMs)} / &lt;{PERFORMANCE_TARGETS.cursorSyncLatencyMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Zoom speed</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(zoomSpeedStatus)}`}>
            {formatZoomSpeed(zoomSpeedPercentPerSecond)} / {PERFORMANCE_TARGETS.zoomSpeedPercentPerSecond}+ %/s
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Pan drag FPS</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(panDragFpsStatus)}`}>
            {formatPanDragFps(panDragFps)} / {PERFORMANCE_TARGETS.panDragFps} FPS
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">AI prompt execution</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(aiPromptExecutionStatus)}`}>
            {formatAIPromptExecutionMs(aiPromptExecutionMs)} / &lt;{PERFORMANCE_TARGETS.aiPromptExecutionMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Object capacity</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(capacityStatus)}`}>
            {objectCount} / {PERFORMANCE_TARGETS.objectCapacity}+
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Concurrent users</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${statusBadgeClass(concurrentUsersStatus)}`}>
            {onlineUsers} / {PERFORMANCE_TARGETS.concurrentUsers}+
          </span>
        </div>
      </div>
    </div>
  );
}
