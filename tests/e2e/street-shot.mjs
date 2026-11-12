// Screenshot of the street chapter (close-up windows), to check the people on calls.
// usage: node tests/e2e/street-shot.mjs [url] [scroll, in screen heights]
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

mkdirSync("tests/e2e/shots", { recursive: true });
const b = await launch({ port: 9345, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
try {
  await b.size(1200, 750);
  await b.goto(process.argv[2] ?? "http://localhost:5173/", 600);
  await sleep(4000);
  await b.eval(`window.scrollTo(0, innerHeight * ${process.argv[3] ?? 1.6})`);
  await sleep(5000);
  const r = await b.send("Page.captureScreenshot", { format: "png" });
  writeFileSync("tests/e2e/shots/street.png", Buffer.from(r.data, "base64"));
  console.log(b.console.filter((l) => !l.includes("THREE.Clock")).join("\n") || "no console errors");
} finally {
  await b.close();
}
