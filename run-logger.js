(async function () {
  "use strict";
  if (window.__flowBatchRunLogger) return;

  const VERSION = "3.0.30";
  const MAX_EVENTS = 500;
  const PERSIST_DELAY_MS = 500;
  const STORAGE_KEY = "flowBatchRunLogV2397";
  const ACTIVE_KEY = "flowBatchRunActiveV2397";
  const currentPageKey = location.pathname;
  const logStore = window.__flowBatchCheckpointV2.createStore("flow-batch-logs-v2");
  let restored = null, savedLog = null, localRestored = null;
  try { localRestored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch {}
  try { savedLog = await logStore.load(); } catch(error) { console.warn("日志存储读取失败", error); }
  if (savedLog?.meta?.[0]?.pageKey === currentPageKey) {
    const storedEvents = (savedLog.events || []).map(row => row?.event).filter(event => event?.type);
    restored = {...savedLog.meta[0], events: storedEvents,
      inputRows:Object.fromEntries((savedLog.inputs||[]).map(row=>[row.ref,row.input]))};
  }
  // IndexedDB writes from an interrupted/frozen renderer can contain placeholder
  // rows. Prefer the valid, newer local snapshot instead of silently restoring
  // hundreds of empty events.
  if (localRestored?.pageKey === currentPageKey) {
    const localEvents = Array.isArray(localRestored.events) ? localRestored.events.filter(event => event?.type) : [];
    const storedEvents = Array.isArray(restored?.events) ? restored.events : [];
    const localSequence = localEvents.reduce((max, event) => Math.max(max, Number(event?.sequence) || 0), 0);
    const storedSequence = storedEvents.reduce((max, event) => Math.max(max, Number(event?.sequence) || 0), 0);
    if (!restored || localSequence >= storedSequence) restored = { ...localRestored, events: localEvents };
  }
  if (restored?.pageKey && restored.pageKey !== currentPageKey) restored = null;
  const startedAt = restored?.startedAt || new Date().toISOString();
  let events = Array.isArray(restored?.events) ? restored.events.slice(-MAX_EVENTS) : [];
  const inputSchema = Object.freeze({
    A: "imageName", B: "endImageName", C: "clipName", D: "prompt",
    E: "mode", F: "seconds", G: "videoType", H: "imageMediaKey", I: "endImageMediaKey",
  });
  let inputRows = restored?.inputRows && typeof restored.inputRows === "object"
    ? { ...restored.inputRows }
    : {};
  let sequence = events.reduce((max, item) => Math.max(max, Number(item?.sequence) || 0), 0);
  let runStarted = false;
  let failureExported = false;
  let terminalExported = false;
  let saveTimer = 0;
  let autoExportTimer = 0;
  let lastAutoExportSignature = "";
  let lastSubmitAt = "";
  let lastStatusChangeAt = Date.now();
  let lastStatusSignature = "";
  let lastMutationStatusSignature = "";
  let stopRequestedAt = 0;
  let stopDrainTimer = 0;
  const aggregatedEvents = new Map();

  const now = () => new Date().toISOString();
  const text = (value) => String(value ?? "");
  function uuidPaths(value, path = "$", output = [], depth = 0) {
    if (value == null || depth > 12 || output.length >= 80) return output;
    if (typeof value === "string") {
      for (const match of value.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi)) {
        output.push({ path, value: match[0] });
        if (output.length >= 80) break;
      }
      // batchexecute nests the actual request as JSON strings.
      if (/^[\[{]/.test(value.trim())) {
        try { uuidPaths(JSON.parse(value), `${path}#json`, output, depth + 1); } catch {}
      }
      return output;
    }
    if (typeof value !== "object") return output;
    if (Array.isArray(value)) value.forEach((item, index) => uuidPaths(item, `${path}[${index}]`, output, depth + 1));
    else Object.entries(value).slice(0, 120).forEach(([key, item]) => uuidPaths(item, `${path}.${key}`, output, depth + 1));
    return output;
  }
  const cleanUrl = (value) => {
    try {
      const url = new URL(text(value), location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return text(value).replace(/([?&](?:at|token|auth|signature|key)=[^&\s]+)/gi, "$1".split("=")[0] + "=[已脱敏]");
    }
  };
  function sanitize(value, depth = 0, seen = new WeakSet()) {
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") {
      const result = /https?:\/\//i.test(value) ? cleanUrl(value) : value;
      return result.length > 5000 ? `${result.slice(0, 5000)}…[截断]` : result;
    }
    if (typeof value !== "object" || depth > 5) return text(value);
    if (seen.has(value)) return "[循环引用]";
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitize(item, depth + 1, seen));
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      if (/cookie|authorization|credential|password|signature|access.?token|id.?token/i.test(key)) {
        output[key] = "[已脱敏]";
      } else output[key] = sanitize(item, depth + 1, seen);
    }
    return output;
  }
  function persistNow() {
    const snapshot = { version: VERSION, pageKey: currentPageKey, startedAt, events, inputRows };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (error) {
      // Keep a smaller emergency trace when storage is tight. The latest request
      // and protocol events are more useful than an old, larger history.
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, events: events.slice(-180) })); } catch {}
    }
    logStore.save({
      meta:[{version:VERSION,pageKey:currentPageKey,startedAt}],
      inputs:Object.entries(inputRows).map(([ref,input])=>({ref,input})),
      events:events.map(event=>({event}))
    }).catch(error=>console.error("日志保存失败",error));
    try { localStorage.setItem(ACTIVE_KEY, runStarted ? "1" : "0"); } catch {}
  }
  function rowReference(process) {
    if (!process || typeof process !== "object") return process;
    const rowNumber = Math.max(1, Number(process.rowNumber) || Number(process.rowIndex) + 1 || 1);
    const ref = `R${rowNumber}`;
    inputRows[ref] = {
      A: text(process.imageName || process.image?.displayName),
      B: text(process.endImageName || process.endImage?.displayName),
      C: text(process.clipName),
      D: text(process.prompt || process.line),
      E: text(process.mode),
      F: process.seconds ?? "",
      G: text(process.videoType),
      H: text(process.image?.primaryMediaKey),
      I: text(process.endImage?.primaryMediaKey),
    };
    return {
      rowRef: ref,
      attempt: Number(process.attempt) || 0,
      planRound: Number(process.planRound) || 0,
      planPhase: text(process.planPhase),
      status: text(process.status),
      message: text(process.message),
      bindingKey: text(process.bindingKey),
      expectedOutputs: Number(process.expectedOutputs) || 0,
      submittedAt: Number(process.submittedAt) || 0,
    };
  }
  function compactEventData(value, depth = 0) {
    if (value == null || typeof value !== "object" || depth > 5) return value;
    if (Array.isArray(value)) return value.slice(0, 80).map((item) => compactEventData(item, depth + 1));
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "process" || key === "currentProcess") output[key] = rowReference(item);
      else if (key === "image" || key === "endImage")
        output[key] = item ? { mediaKey: text(item.primaryMediaKey), name: text(item.displayName) } : null;
      else if (key === "fReq") output.fReqLength = text(item).length;
      else if (key === "payload") {
        const rawPayload = text(item);
        const codes = [...rawPayload.matchAll(/PUBLIC_ERROR_[A-Z_]+/gi)].map((match) => match[0]);
        if (codes.length) output.payloadErrorCodes = [...new Set(codes)];
        output.payloadLength = rawPayload.length;
      }
      else output[key] = compactEventData(item, depth + 1);
    }
    return output;
  }
  events = events.map((event) => ({
    ...event,
    data: sanitize(compactEventData(event?.data || {})),
  }));
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (typeof requestIdleCallback === "function")
        requestIdleCallback(() => persistNow(), { timeout: 1500 });
      else persistNow();
    }, PERSIST_DELAY_MS);
  }
  function repeatedEventFingerprint(type, data) {
    if (!["window_error", "unhandled_rejection", "scheduler_heartbeat", "logger_heartbeat", "status_snapshot"].includes(type)) return "";
    return `${type}|${text(data?.message || data?.reason || data?.status || "").slice(0, 500)}`;
  }
  function record(type, data = {}) {
    if (type === "flow_generate_click" || type === "native:ready_before_submit") lastSubmitAt = now();
    const at = now(), compacted = sanitize(compactEventData(data));
    if ((type === "window_error" || type === "unhandled_rejection") && compacted?.stack) {
      const stack = text(compacted.stack);
      compacted.stack = `${stack.slice(0, 1500)}${stack.length > 1500 ? "…[截断]" : ""}`;
    }
    const fingerprint = repeatedEventFingerprint(type, compacted), previous = fingerprint && aggregatedEvents.get(fingerprint);
    if (previous && events.includes(previous)) {
      previous.count = Number(previous.count || 1) + 1;
      previous.lastAt = at;
      previous.data = compacted;
      persist();
      return;
    }
    const event = { sequence: ++sequence, at, type, data: compacted };
    if (fingerprint) aggregatedEvents.set(fingerprint, event);
    events.push(event);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    if (type === "rpc_request" || type === "protocol:template_rejected" || type === "angular_direct:prepare_complete" || type === "angular_direct:submit_invoked_dom") persistNow();
    else persist();
  }
  function rowsSnapshot() {
    return [...document.querySelectorAll(".fb-full-modal tbody tr")].slice(0, 300).map((row, index) => ({
      index: index + 1,
      text: text(row.textContent).replace(/\s+/g, " ").trim().slice(0, 3000),
    }));
  }
  function safePart(value, fallback = "未命名项目") {
    const result = text(value).trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/g, "").slice(0, 100);
    return result || fallback;
  }
  function downloadFolder() {
    const inputs = [...document.querySelectorAll("#flow-batch-generate input")];
    return text(inputs.find((input) => /Flow批量生成[\\/]/.test(input.value))?.value).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  function projectName(folder = downloadFolder()) {
    const title = text(document.querySelector("header h1,[class*='collection'] h1")?.textContent).trim();
    return safePart(folder.split("/").filter(Boolean).pop() || title);
  }
  function timestamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  function buildLog(reason = "手动", addExportEvent = true) {
    if (addExportEvent) record("log_export", { reason });
    const match = location.pathname.match(/\/project\/([^/]+)\/collection\/([^/]+)/);
    const payload = {
      logVersion: VERSION,
      extensionVersion: VERSION,
      startedAt,
      exportedAt: now(),
      reason,
      page: {
        origin: location.origin,
        projectId: match?.[1] || "",
        collectionId: match?.[2] || "",
      },
      inputDictionary: { schema: inputSchema, rows: inputRows },
      currentProcess: sanitize(rowReference(window.currentProcess)),
      rows: rowsSnapshot(),
      events,
    };
    const folder = downloadFolder();
    payload.project = { name: projectName(folder), downloadFolder: folder };
    return payload;
  }
  function exportLog(reason = "手动") {
    const payload = buildLog(reason, true);
    if (typeof window.__flowBatchSaveUnifiedRecord === "function") {
      window.__flowBatchSaveUnifiedRecord({ reason, log: payload });
      return `Flow断点及日志_${payload.project.name}_${timestamp()}.json`;
    }
    const folder = downloadFolder();
    const base = `Flow运行记录_${VERSION}_${payload.project.name}_${timestamp()}.json`;
    const filename = folder ? `${folder}/${base}` : base;
    window.postMessage({ type: "FLOW_BATCH_SAVE_RUN_LOG_V2392", text: JSON.stringify(payload, null, 2), filename }, "*");
    return filename;
  }
  function exportOnce(reason) {
    if (terminalExported) return "";
    terminalExported = true;
    return exportLog(reason);
  }

  function finishStoppedRunLog(reason) {
    if (!stopRequestedAt || !runStarted) return;
    clearTimeout(stopDrainTimer);
    stopDrainTimer = 0;
    record("post_stop_logging_finished", {
      reason,
      elapsedMs: Date.now() - stopRequestedAt,
    });
    exportOnce(reason);
    runStarted = false;
    stopRequestedAt = 0;
    persistNow();
  }

  function schedulePostStopLogging() {
    clearTimeout(stopDrainTimer);
    stopDrainTimer = setTimeout(
      () => finishStoppedRunLog("停止新增提交后等待Flow结果达到五分钟期限"),
      5 * 60 * 1000,
    );
  }

  function maybeFinishPostStopLogging(statuses) {
    if (!stopRequestedAt || !runStarted || !statuses.length) return;
    const hasInFlight = statuses.some((status) =>
      /正在提交|生成中|等待\s*Flow\s*结果|下载中/.test(status),
    );
    if (!hasInFlight) finishStoppedRunLog("停止新增提交后，所有在途任务已结算");
  }

  window.__flowBatchRunLogger = Object.freeze({ version: VERSION, record, build: buildLog, export: exportLog });
  const interruptedRunRecovered = !!restored && localStorage.getItem(ACTIVE_KEY) === "1";
  localStorage.setItem(ACTIVE_KEY, "0");
  record("logger_ready", { href: cleanUrl(location.href), userAgent: navigator.userAgent, restoredEvents: events.length, interruptedRunRecovered });

  function updateRunStatus(statuses = []) {
    const signature = statuses.join("|");
    if (signature && signature !== lastStatusSignature) {
      lastStatusSignature = signature;
      lastStatusChangeAt = Date.now();
    }
  }

  (() => {
    const proto = XMLHttpRequest.prototype, originalOpen = proto.open, originalSend = proto.send;
    proto.open = function (method, url) {
      this.__fbLogMethod = text(method);
      this.__fbLogUrl = text(url);
      return originalOpen.apply(this, arguments);
    };
    proto.send = function (body) {
      const rpc = /[?&]rpcids=([^&]+)/.exec(this.__fbLogUrl || "")?.[1] || "";
      if (rpc) {
        // This logger is intentionally the first network wrapper installed.
        // Forward the raw request to the protocol learner so Flow builds that
        // cached an earlier XHR.send reference cannot bypass template learning.
        try {
          window.__flowBatchProtocolAdapter?.observeRequest?.(
            this.__fbLogMethod,
            this.__fbLogUrl,
            body,
            window.currentProcess && { ...window.currentProcess },
          );
        } catch (error) {
          record("protocol:observer_forward_failed", { rpc, message: error?.message || text(error) });
        }
        let bodyInfo = {};
        try {
          const raw = typeof body === "string" ? body : "", params = new URLSearchParams(raw), fReq = params.get("f.req") || "";
          let parsed; try { parsed = JSON.parse(fReq); } catch {}
          const uuidCandidates = [...new Set(fReq.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || [])];
          bodyInfo = {
            length: raw.length,
            keys: [...params.keys()].filter((key) => !/token|auth|at/i.test(key)),
            fReqLength: fReq.length,
            fReqRpc: parsed?.[0]?.[0]?.[0] || rpc,
            // UUIDs are opaque request structure markers. Recording only these
            // lets us learn a grey-release payload without retaining prompts,
            // cookies, auth tokens, or other request content.
            uuidCandidates: /^(?:YhhmEf|MZZa6b|nprQif|eb1hJf)$/i.test(rpc) ? uuidCandidates : undefined,
            uuidPaths: /^(?:YhhmEf|MZZa6b|nprQif|eb1hJf)$/i.test(rpc) ? uuidPaths(parsed) : undefined,
            authFields: [...params.keys()].filter((key) => /token|auth|at/i.test(key)).map((key) => ({ key, present: !!params.get(key), length: text(params.get(key)).length })),
          };
        } catch (error) { bodyInfo = { error: text(error?.message || error) }; }
        record("rpc_request", { rpc, method: this.__fbLogMethod, url: cleanUrl(this.__fbLogUrl), process: window.currentProcess, body: bodyInfo });
        this.addEventListener("loadend", () => {
          let raw = ""; try { raw = typeof this.responseText === "string" ? this.responseText : ""; } catch {}
          let payload; try { payload = JSON.parse(raw.replace(/^\)\]\}'\s*/, "")); } catch {}
          const errorMatches = [...raw.matchAll(/(?:PUBLIC_ERROR_[A-Z_]+|"(?:error|status|message)"\s*:\s*"[^"]{0,500}")/gi)].slice(0, 30).map((match) => match[0]);
          record("rpc_response", { rpc, httpStatus: this.status, responseLength: raw.length, errorMatches });
        });
      }
      return originalSend.apply(this, arguments);
    };
  })();

  addEventListener("error", (event) => record("window_error", {
    message: event.message,
    filename: cleanUrl(event.filename),
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
  }));
  addEventListener("unhandledrejection", (event) => record("unhandled_rejection", {
    message: event.reason?.message || text(event.reason),
    stack: event.reason?.stack,
  }));

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button");
    if (!button) return;
    const label = text(button.textContent).replace(/\s+/g, " ").trim();
    if (/arrow_forward|生成|create/i.test(label) && !button.closest("#flow-batch-generate")) {
      record("flow_generate_click", { source: event.isTrusted ? "manual" : "plugin", isTrusted: event.isTrusted, label, disabled: !!button.disabled, ariaDisabled: button.getAttribute("aria-disabled") || "" });
    }
    if (label === "开始 / 继续未完成") {
      clearTimeout(stopDrainTimer);
      stopDrainTimer = 0;
      stopRequestedAt = 0;
      runStarted = true;
      failureExported = false;
      terminalExported = false;
      record("user_start", { label, isTrusted: event.isTrusted, x: event.clientX, y: event.clientY });
    } else if (label === "停止继续提交") {
      record("user_stop", { label, isTrusted: event.isTrusted, x: event.clientX, y: event.clientY });
      stopRequestedAt = Date.now();
      record("post_stop_logging_started", { deadlineMs: 5 * 60 * 1000 });
      schedulePostStopLogging();
    } else if (label === "确认清空") {
      record("user_clear", { label });
      try { localStorage.removeItem(STORAGE_KEY); logStore.save({}).catch(console.error); } catch {}
    }
  }, true);

  addEventListener("FLOW_BATCH_RUN_SETTLED", (event) => {
    if (!runStarted) return;
    const reason = text(event.detail?.reason || "运行结束");
    record("run_settled", { reason });
    if (stopRequestedAt) {
      record("run_settled_while_post_stop_logging", { reason });
      return;
    }
    exportOnce(reason);
    runStarted = false;
  });

  let emitterTimer = setInterval(() => {
    const emitter = window.emitter;
    if (!emitter?.emit || emitter.emit.__flowRunLogged) return;
    const original = emitter.emit.bind(emitter);
    const wrapped = function (name, payload) {
      record(`emitter:${name}`, payload);
      return original(name, payload);
    };
    wrapped.__flowRunLogged = true;
    try {
      emitter.emit = wrapped;
      record("emitter_hooked");
      clearInterval(emitterTimer);
    } catch (error) {
      record("emitter_hook_failed", { message: error?.message || text(error) });
    }
  }, 200);

  let mutationTimer = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      const statuses = [...document.querySelectorAll('.fb-status-cell,[class*="fb-status-"]')]
        .map((node) => text(node.textContent).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const mutationStatusSignature = statuses.join("\n");
      if (statuses.length && mutationStatusSignature !== lastMutationStatusSignature) {
        lastMutationStatusSignature = mutationStatusSignature;
        record("status_snapshot", { statuses: statuses.slice(0, 300) });
      }
      maybeFinishPostStopLogging(statuses);
      if (
        runStarted &&
        !failureExported &&
        statuses.some((status) => /未找到图片|配置失败|提交准备失败|调度异常/.test(status))
      ) {
        failureExported = true;
        record("first_prepare_failure_seen");
      }
      const nativeFailures = [...document.querySelectorAll("body *")]
        .filter((node) => node.children.length < 8 && /失败/.test(text(node.textContent)) && /无法生成|未扣除|抱歉/.test(text(node.textContent)))
        .map((node) => text(node.textContent).replace(/\s+/g, " ").trim().slice(0, 1000));
      if (runStarted && nativeFailures.length) {
        const signature = nativeFailures.join("|");
        if (signature !== lastAutoExportSignature) {
          lastAutoExportSignature = signature;
          record("flow_native_failure", { cards: [...new Set(nativeFailures)].slice(0, 20) });
        }
      }
    }, 700);
  });
  const beginObserve = () => observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", beginObserve, { once: true })
    : beginObserve();

  addEventListener("FLOW_BATCH_HEARTBEAT", (event) => {
    if (!runStarted) return;
    record("scheduler_heartbeat", event.detail || {});
  });
  setInterval(() => {
    if (!runStarted) return;
    const statuses = [...document.querySelectorAll('.fb-status-cell,[class*="fb-status-"]')]
      .map((node) => text(node.textContent).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    updateRunStatus(statuses);
    record("logger_heartbeat", {
      visible: document.visibilityState,
      currentProcess: window.currentProcess,
      statusCount: statuses.length,
      generating: statuses.filter((value) => /生成中|正在提交/.test(value)).length,
      verifying: statuses.filter((value) => /等待Flow结果/.test(value)).length,
      lastSubmitAt,
      statusIdleSeconds: Math.max(0, Math.floor((Date.now() - lastStatusChangeAt) / 1000)),
    });
    persistNow();
  }, 15000);
  addEventListener("pagehide", () => {
    record("pagehide", { runStarted, currentProcess: window.currentProcess });
    persistNow();
  });
  if (interruptedRunRecovered) {
    const recoveredExportTimer = setInterval(() => {
      if (typeof window.__flowBatchSaveUnifiedRecord !== "function") return;
      clearInterval(recoveredExportTimer);
      record("interrupted_run_checkpoint_requested", {
        reason: "检测到上次运行未经过正常结束流程",
      });
      window.__flowBatchSaveUnifiedRecord({
        reason: "检测到上次运行非正常中断",
        log: buildLog("检测到上次运行非正常中断", false),
      });
    }, 1000);
    setTimeout(() => clearInterval(recoveredExportTimer), 30000);
  }
})();
