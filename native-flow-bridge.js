(function () {
  "use strict";

  const VERSION = "3.0.30";
  if (window.__flowBatchNativeBridge?.version === VERSION) return;

  let composerLockTail = Promise.resolve();
  let activeComposerRelease = null;
  let activeComposerWatchdog = 0;
  let activeRuntime = null;
  let activeExpected = null;

  async function acquireComposerLock() {
    let release;
    const previous = composerLockTail;
    composerLockTail = new Promise((resolve) => { release = resolve; });
    await previous;
    activeComposerRelease = release;
    clearTimeout(activeComposerWatchdog);
    activeComposerWatchdog = setTimeout(() => releaseComposerLock("watchdog"), 120000);
  }

  function releaseComposerLock(reason = "complete") {
    clearTimeout(activeComposerWatchdog);
    activeComposerWatchdog = 0;
    const release = activeComposerRelease;
    activeComposerRelease = null;
    activeRuntime = null;
    activeExpected = null;
    release?.();
    record("composer_lock_released", { reason });
  }

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
    return activeRuntime?.component || capture()?.prompt || null;
  }

  function composer() {
    return activeRuntime?.store || promptBox()?.Wa || null;
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
    return !!(
      box && store &&
      typeof box.submit === "function" && typeof box.dW === "function" &&
      typeof store.clear === "function" && typeof store.Hk === "function" &&
      typeof store.Ge === "function" && typeof store.setAspectRatio === "function" &&
      store.Gf?.set && store.nh?.set && store.ng?.set && store.Ra?.set
    );
  }

  async function waitUntilReady(timeout = 12000) {
    try {
      await waitFor(
        () => {
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
    if (value == null || depth > 7) return "";
    if (typeof value === "string")
      return /^[0-9a-f-]{16,}$/i.test(value) ? value : "";
    if (typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);
    for (const key of ["hb", "id", "Ea", "mediaId", "name"]) {
      const candidate = normalize(value[key]);
      if (/^[0-9a-f-]{16,}$/i.test(candidate)) return candidate;
    }
    for (const child of Object.values(value)) {
      const candidate = mediaId(child, depth + 1, seen);
      if (candidate) return candidate;
    }
    return "";
  }

  function attachmentIds() {
    return new Set(attachmentSnapshot().map((item) => item.id));
  }

  function attachmentSnapshot() {
    const list = readSignal(composer()?.ma);
    return (Array.isArray(list) ? list : []).map((item) => ({
      id: mediaId(item),
      role: normalize(item?.Hd),
    })).filter((item) => item.id);
  }

  function attachedCount() {
    return attachmentIds().size;
  }

  function diagnostics() {
    const state = capture();
    return {
      bridgeVersion: VERSION,
      ready: isReady(),
      captureVersion: state?.version || "",
      factoriesWrapped: Number(state?.factoriesWrapped) || 0,
      domScans: Number(state?.domScans) || 0,
      domContextKind: state?.domContextKind || "",
      captureSource: state?.captureSource || "",
      runtime: state?.diagnostics?.()?.runtime || null,
      registryCount: state?.diagnostics?.()?.registryCount || 0,
    };
  }

  function promptIsEmpty(store = composer()) {
    try {
      if (typeof store?.prompt?.Df === "function") return !!store.prompt.Df();
      if (typeof store?.Ga === "function") return !!store.Ga();
    } catch {}
    throw new Error("Flow 内部提示词状态接口不可用");
  }

  async function clearPrompt() {
    const store = composer();
    if (!store || typeof store.clear !== "function")
      throw new Error("Flow 内部 Composer 清理接口不可用；已安全停止");
    store.clear();
    await waitFor(
      () => promptIsEmpty(store),
      3500,
      "Flow 内部 composer 未能清空",
      2,
    );
    await waitFor(
      () => attachmentIds().size === 0,
      5000,
      "Flow Composer 的旧图片未清空；已阻止继续提交，避免串图",
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
    for (const key of ["Sg", "id", "value", "familyId", "modelId", "key"]) {
      const value = option?.[key];
      if (typeof value === "string" || typeof value === "number") return value;
    }
    return undefined;
  }

  function resolveModel(store, requested) {
    const options = readSignal(store?.QF) ?? readSignal(store?.oF) ?? readSignal(store?.Za) ?? readSignal(store?.pF);
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

  async function configure(options) {
    const store = composer();
    if (!store?.Gf?.set || !store?.nh?.set || !store?.ng?.set || !store?.Ra?.set ||
        typeof store.setAspectRatio !== "function")
      throw new Error("Flow 内部 Composer 参数接口不可用；已安全停止");
    const mode = options.mode === "VIDEO_FRAMES" ? "VIDEO_FRAMES" : "VIDEO_REFERENCES";
    const ratio = options.aspectRatio === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
    const outputs = Math.min(4, Math.max(1, Number(options.outputs) || 1));
    const seconds = Math.min(10, Math.max(4, Number(options.seconds) || 8));
    const requestedModel = normalize(options.model) || "veo_3_1_lite_low_priority";
    const resolved = resolveModel(store, requestedModel);
    writeSignal(store.Gf, mode, "模式");
    store.setAspectRatio(ratio);
    writeSignal(store.nh, resolved.id, "模型");
    writeSignal(store.ng, outputs, "生成数量");
    writeSignal(store.Ra, seconds, "视频时长");
    const supportedDurations = readSignal(store.Um);
    if (Array.isArray(supportedDurations) && supportedDurations.length &&
        !supportedDurations.some((item) => Number(item?.duration) === seconds && item?.isEnabled !== false))
      throw new Error(`Flow 当前模型不支持 ${seconds} 秒`);
    await waitFor(() =>
      readSignal(store.mode) === mode &&
      readSignal(store.aspectRatio) === ratio &&
      Number(readSignal(store.ng)) === outputs &&
      String(readSignal(store.nh)) === String(resolved.id) &&
      Number(readSignal(store.Ra)) === seconds,
      5500, "Flow 内部生成参数未能稳定生效", 2);
    record("composer_configured", { mode, aspectRatio: ratio, outputs, seconds,
      requestedModel, resolvedModel: String(resolved.id), runtime: "lview" });
    return true;
  }

  function expectedState(options, expectedAttachments) {
    return {
      mode: options.mode === "VIDEO_FRAMES" ? "VIDEO_FRAMES" : "VIDEO_REFERENCES",
      aspectRatio: options.aspectRatio === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
      outputs: Math.min(4, Math.max(1, Number(options.outputs) || 1)),
      seconds: Math.min(10, Math.max(4, Number(options.seconds) || 8)),
      model: normalize(options.resolvedModel),
      attachments: expectedAttachments.map((item) => ({ ...item })),
    };
  }

  function stateMatches(expected) {
    const store = composer();
    const actualAttachments = attachmentSnapshot();
    return !!store &&
      readSignal(store.mode) === expected.mode &&
      readSignal(store.aspectRatio) === expected.aspectRatio &&
      Number(readSignal(store.ng)) === expected.outputs &&
      String(readSignal(store.nh)) === String(expected.model) &&
      Number(readSignal(store.Ra)) === expected.seconds &&
      !promptIsEmpty(store) &&
      actualAttachments.length === expected.attachments.length &&
      expected.attachments.every((item, index) =>
        actualAttachments[index]?.id === item.id && actualAttachments[index]?.role === item.role);
  }

  async function verifyCompleteState(expected, phase) {
    await waitFor(
      () => stateMatches(expected),
      4500,
      `${phase}完整参数、提示词或媒体顺序反读不一致；已安全停止`,
      2,
    );
    record("complete_state_verified", { phase, ...expected });
  }

  function listAssets() {
    const assets = capture()?.listAssets?.();
    if (!Array.isArray(assets))
      throw new Error("Flow 内部媒体 Store 尚未就绪；不会使用 DOM 或弹层备胎");
    return assets;
  }

  async function addImage(image) {
    const id = normalize(image?.imageId);
    if (!id) throw new Error(`${image?.label || "图片"}缺少真实 media ID`);
    const box = promptBox();
    const store = composer();
    if (typeof box?.dW !== "function" || typeof store?.Ge !== "function")
      throw new Error("Flow 内部 Composer 挂图接口不可用；不会启用素材弹层或 DOM 兜底");
    box.dW({ hb: id, rb: { aspectRatio: Number(image?.aspectRatio) || 1 } });
    const expectedRole = normalize(image?.type) || "REFERENCE";
    await waitFor(
      () => attachmentSnapshot().some((item) => item.id === id && item.role === expectedRole),
      3500,
      `图片“${image?.displayName || id}”未以 ${expectedRole} 角色写入 Flow Composer`,
      2,
    );
    record("media_attached", {
      imageId: id,
      displayName: normalize(image?.displayName),
      type: normalize(image?.type),
      attachedCount: attachedCount(),
      runtime: "lview",
    });
    return true;
  }

  async function setPrompt(text) {
    const value = normalize(text);
    if (!value) throw new Error("分镜提示词为空");
    const box = promptBox();
    const store = composer();
    if (typeof store?.Hk === "function") store.Hk({ Fg: [{ content: value, type: "text" }] });
    else if (typeof box?.yk === "function") box.yk(value);
    else if (typeof store?.yk === "function") store.yk(value);
    else throw new Error("Flow 内部 Composer 提示词接口不可用；已安全停止");
    await waitFor(
      () => !promptIsEmpty(store),
      3000,
      "提示词未能写入 Flow 内部 composer",
      2,
    );
    return true;
  }

  async function prepare(options) {
    record("internal_store_submit_path_selected");
    if (!(await waitUntilReady())) {
      const restriction = externalRestrictionMessage();
      throw new Error(restriction || "新版 Flow 的内部 composer 暂时重建中");
    }
    const images = Array.isArray(options?.images) ? options.images : [];
    const requestedIds = images.map((image) => normalize(image?.imageId));
    if (requestedIds.some((id) => !id))
      throw new Error("任务图片缺少真实 media ID；已阻止提交");
    if (new Set(requestedIds).size !== requestedIds.length)
      throw new Error("同一任务包含重复 media ID；已阻止提交以避免首尾帧或参考图串位");
    await acquireComposerLock();
    const runtime = capture()?.resolveRuntime?.();
    if (!runtime?.component || !runtime?.store || runtime.component.Wa !== runtime.store ||
        runtime.submitConsumesStore !== true) {
      releaseComposerLock("runtime_owner_mismatch");
      throw new Error("Flow 当前提交框与参数 Store 不是同一业务实例；已阻止提交");
    }
    activeRuntime = runtime;
    document.documentElement.classList.add("flow-batch-composer-busy");
    record("prepare_started", {
      imageCount: images.length,
      promptLength: normalize(options?.prompt).length,
      sameOwner: true,
      connected: runtime.connected === true,
      visible: runtime.visible === true,
      registryIndex: runtime.registryIndex,
      depth: runtime.depth,
    });
    const expected = images.map((image) => ({
      id: normalize(image.imageId),
      role: normalize(image.type) || "REFERENCE",
    }));
    const expectedIds = expected.map((item) => item.id);
    let lastError = null;
    try {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
        await clearPrompt();
        const configured = options || {};
        const requestedModel = normalize(configured.model) || "veo_3_1_lite_low_priority";
        const resolvedModel = resolveModel(composer(), requestedModel).id;
        await configure(configured);
        for (const image of images) {
          await addImage(image);
        }
        await setPrompt(options?.prompt);
        activeExpected = expectedState({ ...configured, resolvedModel }, expected);
        await verifyCompleteState(activeExpected, "第一遍");
        lastError = null;
        break;
        } catch (error) {
          lastError = error;
          record("prepare_attempt_failed", {
            attempt,
            maxAttempts: 5,
            message: error?.message || String(error),
            imageIds: expectedIds,
          });
          if (attempt < 5)
            await new Promise((resolve) => setTimeout(resolve, 700 + attempt * 300));
        }
      }
      if (lastError) throw lastError;
      record("prepare_complete", {
        imageIds: expectedIds,
        attachedCount: attachedCount(),
      });
      return true;
    } catch (error) {
      releaseComposerLock("prepare_failed");
      throw error;
    } finally {
      document.documentElement.classList.remove("flow-batch-composer-busy");
    }
  }

  async function submit() {
    try {
    const box = promptBox();
    const store = composer();
    if (!activeRuntime || box !== activeRuntime.component || store !== activeRuntime.store ||
        box.Wa !== store || activeRuntime.submitConsumesStore !== true)
      throw new Error("提交前同源 Composer 绑定已失效；已安全停止");
    if (!box || !store || typeof box.submit !== "function")
      throw new Error("Flow 内部 Composer 提交接口不可用；已安全停止且未扣轮次");
    if (typeof store.Ia === "function" && !store.Ia()) {
      const reason = typeof store.DS === "function" ? normalize(store.DS()) : "";
      throw new Error(reason || "Flow 内部生成条件尚未满足");
    }
    if (typeof box.Xe === "function" && box.Xe())
      throw new Error("Flow 当前仍在处理上一次 composer 提交");
    if (!activeExpected)
      throw new Error("提交前完整参数快照不存在；已安全停止");
    await verifyCompleteState(activeExpected, "第二遍");
    record("submit_invoked", {
      rowId: window.currentProcess?.rowId || "",
      attempt: Number(window.currentProcess?.attempt) || 0,
      attachedCount: attachedCount(),
    });
    box.submit();
    releaseComposerLock("submitted_internal");
    return true;
    } catch (error) {
      releaseComposerLock("submit_failed");
      throw error;
    }
  }

  window.__flowBatchNativeBridge = Object.freeze({
    version: VERSION,
    route: "ANGULAR_DIRECT_COMPOSER",
    operationProtection: true,
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
