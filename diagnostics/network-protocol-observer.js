const STORAGE_KEY = "flowBatchSanitizedNetworkEvents";
const MAX_EVENTS = 1000;
const pending = new Map();

function safeUrl(value) {
  try {
    const url = new URL(value);
    const pathname = /^\/asb\//.test(url.pathname) ? "/asb/<redacted>" : url.pathname;
    return { origin: url.origin, pathname, rpcids: url.searchParams.get("rpcids") || "" };
  } catch {
    return { origin: "", pathname: "", rpcids: "" };
  }
}

function shape(value, depth = 0) {
  if (depth > 7) return "max-depth";
  if (value === null) return "null";
  if (Array.isArray(value)) return { type: "array", length: value.length, samples: value.slice(0, 12).map((item) => shape(item, depth + 1)) };
  if (typeof value === "string") return /^[0-9a-f-]{36}$/i.test(value) ? "uuid" : { type: "string", length: value.length };
  if (typeof value === "object") return { type: "object", keys: Object.keys(value).slice(0, 30).sort() };
  return typeof value;
}

function requestBodyShape(requestBody) {
  const form = requestBody?.formData;
  if (form) {
    const names = Object.keys(form).sort();
    const raw = form["f.req"]?.[0];
    if (typeof raw === "string") {
      try {
        const envelope = JSON.parse(raw);
        const calls = [];
        const visit = (value, depth = 0) => {
          if (!Array.isArray(value) || depth > 8) return;
          if (typeof value[0] === "string" && typeof value[1] === "string") {
            let argumentShape = { type: "string", length: value[1].length };
            try { argumentShape = shape(JSON.parse(value[1])); } catch {}
            calls.push({ rpc: value[0], argumentShape });
          }
          value.forEach((item) => visit(item, depth + 1));
        };
        visit(envelope);
        return { type: "batchexecute", parameterNames: names, calls };
      } catch {}
    }
    return { type: "form", parameterNames: names };
  }
  const bytes = (requestBody?.raw || []).reduce((sum, part) => sum + (part.bytes?.byteLength || 0), 0);
  return bytes ? { type: "raw", byteLength: bytes } : "undefined";
}

async function append(event) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const events = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  events.push({ time: new Date().toISOString(), ...event });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  await chrome.storage.local.set({ [STORAGE_KEY]: events });
}

chrome.webRequest.onBeforeRequest.addListener((details) => {
  const url = safeUrl(details.url);
  const started = Date.now();
  pending.set(details.requestId, { started, method: details.method, url });
  void append({ phase: "request", transport: "webRequest", method: details.method, url, bodyShape: requestBodyShape(details.requestBody) });
}, { urls: ["https://flow.google.com/*", "https://*.googleapis.com/*"] }, ["requestBody"]);

chrome.webRequest.onCompleted.addListener((details) => {
  const request = pending.get(details.requestId);
  pending.delete(details.requestId);
  void append({ phase: "response", transport: "webRequest", method: details.method, url: safeUrl(details.url), status: details.statusCode, durationMs: request ? Date.now() - request.started : undefined });
}, { urls: ["https://flow.google.com/*", "https://*.googleapis.com/*"] });

chrome.webRequest.onErrorOccurred.addListener((details) => {
  const request = pending.get(details.requestId);
  pending.delete(details.requestId);
  void append({ phase: "error", transport: "webRequest", method: details.method, url: safeUrl(details.url), error: details.error, durationMs: request ? Date.now() - request.started : undefined });
}, { urls: ["https://flow.google.com/*", "https://*.googleapis.com/*"] });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FLOW_BATCH_READ_SANITIZED_NETWORK") {
    chrome.storage.local.get(STORAGE_KEY).then((stored) => sendResponse({ events: stored[STORAGE_KEY] || [] }));
    return true;
  }
  if (message?.type === "FLOW_BATCH_CLEAR_SANITIZED_NETWORK") {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }
});
