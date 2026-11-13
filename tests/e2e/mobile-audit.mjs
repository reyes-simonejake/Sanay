// Phone-size audit of the marketing site: full-page screenshots of every page and every
// sample-account tab, plus a list of anything wider than the screen.
// usage: node tests/e2e/mobile-audit.mjs [baseUrl] [width] [dark|light]
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const base = (process.argv[2] ?? "http://localhost:5173/").replace(/#.*$/, "");
const width = Number(process.argv[3] ?? 390);
const theme = process.argv[4] ?? "dark";
const out = `tests/e2e/shots/mobile-${width}`;
mkdirSync(out, { recursive: true });

const TABS = ["overview", "practice", "english", "coach", "profile", "preferences", "devices", "plan", "security"];

const b = await launch({ port: 9355, extraArgs: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const report = [];
const check = async (name) => {
  await sleep(900);
  await b.shot(`${out}/${name}.png`);
  const o = await b.overflow();
  report.push(`${name}: ${o.scroll ? "SCROLLS SIDEWAYS" : "ok"}${o.bad.length ? "  " + o.bad.join(" | ") : ""}`);
};
try {
  await b.size(width, 844, true);
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
  await b.addInit(`try { localStorage.setItem("sanay.theme", ${JSON.stringify(theme)}); localStorage.setItem("sanay.lang","en"); } catch {}`);

  await b.goto(base, 600);
  await sleep(5000);
  await check("home");
  for (const r of ["guide", "preview", "signup", "login"]) {
    await b.goto(`${base}#/${r}`, 600);
    await check(r);
  }
  // Sample account
  await b.click("sample", "button");
  await sleep(1500);
  for (const tab of TABS) {
    await b.goto(`${base}#/account/${tab}`, 600);
    await check(`account-${tab}`);
  }
  console.log(report.join("\n"));
  console.log(b.console.filter((l) => !l.includes("THREE.Clock")).slice(0, 10).join("\n") || "no console errors");
} finally {
  await b.close();
}
