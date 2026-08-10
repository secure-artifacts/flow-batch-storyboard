import { t as extensionSlug } from "./const-DweaA0In.js";

const REQUEST_TYPE = "__flow_batch_firefox_bridge_request__";
const RESPONSE_TYPE = "__flow_batch_firefox_bridge_response__";

// Background -> page. This keeps the original event protocol used by the UI.
chrome.runtime.onMessage.addListener((message) => {
  if (message.from === extensionSlug) {
    window.postMessage({
      from: message.from,
      payload: message.payload,
      callbackId: message.callbackId,
    });
  }
});

// Page -> content script -> background. Firefox does not expose
// externally_connectable messaging to ordinary web pages, so the isolated
// content-script world acts as the narrow WebExtension API bridge.
window.addEventListener("message", (event) => {
  const data = event.data;
  if (
    event.source !== window ||
    data?.type !== REQUEST_TYPE ||
    data?.source !== extensionSlug ||
    typeof data?.requestId !== "string" ||
    !data?.message ||
    typeof data.message.action !== "string"
  ) {
    return;
  }

  chrome.runtime.sendMessage(data.message, (response) => {
    const lastError = chrome.runtime.lastError;
    window.postMessage({
      type: RESPONSE_TYPE,
      requestId: data.requestId,
      response: lastError
        ? { status: "error", errorMessage: lastError.message }
        : response,
    });
  });
});
