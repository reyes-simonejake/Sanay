// Minimal Chrome DevTools Protocol driver (no dependencies; Node 22+ has fetch and WebSocket).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, extraArgs = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "sanay-test-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--js-flags=--max-old-space-size=256",
      ...extraArgs,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let ver;
  for (let i = 0; i < 50 && !ver; i++) {
    await sleep(200);
    try {
      ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {}
  }
  if (!ver) throw new Error("Chrome did not start");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const console_ = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning"))
      console_.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") console_.push("[exception] " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  });
  await send("Page.enable");
  await send("Runtime.enable");

  const api = {
    send,
    console: console_,
    async close() {
      try {
        await send("Browser.close");
      } catch {}
      proc.kill();
    },
    async addInit(source) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source });
    },
    async size(width, height = 900, mobile = false) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    },
    /** Open a page fresh (a full reload, even when only the #hash differs). */
    async goto(url, wait = 1500) {
      await send("Page.navigate", { url: "about:blank" });
      await sleep(100);
      await send("Page.navigate", { url });
      // Wait until the app has drawn its page (the splash is gone and there is real text).
      const end = Date.now() + 15000;
      while (Date.now() < end) {
        await sleep(200);
        try {
          const ready = await api.eval(`document.readyState === "complete" && document.body.innerText.length > 80 && !document.querySelector('[data-splash]')`);
          if (ready) break;
        } catch {}
      }
      await sleep(Math.min(wait, 600));
    },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    /** Click the first visible button/link/label whose text contains `text`. */
    async click(text, selector = "button, a, label, [role=tab]") {
      const ok = await api.eval(`(() => {
        const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent !== null && !e.disabled);
        const label = e => (e.innerText || e.getAttribute('aria-label') || '').trim();
        const el = els.find(e => label(e) === ${JSON.stringify(text)}) || els.find(e => label(e).includes(${JSON.stringify(text)}));
        if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`);
      if (!ok) throw new Error(`click: nothing visible with text "${text}"`);
      await sleep(150);
    },
    async has(text) {
      return api.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
    },
    async waitFor(text, ms = 8000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await api.has(text)) return true;
        await sleep(150);
      }
      throw new Error(`waitFor: "${text}" did not appear in ${ms} ms`);
    },
    async type(selector, value) {
      await api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
        const set = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set; set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    },
    async shot(path, full = true) {
      const m = await send("Page.getLayoutMetrics");
      const h = Math.min(full ? Math.ceil(m.cssContentSize.height) : 900, 6000);
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: h, scale: 1 } });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    /** Horizontal overflow: elements wider than the viewport (a layout break on phones). */
    async overflow() {
      return api.eval(`(() => { const w = document.documentElement.clientWidth; const bad = [];
        for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect();
          if (r.width && (r.right > w + 1) && getComputedStyle(el).position !== 'fixed') bad.push((el.className?.toString?.() || el.tagName).slice(0,60) + ' right=' + Math.round(r.right)); }
        return { scroll: document.documentElement.scrollWidth > w, w, bad: bad.slice(0, 5) }; })()`);
    },
  };
  return api;
}
