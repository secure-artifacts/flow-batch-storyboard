(function () {
  "use strict";

  if (window.__flowBatchAngularDirectCapture?.version === "2.3.126.13") return;

  const state = {
    version: "2.3.126.13",
    installedAt: Date.now(),
    prompt: null,
    project: null,
    composer: null,
    capturedAt: 0,
    factoriesWrapped: 0,
    domScans: 0,
    domContextKind: "",
    captureSource: "",
  };

  function record(event, data = {}) {
    try {
      window.__flowBatchRunLogger?.record?.(`angular_direct:${event}`, data);
    } catch {}
  }

  function isComposer(value) {
    if (!value || typeof value.clear !== "function" || typeof value.mode !== "function")
      return false;
    const dynamicCurrent =
      typeof value.Fe === "function" &&
      typeof value.setAspectRatio === "function" &&
      value.Ne &&
      typeof value.Ne.set === "function" &&
      value.lg &&
      typeof value.lg.set === "function" &&
      value.Va &&
      typeof value.Va.set === "function" &&
      value.Ra &&
      typeof value.Ra.set === "function" &&
      value.ha &&
      typeof value.ha.update === "function";
    const legacy =
      typeof value.yk === "function" &&
      typeof value.Ge === "function" &&
      typeof value.Nc === "function";
    const current =
      typeof value.Fe === "function" &&
      typeof value.setAspectRatio === "function" &&
      typeof value.Ia === "function" &&
      value.ff &&
      typeof value.ff.set === "function" &&
      value.ha &&
      typeof value.ha.update === "function";
    return !!(dynamicCurrent || legacy || current);
  }

  function findComposer(instance) {
    if (!instance || (typeof instance !== "object" && typeof instance !== "function"))
      return null;
    if (isComposer(instance.Ya)) return instance.Ya;
    for (const key of Object.keys(instance)) {
      let value;
      try {
        value = instance[key];
      } catch {
        continue;
      }
      if (isComposer(value)) return value;
    }
    return null;
  }

  function captureInstance(instance, source = "unknown") {
    if (!instance || (typeof instance !== "object" && typeof instance !== "function"))
      return;

    const composer = findComposer(instance);
    if (!composer) return;

    const legacyPrompt =
      typeof instance.submit === "function" &&
      typeof instance.yV === "function" &&
      typeof instance.yk === "function" &&
      instance.Eg &&
      typeof instance.Eg.emit === "function";
    const currentPrompt =
      typeof instance.submit === "function" &&
      typeof instance.Fe === "function" &&
      typeof instance.zk === "function" &&
      instance.Gg &&
      typeof instance.Gg.emit === "function";

    const compatiblePrompt =
      typeof instance.submit === "function" &&
      (typeof instance.yV === "function" || typeof instance.Fe === "function");

    if (legacyPrompt || currentPrompt || compatiblePrompt) {
      const changed = state.prompt !== instance;
      state.prompt = instance;
      state.composer = composer;
      state.capturedAt = Date.now();
      state.captureSource = source;
      if (changed)
        record("prompt_captured", {
          source,
          factoryCount: state.factoriesWrapped,
          composerKeys: Object.keys(composer).slice(0, 80),
        });
      try {
        window.dispatchEvent(new CustomEvent("flow-batch-angular-ready"));
      } catch {}
    }

    if (
      typeof instance.Eg === "function" &&
      instance.Bd &&
      instance.x7
    ) {
      const changed = state.project !== instance;
      state.project = instance;
      state.composer ||= composer;
      if (changed)
        record("project_captured", {
          source,
          factoryCount: state.factoriesWrapped,
        });
    }
  }

  function inspectAngularPatch(root, source) {
    if (!root || (typeof root !== "object" && typeof root !== "function")) return;
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 320 && !state.prompt) {
      const { value, depth } = queue.shift();
      if (!value || (typeof value !== "object" && typeof value !== "function")) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      inspected += 1;
      try {
        captureInstance(value, source);
      } catch {}
      if (state.prompt || depth >= 3) continue;
      if (Array.isArray(value)) {
        for (const item of value) queue.push({ value: item, depth: depth + 1 });
        continue;
      }
      for (const key of ["lView", "component", "context", "hostView", "viewRef"]) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (descriptor && "value" in descriptor)
            queue.push({ value: descriptor.value, depth: depth + 1 });
        } catch {}
      }
    }
  }

  function captureFromElement(element) {
    if (!element) return;
    try {
      const getComponent = window.ng?.getComponent;
      if (typeof getComponent === "function")
        captureInstance(getComponent(element), "angular_debug_api");
    } catch {}
    if (state.prompt) return;
    try {
      const patchKey = Object.getOwnPropertyNames(element).find((key) =>
        key.startsWith("__ngContext__"),
      );
      if (patchKey) {
        const patch = element[patchKey];
        state.domContextKind =
          typeof patch === "number"
            ? "numeric_lview_id"
            : Array.isArray(patch)
              ? "lview_array"
              : patch && typeof patch === "object"
                ? "lcontext_object"
                : typeof patch;
        inspectAngularPatch(patch, "dom_ng_context");
      }
    } catch {}
  }

  function scanDomForExistingPrompt() {
    state.domScans += 1;
    let elements = [];
    try {
      elements = document.querySelectorAll("flow-base-prompt-box");
    } catch {}
    for (const element of elements) {
      captureFromElement(element);
      if (state.prompt) return true;
    }
    return false;
  }

  function wrapFactory(factory) {
    if (typeof factory !== "function" || factory.__flowBatchAngularFactory) return factory;
    function wrappedFactory() {
      const instance = Reflect.apply(factory, this, arguments);
      try {
        captureInstance(instance, "factory");
      } catch {}
      return instance;
    }
    try {
      Object.defineProperty(wrappedFactory, "__flowBatchAngularFactory", {
        value: true,
      });
      Object.defineProperty(wrappedFactory, "name", {
        configurable: true,
        value: factory.name,
      });
    } catch {}
    state.factoriesWrapped += 1;
    return wrappedFactory;
  }

  const originalVa = Object.getOwnPropertyDescriptor(Function.prototype, "va");
  if (!originalVa || originalVa.configurable) {
    try {
      Object.defineProperty(Function.prototype, "va", {
        configurable: true,
        get() {
          return undefined;
        },
        set(factory) {
          Object.defineProperty(this, "va", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: wrapFactory(factory),
          });
        },
      });
      record("factory_capture_installed");
    } catch (error) {
      record("factory_capture_failed", {
        message: error?.message || String(error),
      });
    }
  }

  Object.defineProperty(state, "ready", {
    enumerable: true,
    get() {
      return !!(state.prompt && state.composer);
    },
  });
  state.captureInstance = captureInstance;
  state.scanDom = scanDomForExistingPrompt;
  window.__flowBatchAngularDirectCapture = state;

  const startDomFallback = () => {
    scanDomForExistingPrompt();
    try {
      const observer = new MutationObserver(() => scanDomForExistingPrompt());
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
      state.domObserver = observer;
    } catch {}
  };
  if (document.documentElement) startDomFallback();
  else document.addEventListener("DOMContentLoaded", startDomFallback, { once: true });
  window.addEventListener("pageshow", scanDomForExistingPrompt);
  window.addEventListener("popstate", scanDomForExistingPrompt);
  setInterval(() => {
    if (!state.prompt) scanDomForExistingPrompt();
  }, 1000);
})();
