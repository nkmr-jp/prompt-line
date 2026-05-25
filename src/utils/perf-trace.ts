import { logger } from './logger';
import { generateId } from './common';

const FORCE_TRACE = process.env.PROMPT_LINE_PERF_TRACE === '1';

// In packaged builds the logger writes to ~/.prompt-line/app.log on every call;
// route traces through debug() so they only land in the log when the user
// opts in (LOG_LEVEL=debug via `pnpm start`, or PROMPT_LINE_PERF_TRACE=1).
export function emitPerfTrace(name: string, event: Record<string, unknown>): void {
  if (FORCE_TRACE) {
    logger.info(name, event);
  } else {
    logger.debug(name, event);
  }
}

export interface PerfTrace {
  id: string;
  start: number;
  marks: Record<string, number>;
  flags: Record<string, unknown>;
}

export function startTrace(): PerfTrace {
  return {
    id: generateId(),
    start: performance.now(),
    marks: {},
    flags: {},
  };
}

export function mark(trace: PerfTrace | undefined, label: string): void {
  if (!trace) return;
  trace.marks[label] = +(performance.now() - trace.start).toFixed(2);
}

export function setFlag(trace: PerfTrace | undefined, key: string, value: unknown): void {
  if (!trace) return;
  trace.flags[key] = value;
}

export function flushShowTrace(trace: PerfTrace, payload: Record<string, unknown> = {}): void {
  const total = +(performance.now() - trace.start).toFixed(2);
  emitPerfTrace('show-window-trace', {
    traceId: trace.id,
    total,
    marks: trace.marks,
    flags: trace.flags,
    ...payload,
  });
}

export interface BackgroundTrace {
  id: string;
  start: number;
  source: string;
}

export function startBackground(source: string): BackgroundTrace {
  return { id: generateId(), start: performance.now(), source };
}

export function flushBackground(bg: BackgroundTrace, payload: Record<string, unknown> = {}): void {
  const ms = +(performance.now() - bg.start).toFixed(2);
  emitPerfTrace('background-trace', {
    traceId: bg.id,
    source: bg.source,
    ms,
    ...payload,
  });
}

export interface NativeCallTrace {
  id: string;
  start: number;
  tool: string;
}

export function startNative(tool: string): NativeCallTrace {
  return { id: generateId(), start: performance.now(), tool };
}

export function flushNative(nt: NativeCallTrace, payload: Record<string, unknown> = {}): void {
  const ms = +(performance.now() - nt.start).toFixed(2);
  emitPerfTrace('native-call-trace', {
    traceId: nt.id,
    tool: nt.tool,
    ms,
    ...payload,
  });
}
