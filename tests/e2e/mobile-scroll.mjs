// Scrolls a page one phone screen at a time and saves what's on screen at each stop
// (the 3D journey only draws while it is on screen, so a full-page shot misses it).
// usage: node tests/e2e/mobile-scroll.mjs [url] [width] [dark|light] [step=0.9]
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const url = process.argv[2] ?? "http://localhost:5173/";
const width = Number(process.argv[3] ?? 390);
const theme = process.argv[4] ?? "dark";
const step = Number(process.argv[5] ?? 0.9);
const H = 844;
const out = `tests/e2e/shots/scroll-${width}-${theme}`;
mkdirSync(out, { recursive: true });

const b = await launch({ port: 9366, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
try {
  await b.size(width, H, true);
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
  await b.addInit(`try { localStorage.setItem("sanay.theme", ${JSON.stringify(theme)}); localStorage.setItem("sanay.lang","en"); } catch {}`);
  await b.goto(url, 600);
  await sleep(5000);
  const total = await b.eval("document.documentElement.scrollHeight");
  let i = 0;
  for (let y = 0; y < total && i < 60; y += Math.round(H * step), i++) {
    await b.eval(`window.scrollTo(0, ${y})`);
    await sleep(1100);
    const r = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
    writeFileSync(`${out}/${String(i).padStart(2, "0")}.jpg`, Buffer.from(r.data, "base64"));
  }
  console.log(`page height ${total}px, ${i} shots in ${out}`);
} finally {
  await b.close();
}
