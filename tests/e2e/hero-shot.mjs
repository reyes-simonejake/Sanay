// Screenshots of the landing hero (the 3D skyline), to check the window effects.
// usage: node tests/e2e/hero-shot.mjs [url] [dark|light]
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const url = process.argv[2] ?? "http://localhost:5173/";
const theme = process.argv[3] ?? "dark";
mkdirSync("tests/e2e/shots", { recursive: true });
const b = await launch({ port: 9344, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
try {
  await b.size(1440, 900);
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
  await b.addInit(`try { localStorage.setItem("sanay.theme", ${JSON.stringify(theme)}); } catch {}`);
  await b.goto(url, 600);
  await sleep(6000); // the 3D scene loads and the skyline settles
  const shot = async (name, clip) => {
    const r = await b.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    writeFileSync(`tests/e2e/shots/${name}.png`, Buffer.from(r.data, "base64"));
  };
  await shot(`hero-${theme}`);
  await shot(`hero-${theme}-zoom-a`, { x: 360, y: 450, width: 720, height: 450 });
  await sleep(1500);
  await shot(`hero-${theme}-zoom-b`, { x: 360, y: 450, width: 720, height: 450 });
  console.log(b.console.filter((l) => !l.includes("THREE.Clock")).join("\n") || "no console errors");
} finally {
  await b.close();
}
