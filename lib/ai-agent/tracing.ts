/**
 * Tracing adapter — ported from 1.3-langsmith-langfuse-main reference patterns.
 *
 * Reference:
 *   - langfuse_demo.py: @observe() decorator + from langfuse.openai import openai
 *   - langsmith_demo.py: wrap_openai() + @traceable decorator
 *   - .env.sample: OPENAI_API_KEY, LANGCHAIN_API_KEY, LANGFUSE_SECRET_KEY etc.
 *
 * This adapter:
 *   1. Wraps an OpenAI chat.completions.create call.
 *   2. Captures prompt, response, latency, token usage, and estimated cost.
 *   3. Sends a trace to Langfuse when env vars are present.
 *   4. Degrades gracefully when no tracing platform is configured.
 */

import type OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletion } from 'openai/resources/chat/completions';

export type CommandExecutionPath = 'unknown' | 'deterministic-planner' | 'llm-single-step' | 'llm-followup';

export interface TraceRecord {
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface TraceEventRecord {
  name: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

interface LangSmithRunLike {
  postRun: () => Promise<unknown>;
  createChild: (config: Record<string, unknown>) => Promise<unknown> | unknown;
  end: (payload?: Record<string, unknown>) => Promise<unknown>;
  patchRun: () => Promise<unknown>;
}

interface CreateTracedCompletionOptions {
  traceName?: string;
  context?: CommandTraceContext;
  metadata?: Record<string, unknown>;
}

interface FinishTraceOptions {
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CommandTraceContext {
  traceId: string;
  traceName: string;
  boardId: string;
  userId: string;
  command: string;
  startedAtMs: number;
  executionPath: CommandExecutionPath;
  events: TraceEventRecord[];
  langsmithReady: Promise<void>;
  langsmithRootRun: LangSmithRunLike | null;
  isFinalized: boolean;
}

// GPT-4o-mini pricing (per 1K tokens, as of early 2026)
const COST_PER_1K_INPUT = 0.00015;
const COST_PER_1K_OUTPUT = 0.0006;
const TRACE_SINK_TIMEOUT_MS = 750;

function estimateCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1000) * COST_PER_1K_INPUT +
    (completionTokens / 1000) * COST_PER_1K_OUTPUT
  );
}

async function waitWithTimeout(
  task: Promise<unknown>,
  timeoutMs: number,
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve();
    }, timeoutMs);
  });

  await Promise.race([
    task.then(() => undefined),
    timeoutPromise,
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
}

function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY &&
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_HOST,
  );
}

function getLangSmithApiKey(): string {
  return process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY ?? '';
}

function getLangSmithEndpoint(): string | undefined {
  return process.env.LANGSMITH_ENDPOINT ?? process.env.LANGCHAIN_ENDPOINT;
}

function getLangSmithProject(): string {
  return process.env.LANGSMITH_PROJECT ?? process.env.LANGCHAIN_PROJECT ?? 'collabboard-ai';
}

function isLangSmithTracingEnabled(): boolean {
  const raw = process.env.LANGSMITH_TRACING ?? process.env.LANGCHAIN_TRACING_V2 ?? '';
  return raw.toLowerCase() === 'true' || raw === '1';
}

