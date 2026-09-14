(() => {
  "use strict";

  if (window.__flowBatchProtocolObserver?.version) return;

  const VERSION = "1.0.0";
  const MAX_EVENTS = 1000;
  const events = [];

  function now() {
    return new Date().toISOString();
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), location.href);
      return { origin: url.origin, pathname: url.pathname, rpcids: url.searchParams.get("rpcids") || "" };
    } catch {
      return { origin: "", pathname: "", rpcids: "" };
    }
  }

  function valueShape(value, depth = 0) {
    if (depth > 7) return "max-depth";
    if (value === null) return "null";
    if (Array.isArray(value)) return { type: "array", length: value.length, samples: value.slice(0, 12).map((item) => valueShape(item, depth + 1)) };
    if (typeof value === "string") return /^[0-9a-f-]{36}$/i.test(value) ? "uuid" : { type: "string", length: value.length };
    if (typeof value === "object") return { type: "object", keys: Object.keys(value).slice(0, 30).sort() };
    return typeof value;
  }

  function requestShape(body) {
    if (typeof body !== "string") return valueShape(body);
    try {
      const params = new URLSearchParams(body), raw = params.get("f.req");
      if (!raw) return { type: "string", length: body.length };
      const envelope = JSON.parse(raw), calls = [];
      const visit = (value, depth = 0) => {
        if (!Array.isArray(value) || depth > 8) return;
        if (typeof value[0] === "string" && typeof value[1] === "string") {
          let argumentShape = { type: "string", length: value[1].length };
          try { argumentShape = valueShape(JSON.parse(value[1])); } catch {}
          calls.push({ rpc: value[0], argumentShape });
        }
        value.forEach((item) => visit(item, depth + 1));
      };
      visit(envelope);
      return { type: "batchexecute", parameterNames: [...params.keys()].sort(), calls };
    } catch {
      return { type: "string", length: body.length };
    }
  }

  function record(event) {
    events.push({ time: now(), ...event });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  }

  const xhrPrototype = XMLHttpRequest.prototype, nativeOpen = xhrPrototype.open, nativeSend = xhrPrototype.send;
  if (!xhrPrototype.__flowBatchProtocolObserver) {
    Object.defineProperty(xhrPrototype, "__flowBatchProtocolObserver", { value: VERSION, configurable: false });
    xhrPrototype.open = function (method, url) {
      this.__flowBatchObservedRequest = { method: String(method || "GET"), url: safeUrl(url) };
      return nativeOpen.apply(this, arguments);
    };
    xhrPrototype.send = function (body) {
      const request = this.__flowBatchObservedRequest || { method: "GET", url: { origin: "", pathname: "", rpcids: "" } };
      if (request.url.rpcids || /batchexecute|\/api\//i.test(request.url.pathname)) {
        const started = performance.now();
        record({ phase: "request", transport: "xhr", ...request, bodyShape: requestShape(body) });
        this.addEventListener("loadend", () => record({ phase: "response", transport: "xhr", ...request, status: Number(this.status) || 0, durationMs: Math.round(performance.now() - started), responseType: this.responseType || "text" }), { once: true });
      }
      return nativeSend.apply(this, arguments);
    };
  }

  const nativeFetch = window.fetch;
  if (!nativeFetch.__flowBatchProtocolObserver) {
    const observedFetch = async function (input, init) {
      const requestUrl = safeUrl(typeof input === "string" ? input : input?.url), shouldRecord = requestUrl.rpcids || /batchexecute|\/api\//i.test(requestUrl.pathname), method = String(init?.method || input?.method || "GET"), started = performance.now();
      if (shouldRecord) record({ phase: "request", transport: "fetch", method, url: requestUrl, bodyShape: requestShape(init?.body) });
      try {
        const response = await nativeFetch.apply(this, arguments);
        if (shouldRecord) record({ phase: "response", transport: "fetch", method, url: requestUrl, status: response.status, durationMs: Math.round(performance.now() - started) });
        return response;
      } catch (error) {
        if (shouldRecord) record({ phase: "error", transport: "fetch", method, url: requestUrl, durationMs: Math.round(performance.now() - started), errorName: error?.name || "Error" });
        throw error;
      }
    };
    Object.defineProperty(observedFetch, "__flowBatchProtocolObserver", { value: VERSION });
    window.fetch = observedFetch;
  }

  window.__flowBatchProtocolObserver = Object.freeze({
    version: VERSION,
    snapshot: () => events.map((event) => structuredClone(event)),
    clear: () => { events.length = 0; },
    export: () => ({ schemaVersion: 1, observerVersion: VERSION, capturedAt: now(), page: { origin: location.origin, pathname: location.pathname }, events: events.map((event) => structuredClone(event)) }),
  });

  const BRIDGE_ID = "flow-batch-protocol-sanitized-output";
  document.addEventListener("flow-batch-protocol-read", () => {
    let output = document.getElementById(BRIDGE_ID);
    if (!output) {
      output = document.createElement("script");
      output.type = "application/json";
      output.id = BRIDGE_ID;
      (document.documentElement || document).appendChild(output);
    }
    output.textContent = JSON.stringify(window.__flowBatchProtocolObserver.export());
    document.dispatchEvent(new Event("flow-batch-protocol-ready"));
  });
  document.addEventListener("flow-batch-protocol-clear", () => {
    window.__flowBatchProtocolObserver.clear();
    document.getElementById(BRIDGE_ID)?.remove();
  });
})();
