(function () {
  "use strict";
  const b = Object.prototype.hasOwnProperty;
  Object.prototype.hasOwnProperty = function (e) {
    const o = this;
    return (
      o?.promptBoxStore &&
        o.onSubmit &&
        ((window.promptBoxStore = o.promptBoxStore),
        !o?.promptBoxId &&
          o.placeholder &&
          (window.generateVideo = () => o.onSubmit(!0, !0))),
      b.call(this, e)
    );
  };
  async function S(e) {
    let o;
    const a = e.headers.get("Content-Type") || "";
    try {
      if (a.includes("application/json")) o = await e.json();
      else if (a.includes("text/")) {
        let n = await e.text();
        n = n.replace(/^for\s*\(\s*;;\s*\);/, "").trim();
        try {
          o = JSON.parse(n);
        } catch {
          o = n;
        }
      } else if (a.includes("application/octet-stream") || a.includes("blob"))
        o = await e.blob();
      else if (a.includes("form-data")) o = await e.formData();
      else {
        let n = await e.text();
        try {
          o = JSON.parse(n);
        } catch {
          o = n;
        }
      }
    } catch (n) {
      console.log(n);
    }
    return o;
  }
  function O(e) {}
  window.currentProcess = null;
  function k() {
    const e = window.fetch;
    window.fetch = async (o, a) => {
      const n = M(o),
        c =
          n.includes("video:batchAsyncGenerateVideo") &&
          window.currentProcess != null,
        i = n.includes("video:batchCheckAsyncVideoGenerationStatus"),
        s = c || i,
        t = window.currentProcess && { ...window.currentProcess };
      if (c) {
        const { rowIndex: w, lineIndex: m, line: l, image: d } = t;
        "" +
          JSON.stringify({
            image: d?.displayName || t.endImage?.displayName || "",
            line: l,
            rowIndex: w,
            lineIndex: m,
          });
      }
      const r = await e(o, a);
      if (s)
        try {
          const w = r.clone(),
            m = await S(w);
          if (m) {
            if (c) {
              const l = m.media;
              if (Array.isArray(l) && l.length) {
                const d = {};
                for (const p of l) {
                  const u = p?.name;
                  u && (d[u] = t);
                }
                if (Object.keys(d).length) {
                  const { image: p, line: u, rowIndex: g, lineIndex: h } = t;
                  ("" +
                    JSON.stringify({
                      image: p?.displayName || t.endImage?.displayName || "",
                      line: u,
                      rowIndex: g,
                      lineIndex: h,
                      ids: Object.keys(d),
                    }),
                    window.emitter.emit("onSubmitSuccess", d));
                }
              } else {
                window.emitter.emit("onSubmitFailure", {
                  process: t,
                  message:
                    m?.error?.message ||
                    m?.message ||
                    `Flow 未返回生成任务${r.ok ? "" : `（HTTP ${r.status}）`}`,
                });
              }
            } else if (i) {
              const l = {},
                failed = {},
                d = m.media;
              if (Array.isArray(d) && d.length) {
                for (const p of d) {
                  const status =
                    p.mediaMetadata?.mediaStatus?.mediaGenerationStatus?.toUpperCase() ||
                    "";
                  if (status.includes("SUCCESSFUL")) {
                    const u = p?.name;
                    if (u) {
                      const g = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${u}`,
                        h = l[u] || [];
                      (h.push({ url: g }), (l[u] = h));
                    }
                  } else if (
                    status.includes("FAIL") ||
                    status.includes("ERROR") ||
                    status.includes("CANCEL")
                  ) {
                    const u = p?.name;
                    u &&
                      (failed[u] = {
                        status,
                        message:
                          p.mediaMetadata?.mediaStatus?.errorMessage ||
                          p.mediaMetadata?.mediaStatus?.message ||
                          p.error?.message ||
                          "Flow 生成失败",
                      });
                  }
                }
                Object.keys(l).length &&
                  ("" + JSON.stringify({ result: l }),
                  window.emitter.emit("onReceiveData", l));
                Object.keys(failed).length &&
                  window.emitter.emit("onReceiveFailure", failed);
              }
            }
          }
        } catch (w) {
          console.error(w);
        }
      return r;
    };
  }
  function M(e) {
    return typeof e == "string"
      ? e
      : e instanceof URL
        ? e.href
        : e instanceof Request
          ? e.url
          : String(e ?? "");
  }
  function j(e, o) {
    if (window.modulefactory) return;
    const a = Object.keys(e)[0],
      n = e[a];
    (console.log("找到------------------module"),
      (e[a] = function () {
        ((window.modulefactory = arguments[2]), n.apply(this, arguments));
      }));
  }
  const f = { Modules: [] };
  function x() {
    if (!window.modulefactory) return;
    (console.log("刷新数据", "modulefactory"),
      (f.Modules = Object.keys(window.modulefactory.m).map((c) => {
        var i = null;
        try {
          i = window.modulefactory(c);
        } catch {}
        return i;
      })));
    const e = function (i) {
        return window.modulefactory(i);
      },
      o = function (i) {
        var s = [];
        return (
          f.Modules.forEach(function (t) {
            if (typeof t < "u")
              if (typeof i == "string") {
                if (typeof t.default == "object")
                  for (const r in t.default) r == i && s.push(t);
                for (const r in t) r == i && s.push(t);
              } else if (typeof i == "function") i(t) && s.push(t);
              else throw "沒有模塊";
          }),
          s
        );
      },
      a = function (i) {
        var s = [];
        return (
          f.Modules.forEach(function (t) {
            if (typeof t < "u")
              if (typeof i == "string") {
                if (typeof t.default == "object")
                  for (const r in t.default) r == i && s.push(t);
                for (const r in t) r == i && s.push(t);
              } else if (typeof i == "function") {
                const r = i(t);
                r && s.push(r);
              } else throw "沒有模塊";
          }),
          s
        );
      },
      n = function (c) {
        if (f.Modules == 0) throw Error("沒有模塊");
        var i = [];
        if (typeof c == "string")
          f.Modules.forEach(function (s) {
            s.toString().includes(c) && i.push(s);
          });
        else if (typeof c == "function")
          f.Modules.forEach(function (s) {
            c(s) && i.push(s);
          });
        else throw Error("沒有模塊");
        return i;
      };
    window.moduleManager = {
      modules: f.Modules,
      findModule: o,
      getModule: a,
      findFunction: n,
      get: window.modulefactory ? e : null,
    };
  }
  if (window.webpackChunk_N_E) console.log("已经存在 webpackChunk_N_E");
  else {
    let e = function (t) {
        replaceIds.length &&
          replaceIds.forEach((r) => {
            n[r]
              ? n[r](t, fbmodules)
              : (window.replaceIds = window.replaceIds.filter((w) => w !== r));
          });
      },
      o = function (t) {
        const r = t.id;
        ((n[r] = t), replaceIds.push(r));
      };
    (console.log("不存在 webpackChunk_N_E"), (window.webpackChunk_N_E = []));
    let a = window.webpackChunk_N_E.push;
    window.fbmodules = {};
    let n = {};
    ((window.replaceIds = []),
      (window.require = function (t) {
        if (!fbmodules[t]) {
          if (!window.moduleManager) return {};
          let r;
          if (
            (["workflows", "projectDetails", "collections"].includes(t)
              ? (r = window.moduleManager.getModule(y.store(t)))
              : (r = window.moduleManager.findModule(y[t])),
            !r?.[0])
          )
            return {};
          fbmodules[t] = r?.[0];
        }
        return fbmodules[t];
      }));
    let c = 0;
    const i = { 0: a };
    let s;
    (Object.defineProperty(webpackChunk_N_E, "push", {
      get: () => {
        if (c > 0) {
          const t = c;
          return function () {
            (e(arguments[0][1]),
              clearTimeout(s),
              (s = setTimeout(() => {
                x();
              }, 1e3)),
              i[t].apply(webpackChunk_N_E, arguments));
          };
        }
        return a;
      },
      set: (t) => {
        (c++, (i[c] = t));
      },
    }),
      o(j));
  }
  k();
  const y = {
    react: (e) => e && e.createElement,
    "react-dom": (e) => e && e.hydrateRoot && e.render,
    jsx: (e) => e.jsx,
    store: (e) => (o) => {
      if (typeof o == "object")
        for (const a of Object.keys(o))
          try {
            const n = Object.keys(o[a]);
            if (
              n.includes("getState") &&
              n.includes("setState") &&
              e in o[a].getState()
            )
              return o[a];
          } catch {}
    },
  };
})();
