'use client';

import { useState, useRef, type KeyboardEvent, type ReactElement } from 'react';

interface AICommandViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AICommandContext {
  selectedObjectIds?: string[];
  viewport?: AICommandViewport;
}

interface AICommandBarProps {
  boardId: string;
  requestContext?: AICommandContext;
  onCommandMetrics?: (metrics: {
    elapsedMs: number;
    success: boolean;
    objectsAffected: number;
  }) => void;
  onApplyInlineObjects?: (objects: Array<Record<string, unknown>>) => void;
}

type CommandStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActionRecord {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

interface CommandResponse {
  success: boolean;
  actions: ActionRecord[];
  objectsAffected: string[];
  inlineCreatedObjects?: Array<Record<string, unknown>>;
  error?: string;
}

function pluralise(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function buildSuccessMessage(response: CommandResponse): string {
  const count = response.objectsAffected.length;
  if (response.actions.length === 0) {
    return 'I can only help with board actions — try asking me to add a note or shape.';
  }
  if (count === 0) {
    return 'Done — no board objects were changed.';
  }
  const tools = [...new Set(response.actions.map((a) => a.tool))];
  return `Done — ${pluralise(count, 'object')} updated via: ${tools.join(', ')}.`;
}

export function AICommandBar({ boardId, requestContext, onCommandMetrics, onApplyInlineObjects }: AICommandBarProps): ReactElement {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<CommandStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function submitCommand(): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed || status === 'loading') return;
    const startedAt = performance.now();

    setStatus('loading');
    setStatusMessage('');

    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          command: trimmed,
          ...(requestContext ? { context: requestContext } : {}),
        }),
      });

      const data = (await res.json()) as CommandResponse;

      if (!res.ok) {
        setStatus('error');
        setStatusMessage(data.error ?? `Server error (${res.status})`);
        onCommandMetrics?.({
          elapsedMs: performance.now() - startedAt,
          success: false,
          objectsAffected: 0,
        });
        return;
      }

      if (!data.success) {
        setStatus('error');
        setStatusMessage(data.error ?? 'The action could not be completed.');
        onCommandMetrics?.({
          elapsedMs: performance.now() - startedAt,
          success: false,
          objectsAffected: data.objectsAffected.length,
        });
        return;
      }

      setStatus('success');
      setStatusMessage(buildSuccessMessage(data));
      if (data.inlineCreatedObjects?.length && onApplyInlineObjects) {
        onApplyInlineObjects(data.inlineCreatedObjects);
      }
      onCommandMetrics?.({
        elapsedMs: performance.now() - startedAt,
        success: true,
        objectsAffected: data.objectsAffected.length,
      });
      setCommand('');
    } catch {
      setStatus('error');
      setStatusMessage('Network error — please try again.');
      onCommandMetrics?.({
        elapsedMs: performance.now() - startedAt,
        success: false,
        objectsAffected: 0,
      });
    } finally {
      // Keep the status message visible briefly, then reset to idle
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 4000);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      void submitCommand();
    }
    if (e.key === 'Escape') {
      setCommand('');
      setStatus('idle');
      setStatusMessage('');
      inputRef.current?.blur();
    }
  }

  const isLoading = status === 'loading';

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4"
      data-testid="ai-command-bar"
    >
      {/* Status message */}
      {statusMessage && (
        <div
          className={`mb-2 rounded-lg border-2 border-black px-3 py-2 text-sm text-center font-bold shadow-[3px_3px_0px_#000] transition-all ${
            status === 'error'
              ? 'bg-[var(--nb-accent-red)] text-black'
              : 'bg-[var(--nb-accent-green)] text-black'
          }`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 rounded-lg border-[3px] border-black bg-white px-4 py-2 shadow-[6px_6px_0px_#000]">
        {/* Sparkle icon */}
        <svg
          className={`h-5 w-5 shrink-0 ${isLoading ? 'animate-spin text-[var(--nb-accent-purple)]' : 'text-[var(--nb-accent-purple)]'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm4.22 1.78a.75.75 0 011.06 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06zM17.25 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zM15.28 15.28a.75.75 0 01-1.06 0l-1.06-1.06a.75.75 0 011.06-1.06l1.06 1.06a.75.75 0 010 1.06zM10 16.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zm-4.22-1.47a.75.75 0 011.06 1.06L5.78 16.9a.75.75 0 01-1.06-1.06l1.06-1.06zm-2.03-5.03H2.25a.75.75 0 010-1.5h1.5a.75.75 0 010 1.5zm1.47-4.75a.75.75 0 010 1.06L4.16 7.12A.75.75 0 013.1 6.06l1.06-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6z"
            clipRule="evenodd"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent text-sm font-medium text-black placeholder-[var(--nb-text-muted)] outline-none font-[var(--font-space-mono)]"
          placeholder="Ask AI to add a note, draw a shape, move objects…"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="AI board command"
          maxLength={500}
        />

        <button
          onClick={() => void submitCommand()}
          disabled={isLoading || !command.trim()}
          className="nb-btn shrink-0 px-4 py-1.5 text-xs font-bold uppercase text-black bg-[var(--nb-accent-purple)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send AI command"
        >
          {isLoading ? '…' : 'SEND'}
        </button>
      </div>
    </div>
  );
}
