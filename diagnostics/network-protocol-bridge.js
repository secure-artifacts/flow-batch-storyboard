(() => {
  const OUTPUT_ID = "flow-batch-network-sanitized-output";
  const sync = async () => {
    try {
      const payload = await chrome.runtime.sendMessage({ type: "FLOW_BATCH_READ_SANITIZED_NETWORK" });
      let output = document.getElementById(OUTPUT_ID);
      if (!output) {
        output = document.createElement("script");
        output.type = "application/json";
        output.id = OUTPUT_ID;
        (document.documentElement || document).appendChild(output);
      }
      output.textContent = JSON.stringify({ schemaVersion: 1, observerVersion: "network-1.0.0", capturedAt: new Date().toISOString(), events: payload?.events || [] });
    } catch {}
  };
  sync();
  setInterval(sync, 1000);
})();
