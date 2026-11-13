// Phone WebGL limit check: Chrome on Android keeps only ~8 live WebGL contexts per page and blanks
// the oldest past that (a white box). Scroll the whole home page with the same cap, then come back to
// the practice-call card and count lost contexts.
// usage: node tests/e2e/webgl-limit.mjs [url] [cap=8]
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
const url = process.argv[2] ?? "http://localhost:5173/";
const cap = process.argv[3] ?? "8";
mkdirSync("tests/e2e/shots", { recursive: true });
const b = await launch({ port: 9411, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", `--max-active-webgl-contexts=${cap}`] });
try {
  await b.size(390, 844, true);
  await b.addInit(`window.__lost = 0; addEventListener("webglcontextlost", () => window.__lost++, true);
    try { localStorage.setItem("sanay.theme","dark"); localStorage.setItem("sanay.lang","en"); } catch {}`);
  await b.goto(url, 600); await sleep(3000);
  const total = await b.eval("document.documentElement.scrollHeight");
  for (let y = 0; y < total; y += 600) { await b.eval(`scrollTo(0, ${y})`); await sleep(500); }
  await sleep(1500);
  await b.eval(`document.querySelector('#features .call-card').scrollIntoView({block:'center'})`);
  await sleep(2000);
  const r = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 75 });
  writeFileSync("tests/e2e/shots/webgl-limit.jpg", Buffer.from(r.data, "base64"));
  const live = await b.eval(`document.querySelectorAll('canvas').length`);
  const tooMany = b.console.filter((l) => /too many active webgl/i.test(l)).length;
  console.log(`canvases now: ${live}, lost contexts: ${await b.eval("window.__lost")}, "too many contexts" warnings: ${tooMany}`);
} finally { await b.close(); }
