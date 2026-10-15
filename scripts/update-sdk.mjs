import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const origin = new URL(process.env.POWLY_ORIGIN ?? "https://powly.gg").origin;
const destination = resolve(import.meta.dirname, "../src/powly");

async function download(name) {
  const response = await fetch(`${origin}/api/sdk/${name}`);
  if (!response.ok) {
    throw new Error(`Could not download ${name}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

const [moduleCode, declarations] = await Promise.all([
  download("powly.mjs"),
  download("powly.d.ts"),
]);

await Promise.all([
  writeFile(resolve(destination, "powly.mjs"), moduleCode),
  writeFile(resolve(destination, "powly.d.mts"), declarations),
]);

console.log(`Updated the Powly SDK from ${origin}.`);