function isLangSmithConfigured(): boolean {
  return isLangSmithTracingEnabled() && getLangSmithApiKey().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface LangfuseTraceWriter {
  generation?: (payload: Record<string, unknown>) => unknown;
  event?: (payload: Record<string, unknown>) => unknown;
}

function asLangfuseTraceWriter(target: unknown): LangfuseTraceWriter | null {
  if (!isRecord(target)) return null;
  return target as LangfuseTraceWriter;
}

function isLangSmithRunLike(value: unknown): value is LangSmithRunLike {
  if (!isRecord(value)) return false;
  return (
    typeof value.postRun === 'function'
    && typeof value.createChild === 'function'
    && typeof value.end === 'function'
    && typeof value.patchRun === 'function'
  );
}

async function sendLangfuseGeneration(
  name: string,
  input: ChatCompletionCreateParamsNonStreaming,
  output: ChatCompletion,
  trace: TraceRecord,
  metadata: Record<string, unknown>,
  context?: CommandTraceContext,
): Promise<void> {
  if (!isLangfuseConfigured()) return;

  try {
    const { Langfuse } = await import('langfuse');
    const lf = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_HOST!,
    });

    const traceConfig: Record<string, unknown> = { name };
    if (context) {
      traceConfig.id = context.traceId;
      traceConfig.userId = context.userId;
      traceConfig.sessionId = context.boardId;
    }

    const traceObj = asLangfuseTraceWriter(lf.trace(traceConfig));
    if (traceObj?.generation) {
      await Promise.resolve(traceObj.generation({
        name,
        model: input.model,
        input: input.messages,
        output: output.choices[0]?.message ?? null,
        usage: {
          input: trace.promptTokens,
          output: trace.completionTokens,
          total: trace.totalTokens,
          unit: 'TOKENS',
        },
        metadata: {
          latencyMs: trace.latencyMs,
          estimatedCostUsd: trace.estimatedCostUsd,
          ...metadata,
        },
      }));
    }

    await lf.shutdownAsync();
  } catch (err) {
    // Never break command flow due to tracing sink failures.
    console.error('[Tracing] Langfuse completion error:', err);
  }
}

async function sendLangfuseEvent(
  context: CommandTraceContext,
  event: TraceEventRecord,
): Promise<void> {
  if (!isLangfuseConfigured()) return;

  try {
    const { Langfuse } = await import('langfuse');
    const lf = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_HOST!,
    });

    const traceObj = asLangfuseTraceWriter(lf.trace({
      id: context.traceId,
      name: context.traceName,
      userId: context.userId,
      sessionId: context.boardId,
    }));
    if (traceObj?.event) {
      await Promise.resolve(traceObj.event({
        name: event.name,
        input: event.metadata,
        metadata: {
          executionPath: context.executionPath,
          timestamp: event.timestamp,
        },
      }));
    } else if (traceObj?.generation) {
      await Promise.resolve(traceObj.generation({
        name: event.name,
        model: 'event',
        input: event.metadata,
        output: null,
        metadata: {
          executionPath: context.executionPath,
          timestamp: event.timestamp,
        },
      }));
    }

    await lf.shutdownAsync();
  } catch (err) {
    console.error('[Tracing] Langfuse event error:', err);
  }
}

async function createLangSmithRun(
  config: Record<string, unknown>,
): Promise<LangSmithRunLike | null> {
  try {
    const imported = await import('langsmith');
    const maybeCtor = (imported as Record<string, unknown>).RunTree;
    if (typeof maybeCtor !== 'function') {
      return null;
    }

    const run = new (maybeCtor as new (runConfig: Record<string, unknown>) => unknown)(config);
    return isLangSmithRunLike(run) ? run : null;
  } catch (err) {
    console.error('[Tracing] LangSmith run creation error:', err);
    return null;
  }
}

async function initializeLangSmithRootRun(context: CommandTraceContext): Promise<void> {
  if (!isLangSmithConfigured()) return;

  const rootConfig: Record<string, unknown> = {
    id: context.traceId,
    name: context.traceName,
    run_type: 'chain',
    inputs: {
      command: context.command,
      boardId: context.boardId,
      userId: context.userId,
    },
    project_name: getLangSmithProject(),
    extra: {
      executionPath: context.executionPath,
      traceId: context.traceId,
    },
  };
  const endpoint = getLangSmithEndpoint();
  if (endpoint) {
    rootConfig.apiUrl = endpoint;
  }
  const apiKey = getLangSmithApiKey();
  if (apiKey.length > 0) {
    rootConfig.apiKey = apiKey;
  }

  const rootRun = await createLangSmithRun(rootConfig);
  if (!rootRun) return;

  try {
    await rootRun.postRun();
    context.langsmithRootRun = rootRun;
  } catch (err) {
    console.error('[Tracing] LangSmith root postRun error:', err);
  }
}

async function createLangSmithChildRun(
  parent: LangSmithRunLike,
  config: Record<string, unknown>,
): Promise<LangSmithRunLike | null> {
  try {
    const childUnknown = await Promise.resolve(parent.createChild(config));
    return isLangSmithRunLike(childUnknown) ? childUnknown : null;
  } catch (err) {
    console.error('[Tracing] LangSmith createChild error:', err);
    return null;
  }
}

