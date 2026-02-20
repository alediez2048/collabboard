import { describe, expect, it } from 'vitest';
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
} from '@/lib/utils/performance-indicators';

describe('performance indicator helpers', () => {
  it('classifies FPS relative to target', () => {
    expect(classifyFpsStatus(null)).toBe('unknown');
    expect(classifyFpsStatus(55)).toBe('warn');
    expect(classifyFpsStatus(PERFORMANCE_TARGETS.frameRateFps)).toBe('good');
  });

  it('classifies latency relative to max target', () => {
    expect(classifyLatencyStatus(null, PERFORMANCE_TARGETS.objectSyncLatencyMs)).toBe('unknown');
    expect(classifyLatencyStatus(140, PERFORMANCE_TARGETS.objectSyncLatencyMs)).toBe('warn');
    expect(classifyLatencyStatus(70, PERFORMANCE_TARGETS.objectSyncLatencyMs)).toBe('good');
  });

  it('classifies capacity and concurrent users against minimum targets', () => {
    expect(classifyCapacityStatus(200)).toBe('warn');
    expect(classifyCapacityStatus(500)).toBe('good');

    expect(classifyConcurrentUsersStatus(3)).toBe('warn');
    expect(classifyConcurrentUsersStatus(5)).toBe('good');
  });

  it('formats FPS and latency values', () => {
    expect(formatFps(null)).toBe('—');
    expect(formatFps(59.6)).toBe('60 FPS');
    expect(formatLatencyMs(null)).toBe('—');
    expect(formatLatencyMs(12.345)).toBe('12.3 ms');
  });

  it('classifies zoom speed relative to responsiveness target', () => {
    expect(classifyZoomSpeedStatus(null)).toBe('unknown');
    expect(classifyZoomSpeedStatus(PERFORMANCE_TARGETS.zoomSpeedPercentPerSecond - 5)).toBe('warn');
    expect(classifyZoomSpeedStatus(PERFORMANCE_TARGETS.zoomSpeedPercentPerSecond)).toBe('good');
  });

  it('formats zoom speed values for HUD display', () => {
    expect(formatZoomSpeed(null)).toBe('—');
    expect(formatZoomSpeed(123.45)).toBe('123.5 %/s');
  });

  it('classifies AI prompt execution speed relative to target', () => {
    expect(classifyAIPromptExecutionStatus(null)).toBe('unknown');
    expect(classifyAIPromptExecutionStatus(PERFORMANCE_TARGETS.aiPromptExecutionMs - 500)).toBe('good');
    expect(classifyAIPromptExecutionStatus(PERFORMANCE_TARGETS.aiPromptExecutionMs + 500)).toBe('warn');
  });

  it('formats AI prompt execution latency', () => {
    expect(formatAIPromptExecutionMs(null)).toBe('—');
    expect(formatAIPromptExecutionMs(987.65)).toBe('987.6 ms');
  });

  it('classifies pan drag fps relative to responsiveness target', () => {
    expect(classifyPanDragFpsStatus(null)).toBe('unknown');
    expect(classifyPanDragFpsStatus(PERFORMANCE_TARGETS.panDragFps - 1)).toBe('warn');
    expect(classifyPanDragFpsStatus(PERFORMANCE_TARGETS.panDragFps)).toBe('good');
  });

  it('formats pan drag fps values', () => {
    expect(formatPanDragFps(null)).toBe('—');
    expect(formatPanDragFps(47.6)).toBe('48 FPS');
  });
});
