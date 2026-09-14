import { n as e, r as t, t as n } from "./const-DweaA0In.js";
var r = {
    type: `array`,
    items: {
      type: `object`,
      propreties: { name: { type: `string` }, content: { type: `string` } },
      required: [`name`, `content`],
    },
    default: [],
  },
  i = {
    interval: 1,
    intervalRandom: 0,
    videoModel: `veo_3_1_lite_low_priority`,
    aspectRatio: `PORTRAIT`,
    outputsPerPrompt: 1,
    downloadFolder: ``,
    autoRetry: !0,
    download: !0,
  },
  a = {
    task: {
      type: `object`,
      additionalProperties: !0,
      default: {},
      required: [],
    },
    preset: r,
    settings: {
      type: `object`,
      properties: Object.entries(i).reduce(
        (e, [t, n]) => ((e[t] = { type: typeof n, default: n }), e),
        {},
      ),
      required: Object.keys(i),
      default: i,
    },
    taskRecord: {
      type: `object`,
      additionalProperties: !0,
      default: {},
      required: [],
    },
  };
function fbIsFlowMediaRedirectUrl(e) {
  try {
    const t = new URL(String(e || ``));
    return (
      [`https://labs.google`, `https://flow.google.com`].includes(t.origin) &&
      t.pathname.includes(`/fx/api/trpc/media.getMediaUrlRedirect`)
    );
  } catch {
    return !1;
  }
}
async function fbResolveFlowMediaRedirect(e, t) {
  const n = String(e || ``);
  if (!fbIsFlowMediaRedirectUrl(n)) return { url: n, resolved: !1 };
  if (!Number.isInteger(t))
    throw Error(`无法确定当前 Flow 标签页，不能取得视频下载授权`);
  return await new Promise((e, r) => {
    let i = !1,
      a = ``,
      o;
    const s = () => {
        (chrome.webRequest.onBeforeRedirect.removeListener(l),
          clearTimeout(o));
      },
      c = (t, n) => {
        if (i) return;
        ((i = !0), s(), n ? r(n) : e(t));
      },
      l = (e) => {
        if (i || e.tabId !== t) return;
        if (!a) {
          if (e.url !== n) return;
          a = e.requestId;
        }
        if (e.requestId !== a) return;
        const r = String(e.redirectUrl || ``);
        if (!r) return;
        let o;
        try {
          o = new URL(r);
        } catch {
          return;
        }
        if (
          o.hostname === `accounts.google.com` ||
          o.pathname.includes(`/ServiceLogin`)
        )
          return c(
            null,
            Error(`Flow 登录已过期，请刷新 Flow 页面并重新登录后再下载`),
          );
        ![`https://labs.google`, `https://flow.google.com`].includes(o.origin) &&
          c({ url: r, resolved: !0, statusCode: e.statusCode });
      };
    (chrome.webRequest.onBeforeRedirect.addListener(l, {
      urls: [`https://labs.google/*`, `https://flow.google.com/*`],
    }),
      (o = setTimeout(
        () =>
          c(
            null,
            Error(
              `未能从 Flow 取得视频签名地址。请确认页面仍保持登录，然后刷新页面重试`,
            ),
          ),
        2e4,
      )),
      chrome.scripting
        .executeScript({
          target: { tabId: t },
          world: `MAIN`,
          func: (e) => {
            const t = new AbortController(),
              n = setTimeout(() => t.abort(), 15e3);
            fetch(e, {
              method: `GET`,
              credentials: `include`,
              redirect: `follow`,
              cache: `no-store`,
              referrer: location.href,
              signal: t.signal,
            })
              .then((e) => {
                try {
                  e.body?.cancel();
                } catch {}
              })
              .catch(() => {})
              .finally(() => clearTimeout(n));
          },
          args: [n],
        })
        .catch((e) =>
          c(
            null,
            Error(
              `无法在当前 Flow 页面取得视频授权：${e?.message || String(e)}`,
            ),
          ),
        ));
  });
}
const fbDownloadLedgerKey = `fbDownloadLedgerV2358`;
let fbDownloadLedgerLock = Promise.resolve();
const fbDownloadSingleFlights = new Map();
function fbReadDownloadLedger() {
  return new Promise((e) => {
    chrome.storage.local.get(fbDownloadLedgerKey, (t) =>
      e(t?.[fbDownloadLedgerKey] || {}),
    );
  });
}
function fbUpdateDownloadLedger(e, t) {
  const n = fbDownloadLedgerLock
    .catch(() => {})
    .then(async () => {
      const n = await fbReadDownloadLedger(),
        r = { ...n, [e]: { ...(n[e] || {}), ...t, ledgerKey: e } };
      const entries = Object.entries(r);
      if (entries.length > 800)
        entries
          .sort(
            ([, a], [, b]) =>
              Number(b.completedAt || b.finishedAt || b.requestedAt) -
              Number(a.completedAt || a.finishedAt || a.requestedAt),
          )
          .slice(500)
          .forEach(([key]) => delete r[key]);
      await new Promise((e) =>
        chrome.storage.local.set({ [fbDownloadLedgerKey]: r }, e),
      );
      return r[e];
    });
  return ((fbDownloadLedgerLock = n), n);
}
function fbDownloadLedgerEntryKey(e, t, n = ``) {
  const identity = String(n || ``).trim();
  return identity ? `media:${identity}` : `${e}\n${t || ``}`;
}
async function fbGetDownloadState(e, t, i = ``) {
  const r = fbDownloadLedgerEntryKey(e, t, i),
    ledger = await fbReadDownloadLedger();
  let n = ledger?.[r];
  if (!n && i) {
    const legacyEntry = ledger?.[fbDownloadLedgerEntryKey(e, t)];
    if (legacyEntry) {
      n = await fbUpdateDownloadLedger(r, {
        ...legacyEntry,
        stableIdentity: String(i),
        migratedAt: Date.now(),
      });
    }
  }
  if (
    n?.state === `preparing` &&
    Date.now() - Number(n.requestedAt || 0) < 30 * 60 * 1e3
  )
    return n;
  if (!n?.id) return { state: `missing`, filename: e };
  try {
    const t = (await chrome.downloads.search({ id: n.id }))?.[0];
    if (!t)
      return await fbUpdateDownloadLedger(r, {
        id: 0,
        state: `missing`,
        error: `浏览器中已找不到原下载任务`,
        finishedAt: Date.now(),
      });
    if (t?.state === `complete`)
      return await fbUpdateDownloadLedger(r, {
        state: `complete`,
        actualFilename: t.filename || n.actualFilename || ``,
        completedAt: n.completedAt || Date.now(),
      });
    if (t?.state === `interrupted`)
      return await fbUpdateDownloadLedger(r, {
        state: `interrupted`,
        error: t.error || n.error || `浏览器下载被中断`,
        finishedAt: Date.now(),
      });
    if (t?.state === `in_progress`)
      return { ...n, state: `in_progress` };
  } catch {}
  return n;
}
async function fbStartTrackedDownloadOnce(e, t, n = e, i = ``) {
  try {
    const requestedFilename = t.replace(/\/+/g, `/`),
      stableSourceUrl = String(n || e),
      stableIdentity = String(i || ``).trim(),
      ledgerEntryKey = fbDownloadLedgerEntryKey(
        requestedFilename,
        stableSourceUrl,
        stableIdentity,
      );
    const existing = await fbGetDownloadState(
      requestedFilename,
      stableSourceUrl,
      stableIdentity,
    );
    if ([`complete`, `in_progress`, `preparing`].includes(existing?.state))
      return existing;
    await fbUpdateDownloadLedger(ledgerEntryKey, {
      id: 0,
      state: `preparing`,
      requestedFilename,
      sourceUrl: stableSourceUrl,
      stableIdentity,
      requestedAt: Date.now(),
      error: ``,
    });
    const downloadId = await chrome.downloads.download({
      url: e,
      filename: requestedFilename,
      conflictAction: `uniquify`,
      saveAs: !1,
    });
    if (downloadId == null) {
      await fbUpdateDownloadLedger(ledgerEntryKey, {
        state: `interrupted`,
        error: `浏览器没有创建下载任务`,
        finishedAt: Date.now(),
      });
      return { error: `浏览器没有创建下载任务` };
    }
    return await fbUpdateDownloadLedger(ledgerEntryKey, {
      id: downloadId,
      state: `in_progress`,
      requestedFilename,
      sourceUrl: stableSourceUrl,
      stableIdentity,
      downloadUrl: e,
      requestedAt: Date.now(),
      error: ``,
    });
  } catch (e) {
    const requestedFilename = t.replace(/\/+/g, `/`),
      ledgerEntryKey = fbDownloadLedgerEntryKey(requestedFilename, n, i);
    await fbUpdateDownloadLedger(ledgerEntryKey, {
      state: `interrupted`,
      error: e.message,
      finishedAt: Date.now(),
    }).catch(() => {});
    return (console.error(`创建下载任务出现错误：`, e), { error: e.message });
  }
}
async function fbStartTrackedDownload(e, t, n = e, i = ``) {
  const requestedFilename = t.replace(/\/+/g, `/`),
    ledgerEntryKey = fbDownloadLedgerEntryKey(requestedFilename, n, i);
  if (fbDownloadSingleFlights.has(ledgerEntryKey))
    return fbDownloadSingleFlights.get(ledgerEntryKey);
  const operation = fbStartTrackedDownloadOnce(e, t, n, i).finally(() => {
    fbDownloadSingleFlights.get(ledgerEntryKey) === operation &&
      fbDownloadSingleFlights.delete(ledgerEntryKey);
  });
  fbDownloadSingleFlights.set(ledgerEntryKey, operation);
  return operation;
}
async function o(e, t, n = e) {
  try {
    const started = await fbStartTrackedDownload(e, t, n);
    if (started?.error || started?.state === `complete`) return started;
    const downloadId = started?.id,
      ledgerEntryKey = started?.ledgerKey;
    if (downloadId == null || !ledgerEntryKey)
      return { error: `浏览器没有创建可跟踪的下载任务` };
    return await new Promise((e) => {
      let t = !1,
        r = !1,
        i,
        a;
      const o = () => {
          (chrome.downloads.onChanged.removeListener(c),
            clearInterval(i),
            clearTimeout(a));
        },
        s = (n) => {
          if (t) return;
          ((t = !0),
            o(),
            fbUpdateDownloadLedger(ledgerEntryKey, {
              ...n,
              actualFilename: n.filename || ``,
              completedAt: n.state === `complete` ? Date.now() : 0,
              finishedAt: n.error ? Date.now() : 0,
            }).finally(() => e(n)));
        },
        l = async () => {
          if (t || r) return;
          r = !0;
          try {
            const e = (await chrome.downloads.search({ id: downloadId }))?.[0];
            e?.state === `complete`
              ? s({ id: downloadId, state: `complete`, filename: e.filename || `` })
              : e?.state === `interrupted` &&
                s({ id: downloadId, state: `interrupted`, error: e.error || `浏览器下载被中断` });
          } catch {}
          finally {
            r = !1;
          }
        },
        c = (e) => {
          if (e.id !== downloadId) return;
          if (e.state?.current === `complete`) return void l();
          e.state?.current === `interrupted` &&
            s({
              id: downloadId,
              state: `interrupted`,
              error: e.error?.current || `浏览器下载被中断`,
            });
        };
      (chrome.downloads.onChanged.addListener(c),
        (i = setInterval(l, 1e3)),
        (a = setTimeout(
          async () => {
            (await l(),
              t ||
                s({
                  id: downloadId,
                  state: `interrupted`,
                  error: `等待浏览器下载完成超时`,
                }));
          },
          30 * 60 * 1e3,
        )),
        l());
    });
  } catch (e) {
    return (console.error(`下载文件出现错误：`, e), { error: e.message });
  }
}
let fbCheckpointOffscreenCreating = null;
async function fbEnsureCheckpointOffscreen() {
  if (!chrome.offscreen?.createDocument)
    throw Error(`当前浏览器不支持扩展离屏文档，无法生成本地断点文件`);
  const e = chrome.runtime.getURL(`offscreen.html`),
    t = await chrome.runtime.getContexts({
      contextTypes: [`OFFSCREEN_DOCUMENT`],
      documentUrls: [e],
    });
  if (t.length) return;
  if (!fbCheckpointOffscreenCreating)
    fbCheckpointOffscreenCreating = chrome.offscreen
      .createDocument({
        url: `offscreen.html`,
        reasons: [`BLOBS`],
        justification: `把用户主动保存的 Flow 断点 JSON 转为可下载的 Blob 文件`,
      })
      .finally(() => {
        fbCheckpointOffscreenCreating = null;
      });
  await fbCheckpointOffscreenCreating;
}
async function fbCreateDownloadBlob(e, t) {
  if (typeof URL?.createObjectURL === `function`) {
    const n = URL.createObjectURL(new Blob([e], { type: t }));
    return { url: n, revoke: () => URL.revokeObjectURL(n) };
  }
  await fbEnsureCheckpointOffscreen();
  const n = await chrome.runtime.sendMessage({
    target: `flow-checkpoint-offscreen`,
    action: `createBlobUrl`,
    text: e,
    mimeType: t,
  });
  if (!n?.url) throw Error(n?.error || `离屏文档未返回断点文件地址`);
  return {
    url: n.url,
    revoke: () =>
      chrome.runtime
        .sendMessage({
          target: `flow-checkpoint-offscreen`,
          action: `revokeBlobUrl`,
          token: n.token,
        })
        .catch(() => {}),
  };
}
async function fbDownloadText(e, t, n = `text/plain;charset=utf-8`) {
  if (typeof e !== `string`) throw Error(`要保存的断点内容不是文本`);
  const r = await fbCreateDownloadBlob(e, n);
  try {
    return await o(r.url, t);
  } finally {
    await r.revoke();
  }
}
const fbKeepAwakeTabs = new Set();
chrome.runtime.onMessage.addListener((e, t, n) => {
  if (e?.type !== `fbSaveRunLogV2392`) return;
  fbDownloadText(String(e.text || ``), String(e.filename || `Flow断点及日志_2.3.126.json`), `application/json;charset=utf-8`)
    .then((e) => n?.({ ok: !e?.error, result: e }))
    .catch((e) => n?.({ ok: !1, error: String(e?.message || e) }));
  return !0;
});
function fbRefreshKeepAwake() {
  try {
    if (!chrome.power?.requestKeepAwake) return !1;
    fbKeepAwakeTabs.size
      ? chrome.power.requestKeepAwake(`system`)
      : chrome.power.releaseKeepAwake();
    return !0;
  } catch (e) {
    return (console.debug(`Flow 防休眠状态切换失败`, e), !1);
  }
}
function fbDropKeepAwakeTab(e) {
  fbKeepAwakeTabs.delete(e) && fbRefreshKeepAwake();
}
function fbIsSupportedFlowProjectUrl(e) {
  try {
    const t = new URL(String(e || ``));
    return (
      (t.origin === `https://labs.google` &&
        t.pathname.startsWith(`/fx/zh/tools/flow`)) ||
      (t.origin === `https://flow.google.com` &&
        t.pathname.startsWith(`/project/`))
    );
  } catch {
    return !1;
  }
}
chrome.tabs.onRemoved.addListener(fbDropKeepAwakeTab);
chrome.tabs.onUpdated.addListener((e, t) => {
  t.url && !fbIsSupportedFlowProjectUrl(t.url) &&
    fbDropKeepAwakeTab(e);
});
var s = class {
  listeners = {};
  tabs = [];
  slug;
  isDebugger;
  callbackMap = new Map();
  constructor(e, t) {
    ((this.slug = e),
      (this.isDebugger = !!t),
      this.bindMessage(),
      this.bindEvent());
  }
  on(e, t) {
    if (this.listeners[e])
      throw Error(`event listener ${String(e)} already exist!`);
    return (
      (this.listeners[e] = t),
      () => {
        delete this.listeners[e];
      }
    );
  }
  async send(e, ...t) {
    this.isDebugger &&
      console.log(`发送消息`, { action: e, payload: t, tabs: this.tabs });
    for (let n of this.tabs)
      try {
        let r = await chrome.tabs.get(n);
        r && r.id
          ? chrome.tabs.sendMessage(r.id, {
              from: this.slug,
              payload: { action: e, payload: t },
            })
          : this.deleteTabById(n);
      } catch (e) {
        (console.log(e), this.deleteTabById(n));
      }
  }
  async sendWithCallback(e, t, ...n) {
    let r = c();
    (this.callbackMap.set(r, t),
      this.isDebugger &&
        console.log(`发送消息`, { action: e, payload: n, tabs: this.tabs }));
    for (let t of this.tabs)
      try {
        let i = await chrome.tabs.get(t);
        i && i.id
          ? chrome.tabs.sendMessage(i.id, {
              from: this.slug,
              payload: { action: e, payload: n },
              callbackId: r,
            })
          : this.deleteTabById(t);
      } catch (e) {
        (console.log(e), this.deleteTabById(t));
      }
  }
  async sendByTabId(e, t, ...n) {
    this.isDebugger &&
      console.log(`发送消息（指定 tabId）`, {
        tabId: e,
        action: t,
        payload: n,
      });
    let r = c();
    return new Promise((i, a) => {
      (this.callbackMap.set(r, function (e) {
        i(e);
      }),
        chrome.tabs
          .get(e)
          .then((i) => {
            i && i.id
              ? chrome.tabs.sendMessage(i.id, {
                  from: this.slug,
                  payload: { action: t, payload: n },
                  callbackId: r,
                })
              : this.deleteTabById(e);
          })
          .catch((t) => {
            (console.log(t), this.deleteTabById(e));
          }));
    });
  }
  bindMessage() {
    chrome.runtime.onMessageExternal.addListener((e, t, n) => {
      if (t?.tab?.id) {
        if (
          (this.isDebugger &&
            console.log(`收到消息`, { request: e, sender: t }),
          e.action === `__connect`)
        )
          return (
            this.tabs.includes(t.tab.id) || this.tabs.push(t.tab.id),
            n()
          );
        if (e.action === `__disconnect`)
          return (this.deleteTabById(t.tab.id), n());
        if (e.action === `__callback`) {
          let {
            callbackId: r,
            result: i,
            errorMessage: a,
            status: o,
          } = e.payload;
          return (
            o === `error`
              ? console.error(a)
              : this.callbackMap.has(r) && this.callbackMap.get(r)?.(i, t),
            n()
          );
        }
        if (this.listeners[e.action])
          return t?.tab?.id
            ? (this.tabs.includes(t.tab.id) || this.tabs.push(t.tab.id),
              this.listeners[e.action]
                .bind({ request: e, sender: t })(...e.payload)
                .then((r) => {
                  (this.isDebugger &&
                    console.log(`send to callback from background`, {
                      request: e,
                      sender: t,
                      res: r,
                    }),
                    n({ status: `success`, result: r }));
                })
                .catch((e) => {
                  (console.error(e),
                    n({ status: `error`, errorMessage: e.toString() }));
                }),
              !0)
            : n();
      }
    });
  }
  bindEvent() {
    chrome.tabs.onRemoved.addListener((e) => {
      this.deleteTabById(e);
    });
  }
  deleteTabById(e) {
    if (this.tabs.includes(e)) {
      let t = this.tabs.indexOf(e);
      this.tabs.splice(t, 1);
    }
  }
};
function c() {
  return (
    new Date().getTime().toString() +
    Math.random().toString(36).substring(2, 15)
  );
}
function l(e, t) {
  Object.keys(e).map((n) => t(e[n], n, e));
}
function u(e, t) {
  function n(e, t) {
    switch (e.type) {
      case `object`:
        return r(e, t);
      case `array`:
        return i(e, t);
      default:
        return t === void 0 ? (e.default === void 0 ? void 0 : e.default) : t;
    }
  }
  function r(e, t) {
    let r = {};
    return (
      l(e.properties ?? {}, (i, a) => {
        if (e.required.includes(a) || (t !== void 0 && t[a] !== void 0)) {
          let e = t === void 0 ? void 0 : t[a];
          (!i.properties &&
            i.default &&
            i.type === `object` &&
            i.additionalProperties &&
            (e = i.default),
            (r[a] = n(i, e)));
        }
      }),
      t &&
        l(t, (e, t) => {
          r[t] === void 0 && e !== void 0 && (r[t] = e);
        }),
      r
    );
  }
  function i(e, t) {
    if (t === void 0) return e.default ? e.default : void 0;
    let r = [];
    for (let i = 0; i < t.length; i++) r.push(n(e.items, t[i]));
    return r;
  }
  return n(t, e);
}
var d = `.auto-fill-local-version`;
function f(e) {
  let t = Object.keys(e);
  chrome.runtime.onInstalled.addListener((e) => {
    (e.reason === `install` || e.reason === `update`) && n();
  });
  async function n() {
    let n = (await chrome.storage.local.get(d))[d],
      r = chrome.runtime.getManifest().version;
    if (r !== n) {
      let n = await chrome.storage.local.get(t),
        i = t.reduce(
          (t, r) => {
            let i = n[r] || {};
            return ((i = u(i, e[r])), (t[r] = i), t);
          },
          { [d]: r },
        );
      await chrome.storage.local.set(i);
    }
  }
}
function p(e, t) {
  async function n(t, n) {
    let r;
    return (
      await navigator.locks.request(m(t), { mode: `shared` }, async () => {
        r = (await h(t))[t];
      }),
      (r === void 0 || n?.autoFillDefault) && (r = u(r, e[t])),
      r
    );
  }
  async function r(n, r, i) {
    await navigator.locks.request(m(n), { mode: `exclusive` }, async () => {
      let a = (await h(n))[n];
      (a === void 0 || i?.autoFillDefault) && (a = u(a, e[n]));
      let o = await r(a);
      (t && t(n, `update`, o), await chrome.storage.local.set({ [n]: o }));
    });
  }
  async function i(n, r) {
    await navigator.locks.request(m(n), { mode: `exclusive` }, async () => {
      let i = r || {};
      (r || (i = u(i, e[n])),
        t && t(n, `update`, i),
        await chrome.storage.local.set({ [n]: i }));
    });
  }
  async function a(e) {
    return (
      await navigator.locks.request(m(e), { mode: `exclusive` }, async () => {
        (t && t(e, `delete`, void 0), await chrome.storage.local.remove([e]));
      }),
      Promise.resolve()
    );
  }
  return { updateBucket: r, setBucket: i, getBucket: n, deleteBucket: a };
}
function m(e) {
  return `storage.local.${e}`;
}
function h(e) {
  return new Promise((t) => {
    chrome.storage.local.get(e, (e) => {
      t(e);
    });
  });
}
var g = new s(n, !0),
  { updateBucket: _, setBucket: v, getBucket: y, deleteBucket: b } = p(a),
  x = 100;
