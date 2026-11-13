// Screenshot one section at a given width, as a visitor scrolls to it.
// usage: node tests/e2e/section-shot.mjs <url> <sectionId> <width> <height> <name> [offsetPx]
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
const [url, id, w, h, name, off = "0"] = process.argv.slice(2);
const b = await launch({ port: 9388, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
try {
  await b.size(Number(w), Number(h), Number(w) < 800);
  await b.addInit(`try { localStorage.setItem("sanay.theme","dark"); localStorage.setItem("sanay.lang","en"); } catch {}`);
  await b.goto(url, 600); await sleep(2500);
  await b.eval(`window.scrollTo(0, document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top + scrollY + ${Number(off)})`);
  await sleep(2000);
  const r = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 75 });
  writeFileSync(`tests/e2e/shots/${name}.jpg`, Buffer.from(r.data, "base64"));
} finally { await b.close(); }