async function sendLangSmithEvent(
  context: CommandTraceContext,
  event: TraceEventRecord,
): Promise<void> {
  if (!isLangSmithConfigured()) return;

  await context.langsmithReady;
  if (!context.langsmithRootRun) return;

  const child = await createLangSmithChildRun(context.langsmithRootRun, {
    name: event.name,
    run_type: 'tool',
    inputs: event.metadata,
    tags: [context.executionPath, 'ai-command-event'],
    extra: {
      traceId: context.traceId,
      boardId: context.boardId,
      userId: context.userId,
      timestamp: event.timestamp,
    },
  });
  if (!child) return;

  try {
    await child.postRun();
    await child.end({ outputs: event.metadata });
    await child.patchRun();
  } catch (err) {
    console.error('[Tracing] LangSmith event error:', err);
  }
}

async function sendLangSmithCompletion(
  name: string,
  input: ChatCompletionCreateParamsNonStreaming,
  output: ChatCompletion,
  trace: TraceRecord,
  metadata: Record<string, unknown>,
  context?: CommandTraceContext,
): Promise<void> {
  if (!isLangSmithConfigured()) return;

  const outputMessage = output.choices[0]?.message ?? null;
  const completionConfig: Record<string, unknown> = {
    name,
    run_type: 'llm',
    inputs: {
      model: input.model,
      messages: input.messages,
    },
    tags: ['ai-command-llm'],
    extra: {
      traceId: context?.traceId ?? null,
      latencyMs: trace.latencyMs,
      promptTokens: trace.promptTokens,
      completionTokens: trace.completionTokens,
      totalTokens: trace.totalTokens,
      estimatedCostUsd: trace.estimatedCostUsd,
      ...metadata,
    },
  };

  let targetRun: LangSmithRunLike | null = null;
  if (context) {
    await context.langsmithReady;
    if (context.langsmithRootRun) {
      targetRun = await createLangSmithChildRun(context.langsmithRootRun, completionConfig);
    }
  }

  if (!targetRun) {
    const standaloneConfig: Record<string, unknown> = {
      ...completionConfig,
      id: context?.traceId ? `${context.traceId}-${name}-${Date.now()}` : crypto.randomUUID(),
      project_name: getLangSmithProject(),
    };
    const endpoint = getLangSmithEndpoint();
    if (endpoint) {
      standaloneConfig.apiUrl = endpoint;
    }
    const apiKey = getLangSmithApiKey();
    if (apiKey.length > 0) {
      standaloneConfig.apiKey = apiKey;
    }
    targetRun = await createLangSmithRun(standaloneConfig);
  }

  if (!targetRun) return;

  try {
    await targetRun.postRun();
    await targetRun.end({
      outputs: {
        message: outputMessage,
        usage: {
          promptTokens: trace.promptTokens,
          completionTokens: trace.completionTokens,
          totalTokens: trace.totalTokens,
          estimatedCostUsd: trace.estimatedCostUsd,
        },
      },
    });
    await targetRun.patchRun();
  } catch (err) {
    console.error('[Tracing] LangSmith completion error:', err);
  }
}

async function finalizeLangSmithRootRun(
  context: CommandTraceContext,
  finish: FinishTraceOptions,
  totalLatencyMs: number,
): Promise<void> {
  if (!isLangSmithConfigured()) return;

  await context.langsmithReady;
  if (!context.langsmithRootRun) return;

  try {
    await context.langsmithRootRun.end({
      outputs: {
        success: finish.success,
        totalLatencyMs,
        executionPath: context.executionPath,
        eventCount: context.events.length,
        ...(finish.metadata ?? {}),
      },
      ...(finish.error ? { error: finish.error } : {}),
    });
    await context.langsmithRootRun.patchRun();
  } catch (err) {
    console.error('[Tracing] LangSmith finalize error:', err);
  }
}

