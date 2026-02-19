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

export interface TraceRecord {
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

// GPT-4o-mini pricing (per 1K tokens, as of early 2026)
const COST_PER_1K_INPUT = 0.00015;
const COST_PER_1K_OUTPUT = 0.0006;

function estimateCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1000) * COST_PER_1K_INPUT +
    (completionTokens / 1000) * COST_PER_1K_OUTPUT
  );
}

function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY &&
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_HOST,
  );
}

async function sendLangfuseTrace(
  name: string,
  input: ChatCompletionCreateParamsNonStreaming,
  output: ChatCompletion,
  trace: TraceRecord,
): Promise<void> {
  try {
    const { Langfuse } = await import('langfuse');
    const lf = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_HOST!,
    });

    const traceObj = lf.trace({ name });
    traceObj.generation({
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
      },
    });

    await lf.shutdownAsync();
  } catch (err) {
    // Never break the request flow due to tracing failure
    console.error('[Tracing] Langfuse error:', err);
  }
}

/**
 * Wrap an OpenAI chat completion call with timing + tracing.
 * Ported pattern from langfuse_demo.py @observe() decorator.
 */
export async function createTracedCompletion(
  client: OpenAI,
  params: ChatCompletionCreateParamsNonStreaming,
  traceName = 'ai-command',
): Promise<ChatCompletion> {
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

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[AI] ${traceName} | ${latencyMs}ms | ${totalTokens} tokens | $${estimatedCostUsd.toFixed(6)}`);
  }

  if (isLangfuseConfigured()) {
    await sendLangfuseTrace(traceName, params, completion, traceRecord);
  }

  return completion;
}