async function S() {
  let e = (await y(`taskRecord`)) ?? {};
  Object.keys(e).length > x && (await v(`taskRecord`, {}));
}
function C() {
  (g.on(`getBucket`, async (e) => (await y(e)) ?? a[e].default),
    g.on(`setBucket`, async (e, t) => v(e, t)),
    g.on(`resolveFlowMediaUrl`, async function (e) {
      return await fbResolveFlowMediaRedirect(e, this?.sender?.tab?.id);
    }),
    g.on(`getDownloadState`, async (e, t, n) => fbGetDownloadState(e, t, n)),
    g.on(`startTrackedDownload`, async (e, t, n, r) =>
      fbStartTrackedDownload(e, t, n, r),
    ),
    g.on(`download`, async (e, t, n) => o(e, t, n)),
    g.on(`downloadText`, async (e, t, n) => fbDownloadText(e, t, n)),
    g.on(`setKeepAwake`, async function (e) {
      const t = this?.sender?.tab?.id;
      if (!t) return { supported: !1, active: !1 };
      if (e) {
        fbKeepAwakeTabs.add(t);
        await chrome.tabs.update(t, { autoDiscardable: !1 }).catch(() => {});
      } else fbKeepAwakeTabs.delete(t);
      return {
        supported: fbRefreshKeepAwake(),
        active: fbKeepAwakeTabs.has(t),
      };
    }));
}
async function w(e) {
  let t = e.length
      ? [...new Set(e.map((e) => e.id))]
      : [`inject-${n}-module`, `inject-${n}-proxy`],
    r = await chrome.scripting.getRegisteredContentScripts({ ids: t });
  (r.length > 0 &&
    (await chrome.scripting.unregisterContentScripts({
      ids: r.map((e) => e.id),
    })),
    e.length > 0 && (await chrome.scripting.registerContentScripts(e)));
}
function T(e, t) {
  if (e === `<all_urls>`) return /^(https?|file):\/\//.test(t);
  let n;
  try {
    n = new URL(t);
  } catch {
    return !1;
  }
  let r = e.match(/^([^:]+):\/\/([^\/]+)(\/.*)?$/);
  if (!r) return !1;
  let [, i, a, o = `/*`] = r;
  if (i === `*`) {
    if (n.protocol !== `http:` && n.protocol !== `https:`) return !1;
  } else if (n.protocol !== `${i}:`) return !1;
  return (
    !!(function (e, t) {
      if (e === `*`) return !0;
      if (e.startsWith(`*.`)) {
        let n = e.slice(2);
        return t === n || t.endsWith(`.` + n);
      }
      return e === t;
    })(a, n.hostname) &&
    !!(function (e, t) {
      let n = e.replace(/[.+^${}()|[\]\\]/g, `\\$&`).replace(/\*/g, `.*`);
      return RegExp(`^${n}$`, `i`).test(t);
    })(o, n.pathname)
  );
}
function E(e) {
  let { hostMatch: t, extensionId: n, isDev: r = !1 } = e,
    i = { id: chrome.runtime.id, slug: n, isDev: r };
  async function s(e, n = ``) {
    if (!e) return;
    try {
      let r = n;
      if (!r) {
        const t = await chrome.tabs.get(e);
        r = t?.url || ``;
      }
      if (!t.some((e) => T(e, r))) return;
      await chrome.tabs.update(e, { autoDiscardable: !1 }).catch(() => {});
    } catch (e) {
      console.debug(`Flow 标签页保活设置失败`, e);
    }
  }
  function a(e) {
    return chrome.scripting
      .executeScript({
        injectImmediately: !0,
        world: `MAIN`,
        target: { tabId: e, allFrames: !0 },
        func: (e) => {
          window[e.slug] = e;
        },
        args: [i],
      })
      .catch(() => {});
  }
  const fbEnsuringFlowTabs = new Set();
  async function fbReadFlowInjectionState(e) {
    const n = await chrome.scripting.executeScript({
      world: `MAIN`,
      target: { tabId: e },
      func: () => {
        const e = document.getElementById(`flow-batch-generate`),
          n = e?.querySelector(`.open-dialog-button`),
          r =
            location.href.startsWith(
              `https://labs.google/fx/zh/tools/flow/project/`,
            ) ||
            (location.origin === `https://flow.google.com` &&
              location.pathname.startsWith(`/project/`));
        return {
          hasRoot: !!e,
          hasLauncher: !!n,
          hiddenOnProjectPage:
            !!n && r && getComputedStyle(e).display === `none`,
          trustedTypesReady:
            !window.trustedTypes ||
            window.__flowBatchTrustedTypesV2360?.ready === !0,
          renderState:
            document.documentElement?.getAttribute(
              `data-flow-batch-render-v2360`,
            ) || ``,
          startedAt:
            Number(window.__flowBatchInjectBundleStartedAtV2328) || 0,
          angularDirectPresent:
            typeof window.__flowBatchAngularDirectCapture?.scanDom === `function`,
          nativeBridgePresent:
            typeof window.__flowBatchNativeBridge?.waitUntilReady === `function`,
          nativeBridgeReady:
            window.__flowBatchNativeBridge?.isReady?.() === !0,
        };
      },
    });
    return (
      n?.[0]?.result || {
        hasRoot: !1,
        hasLauncher: !1,
        hiddenOnProjectPage: !1,
        startedAt: 0,
      }
    );
  }
  async function fbEnsureAlreadyOpenFlowTab(e, n = ``) {
    if (fbEnsuringFlowTabs.has(e)) return;
    fbEnsuringFlowTabs.add(e);
    try {
      if (!e || !t.some((e) => T(e, n))) return;
      await a(e);
      await new Promise((e) => setTimeout(e, 500));
      let r = await fbReadFlowInjectionState(e);
      if (r.hasLauncher) {
        r.hiddenOnProjectPage &&
          (await chrome.scripting.executeScript({
            world: `MAIN`,
            target: { tabId: e },
            func: () => {
              const e = document.getElementById(`flow-batch-generate`);
              e && (e.style.display = `block`);
            },
          }));
        if (!r.angularDirectPresent || !r.nativeBridgeReady) {
          await chrome.scripting.executeScript({
            world: `MAIN`,
            target: { tabId: e },
            files: [
              `transformers/angular-direct.js`,
              `transformers/flow.js`,
              `transformers/disablePageFreeze.js`,
              `native-flow-bridge.js`,
            ],
          });
          await new Promise((e) => setTimeout(e, 300));
          r = await fbReadFlowInjectionState(e);
        }
        return;
      }
      await chrome.scripting
        .insertCSS({
          target: { tabId: e },
          files: [`injects/index.css`],
        })
        .catch((n) =>
          console.debug(`Flow 界面样式补注入失败，继续恢复界面脚本`, n),
        );
      if (r.startedAt) {
        await chrome.scripting.executeScript({
          world: `MAIN`,
          target: { tabId: e },
          files: [`trusted-types.js`, `externals.js`],
        });
        await new Promise((e) => setTimeout(e, 1500));
        r = await fbReadFlowInjectionState(e);
        if (r.hasLauncher) {
          await chrome.scripting.executeScript({
            world: `MAIN`,
            target: { tabId: e },
            files: [
              `transformers/angular-direct.js`,
              `transformers/flow.js`,
              `transformers/disablePageFreeze.js`,
              `native-flow-bridge.js`,
            ],
          });
          return;
        }
        await chrome.scripting.executeScript({
          world: `MAIN`,
          target: { tabId: e },
          func: () => {
            const e = document.getElementById(`flow-batch-generate`);
            if (!e?.querySelector(`.open-dialog-button`)) {
              e?.remove();
              window.__flowBatchInjectBundleStartedAtV2328 = 0;
            }
          },
        });
      } else {
        await chrome.scripting.executeScript({
          world: `MAIN`,
          target: { tabId: e },
          files: [
            `transformers/angular-direct.js`,
            `transformers/flow.js`,
            `transformers/disablePageFreeze.js`,
          ],
        });
      }
      await chrome.scripting.executeScript({
        world: `MAIN`,
        target: { tabId: e },
        files: [
          `trusted-types.js`,
          `externals.js`,
          `native-flow-bridge.js`,
          `injects/index.js`,
        ],
      });
      await new Promise((e) => setTimeout(e, 1500));
      r = await fbReadFlowInjectionState(e);
      if (r.hasLauncher)
        console.info(`已向 Flow 标签页补注入插件入口`, e);
      else
        console.warn(`Flow 标签页补注入后仍未发现插件入口`, e, {
          trustedTypesReady: r.trustedTypesReady,
          renderState: r.renderState,
        });
    } catch (e) {
      console.debug(`向已打开的 Flow 标签页补注入失败`, e);
    } finally {
      fbEnsuringFlowTabs.delete(e);
    }
  }
  chrome.runtime.onMessage.addListener((e, n, r) => {
    if (e?.type !== `fbEnsureFlowInjectionV2360`) return;
    const i = n?.tab?.id,
      a = n?.tab?.url || ``;
    if (!i || !t.some((e) => T(e, a))) {
      r?.({ ok: !1, ignored: !0 });
      return;
    }
    (fbEnsureAlreadyOpenFlowTab(i, a)
      .then(() => r?.({ ok: !0 }))
      .catch((e) => r?.({ ok: !1, error: String(e?.message || e) })),
      s(i, a));
    return !0;
  });
  (chrome.tabs.onUpdated.addListener(async (e, n, r) => {
    const i = n?.url || r?.url || ``;
    if (!i || !t.some((e) => T(e, i))) return;
    (s(e, i), (n?.status === `loading` || n?.url) && (await a(e)));
    (n?.status === `complete` || n?.url) &&
      fbEnsureAlreadyOpenFlowTab(e, i);
  }),
    chrome.tabs.query({}, (e) => {
      for (let n of e)
        n.id &&
          n.url &&
          t.some((e) => T(e, n.url)) &&
          (fbEnsureAlreadyOpenFlowTab(n.id, n.url), s(n.id, n.url));
    }));
  return {
    ensureTab: fbEnsureAlreadyOpenFlowTab,
    isSupportedUrl: (e) => t.some((n) => T(n, e)),
  };
}
const fbFlowInjectionRuntime = E({ hostMatch: t, extensionId: n, isDev: !1 });
const fbRequiredFlowOrigins = [
  `https://labs.google/*`,
  `https://flow.google.com/*`,
];
function fbPermissionBoolean(e, t) {
  return new Promise((n) => {
    let r = !1;
    const i = (e) => {
      if (r) return;
      ((r = !0), n(!!e));
    };
    try {
      const n = chrome.permissions?.[e];
      if (typeof n !== `function`) return i(!1);
      const r = n.call(chrome.permissions, t, i);
      r?.then?.(i, () => i(!1));
    } catch {
      i(!1);
    }
  });
}
async function fbRefreshFlowPermissionBadge() {
  const e = await fbPermissionBoolean(`contains`, {
    origins: fbRequiredFlowOrigins,
  });
  try {
    (chrome.action.setBadgeText({ text: e ? `` : `!` }),
      chrome.action.setBadgeBackgroundColor({ color: `#d93025` }),
      chrome.action.setTitle({
        title: e
          ? `Flow 批量生成：已启用`
          : `Flow 批量生成：点击一次启用新 Flow 网站`,
      }));
  } catch {}
  return e;
}
(fbRefreshFlowPermissionBadge(),
  chrome.permissions?.onAdded?.addListener(fbRefreshFlowPermissionBadge),
  chrome.permissions?.onRemoved?.addListener(fbRefreshFlowPermissionBadge),
  f(a),
  C(),
  S(),
  w([]).catch((e) => {
    console.error(`Failed to remove legacy dynamic content scripts`, e);
  }),
  chrome.action.onClicked.addListener(async function (t) {
    let n = await fbRefreshFlowPermissionBadge();
    n ||
      (n = await fbPermissionBoolean(`request`, {
        origins: fbRequiredFlowOrigins,
      }));
    const r = t?.url || ``;
    if (t?.id && fbFlowInjectionRuntime.isSupportedUrl(r)) {
      (await fbFlowInjectionRuntime.ensureTab(t.id, r),
        await fbRefreshFlowPermissionBadge());
      return;
    }
    chrome.tabs.create({ url: e, active: !0 });
  }));