function toCompletionOptions(
  traceNameOrOptions: string | CreateTracedCompletionOptions | undefined,
): Required<Pick<CreateTracedCompletionOptions, 'traceName'>> & Omit<CreateTracedCompletionOptions, 'traceName'> {
  if (typeof traceNameOrOptions === 'string') {
    return { traceName: traceNameOrOptions };
  }

  return {
    traceName: traceNameOrOptions?.traceName ?? 'ai-command',
    context: traceNameOrOptions?.context,
    metadata: traceNameOrOptions?.metadata,
  };
}

export function startCommandTrace(input: {
  traceName: string;
  boardId: string;
  userId: string;
  command: string;
  executionPath?: CommandExecutionPath;
}): CommandTraceContext {
  const context: CommandTraceContext = {
    traceId: crypto.randomUUID(),
    traceName: input.traceName,
    boardId: input.boardId,
    userId: input.userId,
    command: input.command,
    startedAtMs: Date.now(),
    executionPath: input.executionPath ?? 'unknown',
    events: [],
    langsmithReady: Promise.resolve(),
    langsmithRootRun: null,
    isFinalized: false,
  };

  context.langsmithReady = initializeLangSmithRootRun(context);
  return context;
}

export function setCommandTraceExecutionPath(
  context: CommandTraceContext,
  executionPath: CommandExecutionPath,
): void {
  context.executionPath = executionPath;
}

export async function recordCommandTraceEvent(
  context: CommandTraceContext,
  name: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const event: TraceEventRecord = {
    name,
    metadata,
    timestamp: new Date().toISOString(),
  };
  context.events.push(event);

  await Promise.all([
    waitWithTimeout(sendLangfuseEvent(context, event), TRACE_SINK_TIMEOUT_MS),
    waitWithTimeout(sendLangSmithEvent(context, event), TRACE_SINK_TIMEOUT_MS),
  ]);
}

export async function finishCommandTrace(
  context: CommandTraceContext,
  finish: FinishTraceOptions,
): Promise<void> {
  if (context.isFinalized) return;
  context.isFinalized = true;

  const totalLatencyMs = Date.now() - context.startedAtMs;
  const finishMetadata: Record<string, unknown> = {
    totalLatencyMs,
    executionPath: context.executionPath,
    success: finish.success,
    ...(finish.metadata ?? {}),
  };
  if (finish.error) {
    finishMetadata.error = finish.error;
  }

  await recordCommandTraceEvent(context, 'route-finish', finishMetadata);
  await finalizeLangSmithRootRun(context, finish, totalLatencyMs);
}

/**
 * Wrap an OpenAI chat completion call with timing + tracing.
 * Ported pattern from langfuse_demo.py @observe() decorator.
 */
export async function createTracedCompletion(
  client: OpenAI,
  params: ChatCompletionCreateParamsNonStreaming,
  traceNameOrOptions: string | CreateTracedCompletionOptions = 'ai-command',
): Promise<ChatCompletion> {
  const options = toCompletionOptions(traceNameOrOptions);
  const traceName = options.traceName;

  const start = Date.now();
  const completion = await client.chat.completions.create(params);
  const latencyMs = Date.now() - start;

  const usage = completion.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? 0;
  const estimatedCostUsd = estimateCost(promptTokens, completionTokens);

  const traceRecord: TraceRecord = {
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
  };
  const sinkMetadata: Record<string, unknown> = {
    executionPath: options.context?.executionPath ?? 'unknown',
    traceId: options.context?.traceId ?? null,
    ...(options.metadata ?? {}),
  };

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[AI] ${traceName} | ${latencyMs}ms | ${totalTokens} tokens | $${estimatedCostUsd.toFixed(6)}`);
  }

  await Promise.all([
    waitWithTimeout(
      sendLangfuseGeneration(traceName, params, completion, traceRecord, sinkMetadata, options.context),
      TRACE_SINK_TIMEOUT_MS,
    ),
    waitWithTimeout(
      sendLangSmithCompletion(traceName, params, completion, traceRecord, sinkMetadata, options.context),
      TRACE_SINK_TIMEOUT_MS,
    ),
    options.context
      ? recordCommandTraceEvent(options.context, 'llm-completion', {
        traceName,
        model: params.model,
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      })
      : Promise.resolve(),
  ]);

  return completion;
}
