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
    interval: 20,
    intervalRandom: 10,
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
      t.origin === `https://labs.google` &&
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
        o.origin !== `https://labs.google` &&
          c({ url: r, resolved: !0, statusCode: e.statusCode });
      };
    (chrome.webRequest.onBeforeRedirect.addListener(l, {
      urls: [`https://labs.google/*`],
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
async function o(e, t) {
  try {
    const n = await chrome.downloads.download({
      url: e,
      filename: t.replace(/\/+/g, `/`),
      conflictAction: `uniquify`,
      saveAs: !1,
    });
    if (chrome.runtime.lastError)
      return { error: chrome.runtime.lastError.message };
    const r = await chrome.downloads.search({ id: n }),
      i = r?.[0];
    if (i?.state === `complete`)
      return { id: n, state: `complete`, filename: i.filename };
    return await new Promise((e) => {
      let t = !1;
      const r = () => {
          chrome.downloads.onChanged.removeListener(i);
          clearTimeout(a);
        },
        o = (n) => {
          if (t) return;
          ((t = !0), r(), e(n));
        },
        i = (e) => {
          if (e.id !== n) return;
          if (e.state?.current === `complete`) {
            chrome.downloads.search({ id: n }).then((e) => {
              o({
                id: n,
                state: `complete`,
                filename: e?.[0]?.filename || ``,
              });
            });
            return;
          }
          e.state?.current === `interrupted` &&
            o({
              id: n,
              error: e.error?.current || `浏览器下载被中断`,
            });
        },
        a = setTimeout(
          async () => {
            const e = (await chrome.downloads.search({ id: n }))?.[0];
            e?.state === `complete`
              ? o({ id: n, state: `complete`, filename: e.filename })
              : o({ id: n, error: `等待浏览器下载完成超时` });
          },
          30 * 60 * 1e3,
        );
      chrome.downloads.onChanged.addListener(i);
    });
  } catch (e) {
    return (console.error(`下载文件出现错误：`, e), { error: e.message });
  }
}
async function fbCreateDownloadBlob(e, t) {
  if (typeof URL?.createObjectURL !== `function`)
    throw Error(`当前 Firefox 后台页无法创建 Blob 下载地址`);
  const n = URL.createObjectURL(new Blob([e], { type: t }));
  return { url: n, revoke: () => URL.revokeObjectURL(n) };
}
async function fbDownloadText(e, t, n = `text/plain;charset=utf-8`) {
  if (typeof e !== `string`) throw Error(`要保存的断点内容不是文本`);
  const r = await fbCreateDownloadBlob(e, n);
  try {
    return await o(r.url, t);
  } finally {
    r.revoke();
  }
}
const fbKeepAwakeTabs = new Set();
function fbDropKeepAwakeTab(e) {
  fbKeepAwakeTabs.delete(e);
}
chrome.tabs.onRemoved.addListener(fbDropKeepAwakeTab);
chrome.tabs.onUpdated.addListener((e, t) => {
  t.url && !/^https:\/\/labs\.google\/fx\/zh\/tools\/flow(?:\/|$)/.test(t.url) &&
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
    chrome.runtime.onMessage.addListener((e, t, n) => {
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
    g.on(`download`, async (e, t) => o(e, t)),
    g.on(`downloadText`, async (e, t, n) => fbDownloadText(e, t, n)),
    g.on(`setKeepAwake`, async function (e) {
      const t = this?.sender?.tab?.id;
      if (!t) return { supported: !1, active: !1 };
      if (e) {
        fbKeepAwakeTabs.add(t);
        await chrome.tabs.update(t, { autoDiscardable: !1 }).catch(() => {});
      } else fbKeepAwakeTabs.delete(t);
      return { supported: !1, active: fbKeepAwakeTabs.has(t) };
    }));
}
async function w(e) {
  if (e.length === 0) return;
  let t = [...new Set(e.map((e) => e.id))],
    n = await chrome.scripting.getRegisteredContentScripts({ ids: t });
  (n.length > 0 &&
    (await chrome.scripting.unregisterContentScripts({
      ids: n.map((e) => e.id),
    })),
    await chrome.scripting.registerContentScripts(e));
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
    i = {
      id: chrome.runtime.id,
      slug: n,
      isDev: r,
      baseUrl: chrome.runtime.getURL(``),
    },
    o = new Set();
  async function s(e, n = ``) {
    if (!e || o.has(e)) return;
    try {
      let r = n;
      if (!r) {
        const t = await chrome.tabs.get(e);
        r = t?.url || ``;
      }
      if (!t.some((e) => T(e, r))) return;
      await chrome.tabs.update(e, { autoDiscardable: !1 }).catch(() => {});
      const i = await chrome.tabs.getZoom(e);
      if (Math.abs(i - 1) < 0.001) return;
      (o.add(e), await chrome.tabs.setZoom(e, 1));
    } catch (e) {
      console.debug(`Flow 页面缩放校正失败`, e);
    } finally {
      setTimeout(() => o.delete(e), 120);
    }
  }
  function a(e) {
    chrome.scripting
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
  (chrome.tabs.onUpdated.addListener(async (e, n, r) => {
    const i = !!r?.url && t.some((e) => T(e, r.url));
    (i && s(e, r.url),
      r?.url &&
        n?.status &&
        ((n.status !== `loading` && n.status !== `complete`) || (i && a(e))));
  }),
    chrome.tabs.onZoomChange.addListener(({ tabId: e, newZoomFactor: t }) => {
      Math.abs(t - 1) >= 0.001 && s(e);
    }),
    chrome.tabs.query({}, (e) => {
      for (let n of e)
        n.id &&
          n.url &&
          t.some((e) => T(e, n.url)) &&
          (a(n.id), s(n.id, n.url));
    }));
}
(E({ hostMatch: t, extensionId: n, isDev: !1 }),
  f(a),
  C(),
  S(),
  w([
    {
      id: `inject-${n}-module`,
      js: [`externals.js`, `injects/index.js`],
      css: [`injects/index.css`],
      matches: t,
      runAt: `document_end`,
      world: `MAIN`,
    },
    {
      id: `inject-${n}-proxy`,
      js: [`transformers/flow.js`, `transformers/disablePageFreeze.js`],
      matches: t,
      runAt: `document_start`,
      world: `MAIN`,
    },
  ]).catch((e) => {
    console.error(`Failed to register content scripts`, e);
  }),
  chrome.action.onClicked.addListener(function (t) {
    chrome.tabs.create({ url: e, active: !0 });
  }));
