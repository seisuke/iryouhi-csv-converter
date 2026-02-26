import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(webRoot, "node_modules", "simple-icons", "icons");
const outputRoot = path.join(webRoot, "public", "icons", "brands");

await mkdir(outputRoot, { recursive: true });

const icons = ["x", "github"];
for (const name of icons) {
  await cp(path.join(sourceRoot, `${name}.svg`), path.join(outputRoot, `${name}.svg`));
}

console.log("Simple Icons copied:", icons.join(", "));
