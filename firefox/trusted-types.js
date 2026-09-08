(function () {
  "use strict";

  if (window.__flowBatchTrustedTypesV2360) return;

  const policyName = "flow-batch-generate-v2360";
  let policy = null;
  let error = "";

  if (window.trustedTypes?.createPolicy) {
    try {
      policy = window.trustedTypes.createPolicy(policyName, {
        createHTML(value) {
          return String(value ?? "");
        },
        createScriptURL(value) {
          return String(value ?? "");
        },
      });
    } catch (reason) {
      error = String(reason?.message || reason || "Trusted Types policy failed");
    }
  }

  const toTrustedHTML = (value) => {
    const text = String(value ?? "");
    return policy ? policy.createHTML(text) : text;
  };

  window.__flowBatchTrustedHTMLV2360 = toTrustedHTML;
  window.__flowBatchTrustedScriptURLV2360 = (value) => {
    const text = String(value ?? "");
    return policy?.createScriptURL ? policy.createScriptURL(text) : text;
  };
  window.__flowBatchSetHTMLV2360 = (element, value) => {
    if (!element) return element;
    element.innerHTML = toTrustedHTML(value);
    return element;
  };
  window.__flowBatchTrustedTypesV2360 = {
    policyName,
    required: !!window.trustedTypes,
    ready: !window.trustedTypes || !!policy,
    error,
  };

  document.documentElement?.setAttribute(
    "data-flow-batch-trusted-types",
    !window.trustedTypes ? "not-required" : policy ? "ready" : "failed",
  );
})();
