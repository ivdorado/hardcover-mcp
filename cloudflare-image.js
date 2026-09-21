#!/usr/bin/env node
// Generates a header image via Cloudflare Workers AI (Leonardo Lucid Origin).
// Usage: node cloudflare-image.js "<prompt>" <output.png> [width] [height]

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MODEL = "@cf/leonardo/lucid-origin";

// Load .env from the project root if the vars aren't already in the environment.
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
if ((!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) && existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const [, , prompt, outputPath, widthArg, heightArg] = process.argv;

if (!prompt || !outputPath) {
  console.error(
    'Usage: node cloudflare-image.js "<prompt>" <output.png> [width] [height]'
  );
  process.exit(1);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!token || !accountId) {
  console.error(
    "Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID in environment."
  );
  process.exit(1);
}

const width = Number(widthArg) || 1600;
const height = Number(heightArg) || 900;

const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt, width, height, guidance: 7 }),
});

const json = await res.json();

if (!json.success) {
  console.error("Cloudflare Workers AI error:", JSON.stringify(json.errors));
  process.exit(1);
}

writeFileSync(outputPath, Buffer.from(json.result.image, "base64"));
console.log(`Saved ${outputPath} (${width}x${height})`);
