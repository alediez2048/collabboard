import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import {
  createTracedCompletion,
  finishCommandTrace,
  recordCommandTraceEvent,
  startCommandTrace,
} from '@/lib/ai-agent/tracing';

const langfuseState = vi.hoisted(() => ({
  trace: vi.fn(),
  generation: vi.fn(),
  shutdownAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('langfuse', () => {
  class MockLangfuse {
    trace = langfuseState.trace;

    shutdownAsync = langfuseState.shutdownAsync;
  }

  return { Langfuse: MockLangfuse };
});

const langsmithState = vi.hoisted(() => ({
  rootConfigs: [] as Array<Record<string, unknown>>,
  childConfigs: [] as Array<Record<string, unknown>>,
  postRun: vi.fn().mockResolvedValue(undefined),
  end: vi.fn().mockResolvedValue(undefined),
  patchRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('langsmith', () => {
  class MockRunNode {
    async postRun(): Promise<void> {
      await langsmithState.postRun();
    }

    async end(payload?: Record<string, unknown>): Promise<void> {
      await langsmithState.end(payload ?? {});
    }

    async patchRun(): Promise<void> {
      await langsmithState.patchRun();
    }

    async createChild(config: Record<string, unknown>): Promise<MockRunNode> {
      langsmithState.childConfigs.push(config);
      return new MockRunNode();
    }
  }

  class MockRunTree extends MockRunNode {
    constructor(config: Record<string, unknown>) {
      super();
      langsmithState.rootConfigs.push(config);
    }
  }

  return { RunTree: MockRunTree };
});

function makeCompletion(): ChatCompletion {
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: 'Done',
        },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  } as ChatCompletion;
}

function makeParams(): ChatCompletionCreateParamsNonStreaming {
  return {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'add one sticky note' }],
  };
}

function makeOpenAIClient(completion: ChatCompletion): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(completion),
      },
    },
  } as unknown as OpenAI;
}

function resetTracingEnv(): void {
  delete process.env.LANGFUSE_SECRET_KEY;
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_HOST;
  delete process.env.LANGSMITH_API_KEY;
  delete process.env.LANGSMITH_TRACING;
  delete process.env.LANGSMITH_PROJECT;
  delete process.env.LANGCHAIN_API_KEY;
  delete process.env.LANGCHAIN_TRACING_V2;
  delete process.env.LANGCHAIN_PROJECT;
}

describe('tracing adapter', () => {
  beforeEach(() => {
    resetTracingEnv();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    langfuseState.trace.mockImplementation(() => ({
      generation: langfuseState.generation,
    }));
    langsmithState.rootConfigs.length = 0;
    langsmithState.childConfigs.length = 0;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fan-out to sinks when tracing env vars are missing', async () => {
    const completion = makeCompletion();
    const client = makeOpenAIClient(completion);

    const result = await createTracedCompletion(client, makeParams(), 'ai-board-command');

    expect(result).toBe(completion);
    expect(langfuseState.trace).not.toHaveBeenCalled();
    expect(langsmithState.rootConfigs).toHaveLength(0);
  });

  it('captures completion metadata and fans out to Langfuse + LangSmith when both are enabled', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
    process.env.LANGFUSE_HOST = 'https://us.cloud.langfuse.com';
    process.env.LANGCHAIN_API_KEY = 'lsv2_test';
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_PROJECT = 'collabboard-ai';

    const context = startCommandTrace({
      traceName: 'ai-board-command',
      boardId: 'board-1',
      userId: 'user-1',
      command: 'add one sticky note',
    });
    const completion = makeCompletion();
    const client = makeOpenAIClient(completion);

    await createTracedCompletion(client, makeParams(), {
      traceName: 'ai-board-command',
      context,
      metadata: { routePhase: 'single-step' },
    });

    await finishCommandTrace(context, { success: true, metadata: { statusCode: 200 } });

    expect(langfuseState.trace).toHaveBeenCalled();
    expect(langfuseState.generation).toHaveBeenCalled();
    const generationCall = langfuseState.generation.mock.calls[0]?.[0] as {
      metadata?: Record<string, unknown>;
    };
    expect(generationCall?.metadata?.latencyMs).toEqual(expect.any(Number));
    expect(generationCall?.metadata?.estimatedCostUsd).toEqual(expect.any(Number));
    expect(generationCall?.metadata?.routePhase).toBe('single-step');

    expect(langsmithState.rootConfigs).toHaveLength(1);
    expect(langsmithState.childConfigs.length).toBeGreaterThan(0);
  });

  it('keeps command flow alive when tracing sinks throw', async () => {
    process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
    process.env.LANGFUSE_HOST = 'https://us.cloud.langfuse.com';
    process.env.LANGCHAIN_API_KEY = 'lsv2_test';
    process.env.LANGCHAIN_TRACING_V2 = 'true';

    langfuseState.trace.mockImplementation(() => {
      throw new Error('Langfuse unavailable');
    });
    langsmithState.postRun.mockRejectedValue(new Error('LangSmith unavailable'));

    const context = startCommandTrace({
      traceName: 'ai-board-command-error',
      boardId: 'board-1',
      userId: 'user-1',
      command: 'move missing object',
    });
    const completion = makeCompletion();
    const client = makeOpenAIClient(completion);

    await expect(
      createTracedCompletion(client, makeParams(), {
        traceName: 'ai-board-command',
        context,
      }),
    ).resolves.toBe(completion);

    await expect(
      recordCommandTraceEvent(context, 'executor-batch-fallback', { batchSize: 12 }),
    ).resolves.toBeUndefined();

    await expect(
      finishCommandTrace(context, { success: false, error: 'Bridge error' }),
    ).resolves.toBeUndefined();
  });
});
