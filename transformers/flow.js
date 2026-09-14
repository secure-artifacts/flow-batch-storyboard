(function () {
  "use strict";
  if (window.__flowBatchTransformerV23125) return;
  window.__flowBatchTransformerV23125 = !0;
  window.__flowBatchDiscoverPromptBridge = () => {
    return !!window.__flowBatchNativeBridge?.isReady?.();
  };
  async function S(e) {
    let o;
    const a = e.headers.get("Content-Type") || "";
    try {
      if (a.includes("application/json")) o = await e.json();
      else if (a.includes("text/")) {
        let n = await e.text();
        n = n.replace(/^for\s*\(\s*;;\s*\);/, "").trim();
        try {
          o = JSON.parse(n);
        } catch {
          o = n;
        }
      } else if (a.includes("application/octet-stream") || a.includes("blob"))
        o = await e.blob();
      else if (a.includes("form-data")) o = await e.formData();
      else {
        let n = await e.text();
        try {
          o = JSON.parse(n);
        } catch {
          o = n;
        }
      }
    } catch (n) {
      console.log(n);
    }
    return o;
  }
  function P(e) {
    const o = [],
      a = new Set(),
      n = new WeakSet();
    function c(i, s = 0, t = !1) {
      if (!i || typeof i != "object" || s > 8) return;
      if (Array.isArray(i)) {
        for (const r of i) c(r, s + 1, t);
        return;
      }
      if (n.has(i)) return;
      n.add(i);
      const r = typeof i.name == "string" ? i.name.trim() : "";
      if (t && r && !a.has(r)) (a.add(r), o.push(i));
      for (const [l, d] of Object.entries(i))
        c(d, s + 1, l.toLowerCase() === "media" || (t && !r));
    }
    return (c(e), o);
  }
  function O(e) {}
  window.currentProcess = null;
  window.flowBatchPendingVerificationProcesses = Array.isArray(
    window.flowBatchPendingVerificationProcesses,
  )
    ? window.flowBatchPendingVerificationProcesses
    : [];
  window.flowBatchKnownGenerationIds = Array.isArray(
    window.flowBatchKnownGenerationIds,
  )
    ? window.flowBatchKnownGenerationIds
    : [];
  const E =
    window.flowBatchSeenMediaIds instanceof Set
      ? window.flowBatchSeenMediaIds
      : new Set();
  window.flowBatchSeenMediaIds = E;
  const fbTerminalGenerationIds =
    window.flowBatchTerminalGenerationIds instanceof Set
      ? window.flowBatchTerminalGenerationIds
      : new Set();
  window.flowBatchTerminalGenerationIds = fbTerminalGenerationIds;
  let fbLastStatusFetch = null,
    fbLastStatusXhr = null,
    fbLastMediaXhr = null,
    fbMediaResolveInFlight = new Set(),
    fbResultReconcilePromise = null;
  function fbSettleGenerationId(id, outcome) {
    if (!id || fbTerminalGenerationIds.has(id)) return false;
    fbTerminalGenerationIds.add(id);
    fbMediaResolveInFlight.delete(id);
    window.__flowBatchRunLogger?.record?.("result_generation_settled", {
      generationId: id,
      outcome,
    });
    return true;
  }
  function V(e) {
    if (!e?.rowId) return;
    const o = `${e.rowId}:${Number(e.attempt) || 1}`,
      a = window.flowBatchPendingVerificationProcesses,
      n = a.findIndex(
        (c) => `${c?.rowId}:${Number(c?.attempt) || 1}` === o,
      ),
      i = {
        ...e,
        expectedOutputs: Math.min(
          4,
          Math.max(1, Number(e.expectedOutputs) || 1),
        ),
        _verificationIds: Array.isArray(e._verificationIds)
          ? e._verificationIds.filter(Boolean)
          : [],
        _verificationIgnoredIds: Array.isArray(e._verificationIgnoredIds)
          ? e._verificationIgnoredIds.filter(Boolean)
          : [...E],
      };
    n >= 0 ? (a[n] = { ...a[n], ...i }) : a.push(i);
  }
  function R(e) {
    const o = [...new Set((e || []).filter(Boolean))];
    const pending = window.flowBatchPendingVerificationProcesses;
    // Some Flow grey releases keep the submit RPC open and only reveal the
    // generation id through the result poll.  FIFO is unsafe with concurrent
    // rows, but when there is exactly one pending submission the association
    // is unambiguous.  Bind only ids that were not visible when that pending
    // record was created, and never infer more than its expected output count.
    if (Array.isArray(pending) && pending.length === 1) {
      const process = pending[0];
      const ignored = new Set(process?._verificationIgnoredIds || []);
      const fresh = o.filter((id) => !ignored.has(id) && !E.has(id));
      const expected = Math.min(4, Math.max(1, Number(process?.expectedOutputs) || 1));
      const inferenceReady = Date.now() - Number(process?._verificationRegisteredAt || 0) >= 2500;
      if (process?.rowId && inferenceReady && fresh.length > 0 && fresh.length <= expected) {
        window.flowBatchPendingVerificationProcesses = pending.filter((item) => item !== process);
        window.__flowBatchRunLogger?.record?.("poll_uuid_bound_to_unique_pending", {
          rowId: process.rowId,
          attempt: Number(process.attempt) || 0,
          generationIds: fresh,
        });
        window.emitter?.emit?.(
          "onSubmitSuccess",
          Object.fromEntries(fresh.map((id) => [id, process])),
        );
      }
    }
    o.forEach((c) => E.add(c));
    o.length &&
      window.__flowBatchRunLogger?.record?.("network_result_ids_observed", {
        ids: o,
        inferredBindingsDisabled: true,
        reason: "轮询回执没有可靠行号，禁止按待核实行 FIFO 猜测归属",
      });
  }
  function k() {
      const e = window.fetch;
      window.fetch = async (o, a) => {
      const n = M(o),
        requestBody = typeof a?.body === "string" ? a.body : "",
        requestSignature = `${n} ${requestBody}`,
        nativeBatchSubmit =
          typeof location !== "undefined" &&
          location.hostname === "flow.google.com" &&
          n.includes("/AiSandboxAngularFrontend/data/batchexecute") &&
          /L2jnw/i.test(requestSignature) &&
          window.currentProcess != null,
        c =
          (n.includes("video:batchAsyncGenerateVideo") &&
            window.currentProcess != null) ||
          nativeBatchSubmit,
        i = n.includes("video:batchCheckAsyncVideoGenerationStatus"),
        s = c || i,
        t = window.currentProcess && { ...window.currentProcess };
      if (i) {
        const replayInit = { ...(a || {}) };
        delete replayInit.signal;
        fbLastStatusFetch = { url: n, init: replayInit };
      }
      if (c) {
        const { rowIndex: w, lineIndex: m, line: l, image: d } = t;
        "" +
          JSON.stringify({
            image: d?.displayName || t.endImage?.displayName || "",
            line: l,
            rowIndex: w,
            lineIndex: m,
          });
      }
      const r = await e(o, a);
      if (s)
        try {
          const w = r.clone(),
            m = await S(w);
          if (m) {
            if (c) {
              const rawResponse = JSON.stringify(m);
              if (/PUBLIC_ERROR_UNUSUAL_ACTIVITY/i.test(rawResponse)) {
                window.flowBatchPendingVerificationProcesses =
                  window.flowBatchPendingVerificationProcesses.filter(
                    (p) =>
                      p?.rowId !== t?.rowId ||
                      Number(p?.attempt) !== Number(t?.attempt),
                  );
                window.__flowBatchRunLogger?.record?.("submit_explicit_failure", {
                  transport: "fetch",
                  code: "PUBLIC_ERROR_UNUSUAL_ACTIVITY",
                  rowId: t?.rowId,
                  attempt: Number(t?.attempt) || 0,
                });
                window.emitter?.emit?.("onSubmitFailure", {
                  process: t,
                  message:
                    "Flow 明确拒绝本次提交：异常流量限制（PUBLIC_ERROR_UNUSUAL_ACTIVITY）",
                });
                return r;
              }
              const l = P(m);
              if (Array.isArray(l) && l.length) {
                const d = {};
                for (const p of l) {
                  const u = p?.name;
                  u && (d[u] = t, E.add(u));
                }
                if (Object.keys(d).length) {
                  window.flowBatchPendingVerificationProcesses =
                    window.flowBatchPendingVerificationProcesses.filter(
                      (p) =>
                        p?.rowId !== t?.rowId ||
                        Number(p?.attempt) !== Number(t?.attempt),
                    );
                  const { image: p, line: u, rowIndex: g, lineIndex: h } = t;
                  ("" +
                    JSON.stringify({
                      image: p?.displayName || t.endImage?.displayName || "",
                      line: u,
                      rowIndex: g,
                      lineIndex: h,
                      ids: Object.keys(d),
                    }),
                    window.emitter.emit("onSubmitSuccess", d));
                }
              } else {
                const explicitError = m?.error?.message || m?.error?.status,
                  definiteHttpFailure =
                    !r.ok && r.status >= 400 && r.status < 500 && r.status !== 408,
                  definiteBodyFailure = r.ok && !!explicitError,
                  eventName =
                    definiteBodyFailure || definiteHttpFailure
                      ? "onSubmitFailure"
                      : "onSubmitNeedsVerification";
                eventName === "onSubmitNeedsVerification" && V(t);
                window.emitter.emit(eventName, {
                  process: t,
                  message:
                    m?.error?.message ||
                    m?.message ||
                    (eventName === "onSubmitFailure"
                      ? `Flow 明确拒绝了生成任务${r.ok ? "" : `（HTTP ${r.status}）`}`
                      : `Flow 回执中没有找到任务编号${r.ok ? "" : `（HTTP ${r.status}）`}；任务是否成功创建尚不能确认`),
                });
              }
            } else if (i) {
              const l = {},
                failed = {},
                d = P(m);
              if (Array.isArray(d) && d.length) {
                R(d.map((p) => p?.name));
                for (const p of d) {
                  const rawStatus =
                      p.mediaMetadata?.mediaStatus?.mediaGenerationStatus ||
                      p.mediaStatus?.mediaGenerationStatus ||
                      p.mediaGenerationStatus ||
                      p.status ||
                      "",
                    status = String(rawStatus).toUpperCase();
                  if (status.includes("SUCCESSFUL")) {
                    const u = p?.name;
                    if (u) {
                      const g = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${u}`,
                        h = l[u] || [];
                      (h.push({ url: g }), (l[u] = h));
                    }
                  } else if (
                    status.includes("FAIL") ||
                    status.includes("ERROR") ||
                    status.includes("CANCEL")
                  ) {
                    const u = p?.name;
                    u &&
                      (failed[u] = {
                        status,
                        message:
                          p.mediaMetadata?.mediaStatus?.errorMessage ||
                          p.mediaMetadata?.mediaStatus?.message ||
                          p.mediaStatus?.errorMessage ||
                          p.mediaStatus?.message ||
                          p.error?.message ||
                          "Flow 生成失败",
                      });
                  }
                }
                Object.keys(l).length &&
                  ("" + JSON.stringify({ result: l }),
                  window.emitter.emit("onReceiveData", l));
                Object.keys(failed).length &&
                  window.emitter.emit("onReceiveFailure", failed);
              }
            }
          }
        } catch (w) {
          console.error(w);
        }
      return r;
    };
  }
  function M(e) {
    return typeof e == "string"
      ? e
      : e instanceof URL
        ? e.href
        : e instanceof Request
          ? e.url
          : String(e ?? "");
  }
  function fbBatchPayload(e) {
    try {
      const lines = String(e || "").replace(/^\)\]\}'\s*/, "").split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("[[")) continue;
        const outer = JSON.parse(line);
        const value = outer?.[0]?.[2];
        if (typeof value === "string") return JSON.parse(value);
      }
    } catch {}
    return null;
  }
  function fbVideoResults(e) {
    const result = {}, source = String(e || "");
    const expression = /https:(?:\\?\/){2}flow-content\.google(?:\\?\/)video(?:\\?\/)([0-9a-f-]{36})\?[^"\s]+/gi;
    for (const match of source.matchAll(expression)) {
      const id = match[1], url = match[0]
        .replace(/\\u003d/g, "=")
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/")
        .replace(/\\/g, "");
      (result[id] ||= []).push({ url });
    }
    return result;
  }
  function fbSubmitGenerationIds(payload, rawResponse = "") {
    const result = [], seen = new Set();
    const projectId =
      /\/project\/([0-9a-f-]{36})/i.exec(location.pathname)?.[1]?.toLowerCase() || "";
    const add = (value) => {
      const id = typeof value === "string" ? value.trim() : "";
      if (
        !/^[0-9a-f-]{36}$/i.test(id) ||
        id.toLowerCase() === projectId ||
        seen.has(id)
      )
        return;
      seen.add(id);
      result.push(id);
    };
    const records = payload?.[3];
    if (Array.isArray(records)) {
      for (const record of records) {
        if (Array.isArray(record)) add(record[0]);
        else add(record);
      }
      // Current Flow returns one record per created output.  Its first field is
      // the media UUID; later UUID fields are the project and auxiliary IDs.
      if (result.length) return result;
    }
    const visit = (value, depth = 0) => {
      if (value == null || depth > 6) return;
      if (typeof value === "string") {
        add(value);
        return;
      }
      if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
    };
    visit(records);
    // Flow occasionally changes the nesting of batchexecute's submit reply.
    // UUIDs in the response of the *submit RPC itself* remain authoritative;
    // unlike polling results, they cannot be accidentally assigned FIFO to a
    // different row. Use this only when the structured decoder found nothing.
    if (!result.length) {
      for (const match of String(rawResponse || "").matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi))
        add(match[0]);
    }
    return result;
  }
  function fbRewriteRpcBody(body, rpc, argument) {
    try {
      const params = new URLSearchParams(String(body || "")),
        rawRequest = params.get("f.req");
      if (!rawRequest) return null;
      const request = JSON.parse(rawRequest);
      let changed = false;
      const visit = (value) => {
        if (!Array.isArray(value)) return;
        if (value[0] === rpc && typeof value[1] === "string") {
          value[1] = JSON.stringify(argument);
          changed = true;
          return;
        }
        value.forEach(visit);
      };
      visit(request);
      if (!changed) return null;
      params.set("f.req", JSON.stringify(request));
      return params.toString();
    } catch {
      return null;
    }
  }
  function fbStatusCode(media) {
    const code = Number(media?.[5]?.[8]?.[0]);
    return Number.isFinite(code) ? code : 0;
  }
  function fbStatusMessage(media, code) {
    const values = [];
    const collect = (value, depth = 0) => {
      if (depth > 5 || value == null) return;
      if (typeof value === "string") {
        const text = value.trim();
        if (text && !/^[0-9a-f-]{36}$/i.test(text)) values.push(text);
        return;
      }
      if (Array.isArray(value)) value.forEach((item) => collect(item, depth + 1));
    };
    collect(media?.[5]?.[8]);
    return (
      values.find((value) => /fail|error|cancel|policy|violate|拒绝|失败|取消/i.test(value)) ||
      values[0] ||
      (code === 5 ? "Flow 已取消生成任务" : "Flow 生成失败")
    );
  }
  function fbStatusResults(payload) {
    const successful = [], failed = {}, media = payload?.[2];
    if (!Array.isArray(media)) return { successful, failed };
    for (const item of media) {
      const id = typeof item?.[0] === "string" ? item[0].trim() : "",
        code = fbStatusCode(item);
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      if (code === 3) successful.push(id);
      else if (code === 4 || code === 5 || code === 7)
        failed[id] = {
          status: code === 5 ? "CANCELED" : "FAILED",
          message: fbStatusMessage(item, code),
        };
    }
    return { successful, failed };
  }
  function fbIsTransientGenerationFailure(failure) {
    const message = String(failure?.message || "").trim();
    return /\bmedia\s+not\s+found\b/i.test(message);
  }
  function fbIsBoundGenerationId(id) {
    return (window.flowBatchKnownGenerationIds || []).includes(id);
  }
  function fbSendRpcXhr(template, body, generationId = "") {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(template.method, template.url, true);
      request.withCredentials = true;
      if (generationId) request.__flowBatchGenerationLookupId = generationId;
      try {
        request.setRequestHeader(
          "Content-Type",
          "application/x-www-form-urlencoded;charset=UTF-8",
        );
      } catch {}
      request.addEventListener("loadend", resolve, { once: true });
      request.addEventListener("error", reject, { once: true });
      request.send(body);
    });
  }
  function fbRequestMediaForGeneration(id) {
    if (!id || fbTerminalGenerationIds.has(id) || fbMediaResolveInFlight.has(id)) return;
    if (!fbLastMediaXhr) {
      window.__flowBatchRunLogger?.record?.("result_media_lookup_deferred", {
        generationId: id,
        reason: "no_media_request_captured",
      });
      return;
    }
    const body = fbRewriteRpcBody(fbLastMediaXhr.body, "as29s", [id]);
    if (!body) {
      window.__flowBatchRunLogger?.record?.("result_media_lookup_deferred", {
        generationId: id,
        reason: "media_request_rebuild_failed",
      });
      return;
    }
    fbMediaResolveInFlight.add(id);
    window.__flowBatchRunLogger?.record?.("result_media_lookup_requested", {
      generationId: id,
    });
    fbSendRpcXhr(fbLastMediaXhr, body, id)
      .catch((error) => {
        window.__flowBatchRunLogger?.record?.("result_media_lookup_failed", {
          generationId: id,
          message: error?.message || String(error),
        });
      })
      .finally(() => fbMediaResolveInFlight.delete(id));
  }
  function fbInstallAngularXhrBridge() {
    const proto = XMLHttpRequest.prototype,
      nativeOpen = proto.open,
      nativeSend = proto.send;
    if (proto.__flowBatchAngularBridge) return;
    Object.defineProperty(proto, "__flowBatchAngularBridge", { value: true });
    proto.open = function (method, url) {
      this.__flowBatchRpcUrl = String(url || "");
      this.__flowBatchRpcMethod = String(method || "GET");
      return nativeOpen.apply(this, arguments);
    };
    proto.send = function (body) {
      const url = this.__flowBatchRpcUrl || "",
        rpc = /[?&]rpcids=([^&]+)/.exec(url)?.[1] || "",
        process = window.currentProcess && { ...window.currentProcess };
      if (rpc === "jwpduf")
        fbLastStatusXhr = {
          method: this.__flowBatchRpcMethod || "POST",
          url,
          body: typeof body === "string" ? body : body ?? null,
        };
      if (rpc === "as29s")
        fbLastMediaXhr = {
          method: this.__flowBatchRpcMethod || "POST",
          url,
          body: typeof body === "string" ? body : body ?? null,
        };
      const submitRpc = /^(?:YhhmEf|MZZa6b|eb1hJf|nprQif)$/.test(rpc);
      if (submitRpc && process) V(process);
      this.addEventListener("loadend", () => {
        if (!/^(YhhmEf|MZZa6b|eb1hJf|nprQif|jwpduf|as29s)$/.test(rpc)) return;
        let raw = "";
        try { raw = typeof this.responseText === "string" ? this.responseText : ""; } catch {}
        const payload = fbBatchPayload(raw);
        if (submitRpc && process) {
          const unusualActivity = /PUBLIC_ERROR_UNUSUAL_ACTIVITY/i.test(raw);
          if (unusualActivity) {
            window.flowBatchPendingVerificationProcesses =
              window.flowBatchPendingVerificationProcesses.filter(
                (item) => item?.rowId !== process.rowId || Number(item?.attempt) !== Number(process.attempt),
              );
            window.__flowBatchRunLogger?.record?.("submit_explicit_failure", {
              rpc,
              code: "PUBLIC_ERROR_UNUSUAL_ACTIVITY",
              rowId: process.rowId,
              attempt: Number(process.attempt) || 0,
            });
            window.emitter?.emit?.("onSubmitFailure", {
              process,
              message: "Flow 明确拒绝本次提交：异常流量限制（PUBLIC_ERROR_UNUSUAL_ACTIVITY）",
            });
            return;
          }
          const ids = fbSubmitGenerationIds(payload, raw);
          if (ids.length) {
            ids.forEach((id) => E.add(id));
            window.flowBatchPendingVerificationProcesses =
              window.flowBatchPendingVerificationProcesses.filter(
                (item) => item?.rowId !== process.rowId || Number(item?.attempt) !== Number(process.attempt),
              );
            window.__flowBatchRunLogger?.record?.("submit_uuid_captured", {
              rpc,
              generationIds: ids,
              rowId: process.rowId,
              attempt: Number(process.attempt) || 0,
            });
            window.emitter?.emit?.(
              "onSubmitSuccess",
              Object.fromEntries(ids.map((id) => [id, process])),
            );
          } else {
            window.emitter?.emit?.("onSubmitNeedsVerification", {
              process,
              message: "Flow 已接收提交，正在等待真实任务编号",
            });
          }
        }
        if (rpc === "jwpduf" && payload) {
          const status = fbStatusResults(payload);
          const unsettledFailed = {};
          for (const [id, failure] of Object.entries(status.failed)) {
            const transientReason = !fbIsBoundGenerationId(id)
              ? "generation_id_not_bound_yet"
              : fbIsTransientGenerationFailure(failure)
                ? "flow_media_not_visible_yet"
                : "";
            if (transientReason) {
              window.__flowBatchRunLogger?.record?.(
                "result_generation_failure_deferred",
                {
                  generationId: id,
                  status: failure.status,
                  message: failure.message,
                  reason: transientReason,
                },
              );
              continue;
            }
            if (fbSettleGenerationId(id, failure.status))
              unsettledFailed[id] = failure;
          }
          if (Object.keys(unsettledFailed).length)
            window.emitter?.emit?.("onReceiveFailure", unsettledFailed);
          for (const id of status.successful) {
            if (!fbIsBoundGenerationId(id)) {
              window.__flowBatchRunLogger?.record?.(
                "result_generation_success_deferred",
                {
                  generationId: id,
                  reason: "generation_id_not_bound_yet",
                },
              );
              continue;
            }
            fbRequestMediaForGeneration(id);
          }
        }
        const videos = fbVideoResults(raw),
          lookupId = this.__flowBatchGenerationLookupId || "";
        if (Object.keys(videos).length) {
          if (lookupId) {
            if (fbSettleGenerationId(lookupId, "DELIVERED")) {
              const resolved = { [lookupId]: Object.values(videos).flat() };
              R([lookupId]);
              window.emitter?.emit?.("onReceiveData", resolved);
            }
          } else {
            R(Object.keys(videos));
            window.emitter?.emit?.("onReceiveData", videos);
          }
        }
      });
      return nativeSend.apply(this, arguments);
    };
  }
  window.__flowBatchRequestResultReconcile = function () {
    if (fbResultReconcilePromise) return fbResultReconcilePromise;
    fbResultReconcilePromise = (async () => {
      const knownIds = [...new Set(window.flowBatchKnownGenerationIds || [])].filter(
        (id) => !fbTerminalGenerationIds.has(id),
      );
      if (!knownIds.length) return { requested: false, reason: "no_known_ids" };
      window.__flowBatchRunLogger?.record?.("result_reconcile_requested", {
        knownIdCount: knownIds.length,
        transport: fbLastStatusXhr ? "xhr" : fbLastStatusFetch ? "fetch" : "none",
      });
      if (fbLastStatusXhr) {
        const body = fbRewriteRpcBody(
          fbLastStatusXhr.body,
          "jwpduf",
          [null, null, knownIds.map((id) => [id])],
        );
        if (!body) throw new Error("无法按全部未结算 UUID 重建 Flow 状态查询");
        await fbSendRpcXhr(fbLastStatusXhr, body);
        return { requested: true, transport: "xhr" };
      }
      if (fbLastStatusFetch) {
        const response = await window.fetch(
          fbLastStatusFetch.url,
          fbLastStatusFetch.init,
        );
        try {
          response.body?.cancel?.();
        } catch {}
        return { requested: true, transport: "fetch" };
      }
      return { requested: false, reason: "no_status_request_captured" };
    })()
      .catch((error) => {
        window.__flowBatchRunLogger?.record?.("result_reconcile_failed", {
          message: error?.message || String(error),
        });
        return { requested: false, error: error?.message || String(error) };
      })
      .finally(() => {
        fbResultReconcilePromise = null;
      });
    return fbResultReconcilePromise;
  };
  k();
  fbInstallAngularXhrBridge();
})();
