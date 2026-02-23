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
    return 'bg-[var(--nb-accent-green)] text-black border-black';
  }
  if (status === 'warn') {
    return 'bg-[var(--nb-accent-orange)] text-black border-black';
  }
  return 'bg-white text-black border-black';
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
    <div className="absolute bottom-4 left-4 z-10 w-[340px] rounded-lg border-2 border-black bg-white p-3 shadow-[4px_4px_0px_#000]" style={{ fontFamily: 'var(--font-space-mono), monospace' }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-black">Performance Indicators</h3>
        <div className="flex items-center gap-2 text-[11px] font-bold text-black">
          <span className="inline-flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full border-2 border-black ${yjsConnected ? 'bg-[var(--nb-accent-green)]' : 'bg-white'}`} />
            Yjs
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full border-2 border-black ${socketConnected ? 'bg-[var(--nb-accent-green)]' : 'bg-white'}`} />
            Socket
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Frame rate</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(fpsStatus)}`}>
            {formatFps(fps)} / {PERFORMANCE_TARGETS.frameRateFps} FPS
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Object sync latency</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(objectSyncStatus)}`}>
            {formatLatencyMs(objectSyncLatencyMs)} / &lt;{PERFORMANCE_TARGETS.objectSyncLatencyMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Cursor sync latency</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(cursorSyncStatus)}`}>
            {formatLatencyMs(cursorSyncLatencyMs)} / &lt;{PERFORMANCE_TARGETS.cursorSyncLatencyMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Zoom speed</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(zoomSpeedStatus)}`}>
            {formatZoomSpeed(zoomSpeedPercentPerSecond)} / {PERFORMANCE_TARGETS.zoomSpeedPercentPerSecond}+ %/s
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Pan drag FPS</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(panDragFpsStatus)}`}>
            {formatPanDragFps(panDragFps)} / {PERFORMANCE_TARGETS.panDragFps} FPS
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">AI prompt execution</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(aiPromptExecutionStatus)}`}>
            {formatAIPromptExecutionMs(aiPromptExecutionMs)} / &lt;{PERFORMANCE_TARGETS.aiPromptExecutionMs}ms
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Object capacity</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(capacityStatus)}`}>
            {objectCount} / {PERFORMANCE_TARGETS.objectCapacity}+
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-black">Concurrent users</span>
          <span className={`rounded-md border-2 px-1.5 py-0.5 font-bold ${statusBadgeClass(concurrentUsersStatus)}`}>
            {onlineUsers} / {PERFORMANCE_TARGETS.concurrentUsers}+
          </span>
        </div>
      </div>
    </div>
  );
}
