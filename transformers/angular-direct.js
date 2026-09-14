(function () {
  "use strict";
  const VERSION = "3.0.30-current-composer";
  if (window.__flowBatchComposerEvents?.version === VERSION) return;
  const nativeMapSet = Map.prototype.set;
  const lViewRegistries = [];
  function captureMapSet(key, value) {
    try {
      if (typeof key === "number" && Array.isArray(value) && value[19] === key && !lViewRegistries.includes(this)) lViewRegistries.push(this);
    } catch {}
    return nativeMapSet.call(this, key, value);
  }
  Map.prototype.set = captureMapSet;
  setTimeout(() => { if (Map.prototype.set === captureMapSet) Map.prototype.set = nativeMapSet; }, 30000);
  function isComposerStore(value) {
    return !!(value && typeof value === "object" && typeof value.clear === "function" &&
      typeof value.Hk === "function" && typeof value.Ge === "function" &&
      typeof value.setAspectRatio === "function" && typeof value.mode === "function" &&
      typeof value.aspectRatio === "function" && value.prompt);
  }
  function composerCandidate(component) {
    if (!component || typeof component !== "object") return null;
    const store = component.Wa;
    if (!isComposerStore(store) || typeof component.submit !== "function" ||
        typeof component.dW !== "function" || typeof component.Hk !== "function" ||
        typeof component.Ge !== "function" || typeof component.nT !== "function") return null;
    let submitSource = "";
    try { submitSource = Function.prototype.toString.call(component.submit); } catch {}
    if (!/this\.Wa(?:\.|,)/.test(submitSource)) return null;
    // Wa must be a stable identity. A destroyed Flow component can remain in an
    // old LView registry while its Wa getter starts returning replacement stores.
    // Such an object is historical state, never the current submit transaction.
    if (component.Wa !== store) return null;
    return { component, store, score: 40, sameOwner: true,
      submitConsumesStore: true };
  }
  function viewPresence(view) {
    let connected = false, visible = false;
    try {
      for (const value of view.slice(0, 32)) {
        if (!(value instanceof Element) || !value.isConnected) continue;
        connected = true;
        if (value.getClientRects().length && getComputedStyle(value).visibility !== "hidden") visible = true;
      }
    } catch {}
    return { connected, visible };
  }
  function resolveRuntime() {
    let best = null, encounter = 0;
    for (let registryIndex = lViewRegistries.length - 1; registryIndex >= 0; registryIndex -= 1)
      for (const lView of lViewRegistries[registryIndex].values()) {
        let view = lView;
        for (let depth = 0; Array.isArray(view) && depth < 14; depth += 1, view = view[3]) {
          const found = composerCandidate(view[8]);
          if (!found) continue;
          const presence = viewPresence(view), currentEncounter = ++encounter;
          if (!presence.connected) continue;
          const rank = [presence.visible ? 1 : 0, registryIndex, currentEncounter, -depth];
          if (!best || rank.some((value, index) => value !== best.rank[index] &&
              rank.slice(0, index).every((item, prior) => item === best.rank[prior]) && value > best.rank[index]))
            best = { ...found, ...presence, depth, registryIndex, rank };
        }
      }
    if (best && (best.component.Wa !== best.store || !best.sameOwner)) return null;
    return best;
  }
  function mediaRecord(value) {
    if (!value || typeof value !== "object") return null;
    const displayName = String(value.displayName || value.fileName || value.title || "").trim();
    const id = String(value.hb || value.primaryMediaKey || value.mediaId || value.id || "").trim();
    if (!displayName || !/\.(?:jpe?g|jfif|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(displayName)) return null;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(id)) return null;
    const previewUrl = String(value.rb?.Qe || "").trim();
    return { primaryMediaKey: id, displayName, previewUrl, aspectRatio: Number(value.rb?.aspectRatio || value.aspectRatio || 1) || 1, source: "flow-internal-media-store" };
  }
  function listAssets() {
    const found = new Map(), seen = new WeakSet(); let inspected = 0;
    const walk = (value, depth) => {
      if (!value || typeof value !== "object" || seen.has(value) || depth > 7 || inspected++ > 60000) return;
      seen.add(value); const record = mediaRecord(value); if (record) {
        const current = found.get(record.primaryMediaKey);
        found.set(record.primaryMediaKey, current ? {
          ...current,
          ...record,
          previewUrl: current.previewUrl || record.previewUrl || "",
        } : record);
      }
      if (value instanceof Node || value instanceof EventTarget) return;
      let values; try { values = value instanceof Map || value instanceof Set ? [...value.values()] : Object.values(value); } catch { return; }
      for (const child of values.slice(0, 160)) walk(child, depth + 1);
    };
    for (const registry of lViewRegistries) for (const lView of registry.values()) walk(lView?.[8], 0);
    return [...found.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  function diagnostics() {
    const runtime = resolveRuntime(), assets = listAssets();
    return { version: VERSION, ready: !!runtime, registryCount: lViewRegistries.length,
      assetCount: assets.length, mediaSource: "flow-internal-media-store",
      runtime: runtime ? { depth: runtime.depth, score: runtime.score, registryIndex: runtime.registryIndex,
        connected: runtime.connected, visible: runtime.visible,
        sameOwner: runtime.sameOwner, submitConsumesStore: runtime.submitConsumesStore } : null };
  }
  window.__flowBatchComposerEvents = Object.freeze({ version: VERSION, resolveRuntime, listAssets, diagnostics });
  const compatibility = {};
  Object.defineProperties(compatibility, {
    version: { enumerable: true, value: VERSION },
    ready: { enumerable: true, get: () => !!resolveRuntime() },
    prompt: { enumerable: true, get: () => resolveRuntime()?.component || null },
    composer: { enumerable: true, get: () => resolveRuntime()?.store || null },
  });
  compatibility.listAssets = listAssets;
  compatibility.diagnostics = diagnostics;
  // This is the transaction boundary consumed by native-flow-bridge. Expose
  // the exact resolver, not separately-read prompt/composer getters, so the
  // submit owner and its Store are captured atomically from one candidate.
  compatibility.resolveRuntime = resolveRuntime;
  window.__flowBatchAngularDirectCapture = compatibility;
})();
