(function () {
  "use strict";

  const VERSION = "2.3.126.13";
  if (window.__flowBatchNativeBridge?.version === VERSION) return;

  function normalize(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function record(event, data = {}) {
    try {
      window.__flowBatchRunLogger?.record?.(`angular_direct:${event}`, data);
    } catch {}
  }

  function capture() {
    return window.__flowBatchAngularDirectCapture;
  }

  function promptBox() {
    return capture()?.prompt || null;
  }

  function composer() {
    return capture()?.composer || promptBox()?.Ya || null;
  }

  function readSignal(value) {
    try {
      return typeof value === "function" ? value() : value?.value;
    } catch {
      return undefined;
    }
  }

  function writeSignal(value, next, label) {
    if (value && typeof value.set === "function") {
      value.set(next);
      return;
    }
    throw new Error(`Flow 内部${label}接口不可用，请刷新 Flow 页面后重试`);
  }

  async function waitFor(read, timeout, message, stableReads = 1) {
    const deadline = Date.now() + Math.max(500, Number(timeout) || 5000);
    let stable = 0;
    let lastError = null;
    while (Date.now() < deadline) {
      try {
        const value = read();
        if (value) {
          stable += 1;
          if (stable >= stableReads) return value;
        } else stable = 0;
      } catch (error) {
        lastError = error;
        stable = 0;
      }
      await sleep(80);
    }
    throw lastError || new Error(message);
  }

  function isReady() {
    const box = promptBox();
    const store = composer();
    const legacy = !!(
      box &&
      store &&
      typeof box.submit === "function" &&
      typeof box.yV === "function" &&
      typeof store.clear === "function" &&
      typeof store.mode === "function" &&
      typeof store.Nc === "function"
    );
    const current = !!(
      box &&
      store &&
      typeof box.submit === "function" &&
      typeof box.Fe === "function" &&
      typeof box.zk === "function" &&
      typeof store.clear === "function" &&
      typeof store.Fe === "function" &&
      typeof store.mode === "function" &&
      typeof store.Ia === "function"
    );
    const dynamicCurrent = !!(
      box &&
      store &&
      typeof box.submit === "function" &&
      (typeof box.Fe === "function" || typeof store.Fe === "function") &&
      typeof store.clear === "function" &&
      typeof store.mode === "function" &&
      typeof store.setAspectRatio === "function" &&
      store.Ne && typeof store.Ne.set === "function" &&
      store.lg && typeof store.lg.set === "function" &&
      store.Ff && typeof store.Ff.set === "function" &&
      store.Ra && typeof store.Ra.set === "function"
    );
    return legacy || current || dynamicCurrent;
  }

  async function waitUntilReady(timeout = 12000) {
    try {
      await waitFor(
        () => {
          try {
            const state = capture();
            // Keep factory-captured instances while the page initializes.
            state?.scanDom?.();
          } catch {}
          return isReady();
        },
        timeout,
        "新版 Flow 的内部 composer 尚未加载完成",
        2,
      );
      return true;
    } catch {
      return false;
    }
  }

  function externalRestrictionMessage() {
    let text = "";
    try {
      text = Array.from(document.querySelectorAll('[role="alert"], [role="alertdialog"]'))
        .filter(el => !el.closest('.fb-full-modal, #flow-batch-generate, .ant-message, .ant-notification') && el.getClientRects().length)
        .map(el => normalize(el.innerText)).join(' ').slice(0, 12000);
    } catch {}
    const abnormal = text.match(/(?:unusual|suspicious|abnormal)\s+activity|非正常活动|异常活动|可疑活动|偵測到異常|检测到异常/i);
    if (abnormal)
      return "[FLOW_EXTERNAL_ABNORMAL_ACTIVITY] Google Flow 检测到非正常活动，当前限制来自 Google 账号或服务端";
    const limited = text.match(/(?:too many requests|rate.?limit|quota exceeded|resource.?exhausted|请求过于频繁|頻率限制|限流|配额不足|服務繁忙|服务繁忙)/i);
    if (limited)
      return "[FLOW_EXTERNAL_RATE_LIMIT] Google Flow 当前限流或服务繁忙，限制来自 Google 服务端";
    return "";
  }

  function mediaId(value, depth = 0, seen = new WeakSet()) {
    if (value == null || depth > 4) return "";
    if (typeof value === "string")
      return /^[0-9a-f-]{16,}$/i.test(value) ? value : "";
    if (typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    for (const key of ["hb", "id", "Ea", "mediaId", "name"]) {
      const candidate = normalize(value[key]);
      if (/^[0-9a-f-]{16,}$/i.test(candidate)) return candidate;
    }
    for (const key of ["tb", "media", "asset", "metadata"]) {
      const candidate = mediaId(value[key], depth + 1, seen);
      if (candidate) return candidate;
    }
    return "";
  }

  function attachmentIds() {
    const store = composer();
    const list = readSignal(store?.Nc) ?? readSignal(store?.ha);
    return new Set((Array.isArray(list) ? list : []).map((item) => mediaId(item)).filter(Boolean));
  }

  function attachedCount() {
    return attachmentIds().size;
  }

  function diagnostics() {
    const state = capture();
    let promptElements = 0;
    try {
      promptElements = document.querySelectorAll("flow-base-prompt-box").length;
    } catch {}
    return {
      bridgeVersion: VERSION,
      ready: isReady(),
      captureVersion: state?.version || "",
      factoriesWrapped: Number(state?.factoriesWrapped) || 0,
      domScans: Number(state?.domScans) || 0,
      domContextKind: state?.domContextKind || "",
      promptElements,
      captureSource: state?.captureSource || "",
    };
  }

  function promptIsEmpty(store = composer()) {
    try {
      if (typeof store?.Ga === "function") return !!store.Ga();
    } catch {}
    return false;
  }

  async function clearPrompt() {
    const store = composer();
    if (!store || typeof store.clear !== "function")
      throw new Error("Flow 内部 composer 清理接口不可用");
    store.clear();
    await waitFor(
      () => attachedCount() === 0 && promptIsEmpty(store),
      3500,
      "Flow 内部 composer 未能清空",
      2,
    );
    record("composer_cleared");
    return true;
  }

  const MODEL_LABELS = {
    abra: "Omni 1.1 Flash",
    veo_3_1_lite: "Veo 3.1 - Lite",
    veo_3_1_fast: "Veo 3.1 - Fast",
    veo_3_1_quality: "Veo 3.1 - Quality",
    veo_3_1_lite_low_priority: "Veo 3.1 - Lite [Lower Priority]",
  };

  function modelLabel(model) {
    return MODEL_LABELS[normalize(model)] || normalize(model);
  }

  function shallowText(value, depth = 0, seen = new WeakSet()) {
    if (value == null || depth > 3) return "";
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    if (typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    if (Array.isArray(value))
      return value.map((item) => shallowText(item, depth + 1, seen)).join(" ");
    return Object.entries(value)
      .slice(0, 30)
      .map(([key, item]) => `${key} ${shallowText(item, depth + 1, seen)}`)
      .join(" ");
  }

  function modelKey(value) {
    return normalize(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function modelScore(option, requested) {
    const text = modelKey(shallowText(option));
    const id = modelKey(requested);
    const label = modelKey(modelLabel(requested));
    if (!text) return -1;
    if (text.includes(id)) return 100;
    if (text.includes(label)) return 95;
    const tokens =
      {
        abra: ["omni", "11", "flash"],
        veo_3_1_lite: ["veo", "31", "lite"],
        veo_3_1_fast: ["veo", "31", "fast"],
        veo_3_1_quality: ["veo", "31", "quality"],
        veo_3_1_lite_low_priority: ["veo", "31", "lite", "lowerpriority"],
      }[requested] || id.match(/[a-z]+|\d+/g) || [];
    if (requested === "veo_3_1_lite" && /lowerpriority|lowpriority/.test(text)) return 0;
    return tokens.reduce((score, token) => score + (text.includes(token) ? 8 : -20), 0);
  }

  function optionId(option) {
    if (typeof option === "string") return option;
    for (const key of ["id", "value", "familyId", "modelId", "key"]) {
      const value = option?.[key];
      if (typeof value === "string" || typeof value === "number") return value;
    }
    return undefined;
  }

  function resolveModel(store, requested) {
    const options = readSignal(store?.oF) ?? readSignal(store?.Za) ?? readSignal(store?.pF);
    if (!Array.isArray(options) || !options.length)
      throw new Error("Flow 尚未返回可用视频模型，请稍后重试");
    const exact = options.find((option) => String(optionId(option)) === String(requested));
    if (exact) return { id: optionId(exact), option: exact };
    const ranked = options
      .map((option) => ({ option, id: optionId(option), score: modelScore(option, requested) }))
      .filter((item) => item.id != null)
      .sort((left, right) => right.score - left.score);
    if (!ranked.length || ranked[0].score <= 0)
      throw new Error(`Flow 当前账号没有提供“${modelLabel(requested)}”模型`);
    return ranked[0];
  }

  function currentModelId(store) {
    return readSignal(store?.mt) ?? readSignal(store?.Jg) ?? readSignal(store?.Qc);
  }

  function currentDuration(store) {
    return Number(readSignal(store?.IK) ?? readSignal(store?.ob) ?? readSignal(store?.Ra) ?? readSignal(store?.nb));
  }

  async function configure(options) {
    const store = composer();
    if (!store) throw new Error("Flow 内部 composer 不可用");
    const currentApi =
      typeof store.Fe === "function" &&
      store.ff &&
      typeof store.ff.set === "function" &&
      store.Jg &&
      typeof store.Jg.set === "function";
    const dynamicApi =
      store.Ne && typeof store.Ne.set === "function" &&
      store.lg && typeof store.lg.set === "function" &&
      store.Ff && typeof store.Ff.set === "function" &&
      store.Ra && typeof store.Ra.set === "function";
    const mode = options.mode === "VIDEO_FRAMES" ? "VIDEO_FRAMES" : "VIDEO_REFERENCES";
    const ratio = options.aspectRatio === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
    const outputs = Math.min(4, Math.max(1, Number(options.outputs) || 1));
    // Verified against the native x1/x2 radio: Ff is the output count, not Va.
    const composerOutputs = outputs;
    const seconds = Math.min(10, Math.max(4, Number(options.seconds) || 8));
    const requestedModel = normalize(options.model) || "veo_3_1_lite_low_priority";

    writeSignal(dynamicApi ? store.Ne : currentApi ? store.ff : store.Fe, mode, "模式");
    if (typeof store.setAspectRatio !== "function")
      throw new Error("Flow 内部画幅接口不可用");
    store.setAspectRatio(ratio);

    const resolved = resolveModel(store, requestedModel);
    writeSignal(dynamicApi ? store.lg : currentApi ? store.Jg : store.Rf, resolved.id, "模型");
    writeSignal(dynamicApi ? store.Ff : currentApi ? store.Rf : store.ff, composerOutputs, "生成数量");
    writeSignal(store.Ra, seconds, "视频时长");

    await waitFor(
      () => {
        const modeOk = readSignal(store.mode) === mode;
        const ratioOk = readSignal(store.aspectRatio) === ratio;
        const outputsOk = Number(readSignal(dynamicApi ? store.Ff : currentApi ? store.Rf : store.Dp)) === composerOutputs;
        const modelOk = String(currentModelId(store)) === String(resolved.id);
        const durationOptions = readSignal(store.qk) ?? readSignal(store.Pl);
        const selectable =
          !Array.isArray(durationOptions) ||
          durationOptions.some(
            (item) => Number(item?.duration) === seconds && item?.isEnabled !== false,
          );
        const durationOk = !selectable || currentDuration(store) === seconds;
        return modeOk && ratioOk && outputsOk && modelOk && durationOk;
      },
      5500,
      "Flow 内部生成参数未能稳定生效",
      2,
    );

    const durationOptions = readSignal(store.qk) ?? readSignal(store.Pl);
    if (
      Array.isArray(durationOptions) &&
      durationOptions.length &&
      !durationOptions.some(
        (item) => Number(item?.duration) === seconds && item?.isEnabled !== false,
      )
    )
      throw new Error(`Flow 当前模型不支持 ${seconds} 秒`);

    record("composer_configured", {
      mode,
      aspectRatio: ratio,
      outputs,
      composerOutputs,
      seconds,
      requestedModel,
      resolvedModel: String(resolved.id),
    });
    return true;
  }

  function availableAssets() {
    const box = promptBox();
    const assets = readSignal(box?.Ig) ?? readSignal(box?.Lg);
    return Array.isArray(assets) ? assets : [];
  }

  function assetText(asset) {
    for (const value of [
      asset?.displayName,
      asset?.fileName,
      asset?.filename,
      asset?.title,
      asset?.name,
      asset?.tb?.displayName,
      asset?.tb?.fileName,
    ]) {
      const text = normalize(value);
      if (/\.(?:jpe?g|jfif|png|webp|gif|bmp|heic|heif|avif|tiff?|svg)$/i.test(text))
        return text;
    }
    return "";
  }

  function assetPreview(asset) {
    const queue = [{ value: asset, depth: 0 }];
    const seen = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected++ < 400) {
      const { value, depth } = queue.shift();
      if (typeof value === "string") {
        const url = normalize(value);
        if (/^(?:https?:|blob:|data:image\/)/i.test(url)) return url;
        continue;
      }
      if (!value || typeof value !== "object" || seen.has(value) || depth > 5) continue;
      seen.add(value);
      for (const key of Object.keys(value).slice(0, 100)) {
        let child;
        try {
          child = value[key];
          if (typeof child === "function") child = child();
        } catch {
          continue;
        }
        if (typeof child === "string" || (child && typeof child === "object"))
          queue.push({ value: child, depth: depth + 1 });
      }
    }
    return "";
  }

  function listAssets() {
    return availableAssets()
      .map((asset) => ({
        primaryMediaKey: mediaId(asset),
        displayName: assetText(asset),
        previewUrl: assetPreview(asset),
        source: "angular-composer",
      }))
      .filter((asset) => asset.primaryMediaKey && asset.displayName);
  }

  function findAsset(id) {
    const wanted = normalize(id);
    return availableAssets().find((asset) => {
      if (mediaId(asset) === wanted) return true;
      const candidates = [asset?.hb, asset?.id, asset?.Ea, asset?.tb?.id, asset?.tb?.Ea];
      return candidates.some((value) => normalize(value) === wanted);
    });
  }

  async function addImage(image) {
    const id = normalize(image?.imageId);
    if (!id) throw new Error(`${image?.label || "图片"}缺少真实 media ID`);
    const box = promptBox();
    if (!box || (typeof box.yV !== "function" && typeof box.Fe !== "function"))
      throw new Error("Flow 内部挂图接口不可用");
    const asset = await waitFor(
      () => findAsset(id),
      5500,
      `Flow 当前项目中没有读到“${image?.displayName || id}”对应的 media ID`,
    );
    const role = ["FIRST_FRAME", "LAST_FRAME", "REFERENCE"].includes(image?.type)
      ? image.type
      : "REFERENCE";
    const store = composer();
    if (typeof box.yV === "function") {
      box.yV(asset);
    } else {
      const source = asset?.rb || asset?.tb || asset;
      const aspectRatio = Number(source?.aspectRatio || asset?.aspectRatio) || 1;
      const ingredient = {
        ...source,
        id,
        Ea: id,
        mediaType: source?.mediaType || "IMAGE",
        aspectRatio,
        yd: role,
        Dd: role === "REFERENCE" ? undefined : role,
        Nb: new Date(),
      };
      const dynamicPayload =
        store?.Ne && typeof store.Ne.set === "function" &&
        store?.lg && typeof store.lg.set === "function";
      box.Fe(dynamicPayload
        ? { Sb: ingredient, source: "PLUS_BUTTON" }
        : { Tb: ingredient, source: "PLUS_BUTTON" });
    }
    if (typeof box.yV === "function" && store?.ha && typeof store.ha.update === "function")
      store.ha.update((items) =>
        items.map((item) =>
          mediaId(item) === id ? { ...item, Ad: role, Mb: new Date() } : item,
        ),
      );
    await waitFor(
      () => {
        if (!attachmentIds().has(id)) return false;
        const currentStore = composer();
        const items = readSignal(currentStore?.Nc) ?? readSignal(currentStore?.ha);
        const current = Array.isArray(items)
          ? items.find((item) => mediaId(item) === id)
          : null;
        return !current || role === "REFERENCE" || current.yd === role || current.Ad === role || current.Dd === role;
      },
      3500,
      `图片“${image?.displayName || id}”未能直接挂载到 composer`,
      2,
    );
    record("media_attached", {
      imageId: id,
      displayName: normalize(image?.displayName),
      type: normalize(image?.type),
      attachedCount: attachedCount(),
    });
    return true;
  }

  async function setPrompt(text) {
    const value = normalize(text);
    if (!value) throw new Error("分镜提示词为空");
    const box = promptBox();
    const store = composer();
    if (typeof box?.yk === "function") box.yk(value);
    else if (typeof store?.yk === "function") store.yk(value);
    else {
      const editor = document.querySelector("flow-base-prompt-box .ProseMirror");
      if (!(editor instanceof HTMLElement))
        throw new Error("Flow 内部提示词接口不可用");
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (!document.execCommand("insertText", false, value)) {
        editor.textContent = value;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      }
    }
    await waitFor(
      () => !promptIsEmpty(store),
      3000,
      "提示词未能写入 Flow 内部 composer",
      2,
    );
    return true;
  }

  async function prepare(options) {
    if (!(await waitUntilReady())) {
      const restriction = externalRestrictionMessage();
      throw new Error(restriction || "新版 Flow 的内部 composer 暂时重建中");
    }
    const images = Array.isArray(options?.images) ? options.images : [];
    record("prepare_started", {
      imageCount: images.length,
      promptLength: normalize(options?.prompt).length,
    });
    const expectedIds = images.map((image) => normalize(image?.imageId)).filter(Boolean);
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await clearPrompt();
        await configure(options || {});
        for (const image of images) await addImage(image);
        await setPrompt(options?.prompt);
        await waitFor(
          () => {
            const ids = attachmentIds();
            return expectedIds.every((id) => ids.has(id)) && !promptIsEmpty(composer());
          },
          4500,
          "提交前 composer 指纹校验失败",
          2,
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        record("prepare_attempt_failed", {
          attempt,
          maxAttempts: 3,
          message: error?.message || String(error),
          imageIds: expectedIds,
        });
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (lastError) throw lastError;
    record("prepare_complete", {
      imageIds: expectedIds,
      attachedCount: attachedCount(),
    });
    return true;
  }

  async function submit() {
    const box = promptBox();
    const store = composer();
    if (!box || !store) throw new Error("Flow 内部 composer 不可用");
    if (typeof store.Ia === "function" && !store.Ia()) {
      const reason = typeof store.DS === "function" ? normalize(store.DS()) : "";
      throw new Error(reason || "Flow 内部生成条件尚未满足");
    }
    if (typeof box.Xe === "function" && box.Xe())
      throw new Error("Flow 当前仍在处理上一次 composer 提交");
    record("submit_invoked", {
      rowId: window.currentProcess?.rowId || "",
      attempt: Number(window.currentProcess?.attempt) || 0,
      attachedCount: attachedCount(),
    });
    box.submit();
    return true;
  }

  window.__flowBatchNativeBridge = Object.freeze({
    version: VERSION,
    route: "ANGULAR_DIRECT_COMPOSER",
    operationProtection: false,
    isReady,
    waitUntilReady,
    clearPrompt,
    configure,
    addImage,
    setPrompt,
    prepare,
    submit,
    attachedCount,
    diagnostics,
    modelLabel,
    listAssets,
  });
})();
