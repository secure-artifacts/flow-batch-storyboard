(function () {
  'use strict';

  const injectTime = performance.now();
  addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "FLOW_BATCH_SAVE_RUN_LOG_V2392") return;
    const { text, filename } = event.data || {};
    if (typeof text !== "string" || typeof filename !== "string") return;
    chrome.runtime.sendMessage({ type: "fbSaveRunLogV2392", text, filename }, () => void chrome.runtime.lastError);
  });
  const requestFlowInjection = () => {
    if (document.getElementById("flow-batch-generate")?.querySelector(".open-dialog-button")) return;
    try {
      chrome.runtime.sendMessage(
        { type: "fbEnsureFlowInjectionV2360" },
        () => void chrome.runtime.lastError,
      );
    } catch {}
  };
  requestFlowInjection();
  addEventListener("DOMContentLoaded", requestFlowInjection, { once: true });
  addEventListener("pageshow", requestFlowInjection);
  addEventListener("__flow_batch_ui_failed_v2360__", requestFlowInjection);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestFlowInjection();
  });
  setTimeout(requestFlowInjection, 1500);
  setTimeout(requestFlowInjection, 5000);
  setInterval(requestFlowInjection, 30000);
  (async () => {
    const { onExecute } = await import(
      /* @vite-ignore */
      chrome.runtime.getURL("assets/index.ts-CASKl1qI.js")
    );
    onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
  })().catch(console.error);

})();
