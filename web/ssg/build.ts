import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render as litRender } from "@lit-labs/ssr";
import { renderApp } from "../src/view";
import { site } from "./site";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const outPath = path.join(webRoot, "..", "dist", "index.html");

const initialMarkup = [...litRender(renderApp({
  description: site.description,
  selectedFileName: null,
  selectedFileSizeKb: null,
  status: "CSVファイルを選択してください。",
  isDragging: false,
  isConverting: false,
  downloadUrl: null,
  convertedCount: 0,
}))].join("");

const html = await readFile(outPath, "utf8");
const replaced = html.replace('<div id="app"></div>', `<div id="app">${initialMarkup}</div>`);
if (replaced === html) {
  throw new Error("SSG insertion point '#app' was not found in dist/index.html");
}
await writeFile(outPath, replaced, "utf8");
console.log(`SSG generated ${path.relative(process.cwd(), outPath)}`);
