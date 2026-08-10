(() => {
  "use strict";

  const blobUrls = new Map();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== "flow-checkpoint-offscreen") return;

    if (message.action === "createBlobUrl") {
      try {
        const token = crypto.randomUUID();
        const blob = new Blob([String(message.text ?? "")], {
          type: message.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        blobUrls.set(token, url);
        sendResponse({ token, url });
      } catch (error) {
        sendResponse({ error: error?.message || String(error) });
      }
      return;
    }

    if (message.action === "revokeBlobUrl") {
      const url = blobUrls.get(message.token);
      if (url) {
        URL.revokeObjectURL(url);
        blobUrls.delete(message.token);
      }
      sendResponse({ ok: true });
    }
  });
})();
