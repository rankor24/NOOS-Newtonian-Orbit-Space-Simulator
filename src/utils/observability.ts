type ObservabilityKind = "log" | "metric" | "trace";
type ObservabilitySeverity = "debug" | "info" | "warn" | "error";
type AttrValue = string | number | boolean | null;

export interface ObservabilityEvent {
  schema: "boris.local.obs.event.v1";
  app: "newtonian-orbit-space-simulator";
  kind: ObservabilityKind;
  name: string;
  ts: string;
  severity?: ObservabilitySeverity;
  traceId?: string;
  spanId?: string;
  durationMs?: number;
  value?: number;
  unit?: string;
  attrs?: Record<string, AttrValue>;
}

interface BrowserObservabilityApi {
  event: (kind: ObservabilityKind, name: string, attrs?: Record<string, unknown>) => void;
  metric: (name: string, value: number, unit?: string, attrs?: Record<string, unknown>) => void;
  error: (name: string, error: unknown, attrs?: Record<string, unknown>) => void;
  recent: () => ObservabilityEvent[];
  flush: () => void;
}

// import.meta.env typing now comes from vite/client (src/vite-env.d.ts).
declare global {
  interface Window {
    __NEWTONIAN_OBS__?: BrowserObservabilityApi;
  }
}

const APP_NAME = "newtonian-orbit-space-simulator";
const SCHEMA = "boris.local.obs.event.v1";
const BUFFER_LIMIT = 200;
const FLUSH_INTERVAL_MS = 5000;
const MAX_ATTR_STRING = 180;

const endpoint = import.meta.env.VITE_OBS_ENDPOINT as string | undefined;
const buffer: ObservabilityEvent[] = [];
let sentIndex = 0;
let flushTimer: number | undefined;
let fpsFrames = 0;
let fpsStartedAt = performance.now();

function sanitizeAttrs(attrs: Record<string, unknown> = {}): Record<string, AttrValue> {
  const clean: Record<string, AttrValue> = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (/key|token|secret|password|auth|prompt|memory|content/i.test(key)) {
      clean[key] = "[redacted]";
      continue;
    }

    if (typeof value === "string") {
      clean[key] = value.length > MAX_ATTR_STRING ? `${value.slice(0, MAX_ATTR_STRING)}...` : value;
    } else if (typeof value === "number") {
      clean[key] = Number.isFinite(value) ? value : null;
    } else if (typeof value === "boolean") {
      clean[key] = value;
    } else if (value === null || value === undefined) {
      clean[key] = null;
    } else {
      clean[key] = String(value).slice(0, MAX_ATTR_STRING);
    }
  }

  return clean;
}

function push(event: ObservabilityEvent) {
  buffer.push(event);
  if (buffer.length > BUFFER_LIMIT) {
    const removed = buffer.length - BUFFER_LIMIT;
    buffer.splice(0, removed);
    sentIndex = Math.max(0, sentIndex - removed);
  }
}

function emit(event: Omit<ObservabilityEvent, "schema" | "app" | "ts">) {
  push({
    schema: SCHEMA,
    app: APP_NAME,
    ts: new Date().toISOString(),
    ...event,
  });
}

function send(events: ObservabilityEvent[]) {
  if (!endpoint || events.length === 0) return;

  const body = JSON.stringify(events);

  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    if (ok) return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function flushObservability() {
  const pending = buffer.slice(sentIndex);
  send(pending);
  sentIndex = buffer.length;
}

export function observeEvent(kind: ObservabilityKind, name: string, attrs?: Record<string, unknown>) {
  emit({ kind, name, severity: "info", attrs: sanitizeAttrs(attrs) });
}

export function observeMetric(name: string, value: number, unit?: string, attrs?: Record<string, unknown>) {
  emit({ kind: "metric", name, value, unit, attrs: sanitizeAttrs(attrs) });
}

export function observeError(name: string, error: unknown, attrs?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  emit({ kind: "log", name, severity: "error", attrs: sanitizeAttrs({ ...attrs, error: message }) });
}

export function observeFrame() {
  fpsFrames += 1;
  const now = performance.now();
  const elapsed = now - fpsStartedAt;

  if (elapsed >= 5000) {
    observeMetric("render.fps", Math.round((fpsFrames / elapsed) * 1000), "fps");
    fpsFrames = 0;
    fpsStartedAt = now;
  }
}

export function installBrowserObservability() {
  if (window.__NEWTONIAN_OBS__) return;

  window.__NEWTONIAN_OBS__ = {
    event: observeEvent,
    metric: observeMetric,
    error: observeError,
    recent: () => buffer.slice(),
    flush: flushObservability,
  };

  observeEvent("log", "app.boot", {
    endpointEnabled: Boolean(endpoint),
    userAgent: navigator.userAgent,
  });

  window.addEventListener("error", (event) => {
    observeError("browser.error", event.error ?? event.message, {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    observeError("browser.unhandled_rejection", event.reason);
  });

  window.addEventListener("beforeunload", flushObservability);

  flushTimer = window.setInterval(flushObservability, FLUSH_INTERVAL_MS);
}

export function uninstallBrowserObservability() {
  if (flushTimer !== undefined) window.clearInterval(flushTimer);
  flushTimer = undefined;
}
