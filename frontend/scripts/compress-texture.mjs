#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const inputPath = path.join(publicDir, "wood-floor.jpg");
const avifOut = path.join(publicDir, "wood-floor.avif");
const webpOut = path.join(publicDir, "wood-floor.webp");
const jpgOut = path.join(publicDir, "wood-floor.min.jpg");

async function ensureInput() {
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }
}

async function run() {
  await ensureInput();
  const image = sharp(inputPath);

  // Re-encode to AVIF (~1/5 size target)
  await image.clone().avif({ quality: 1, speed: 6 }).toFile(avifOut);

  // Re-encode to WebP as a broadly supported fallback
  await image.clone().webp({ quality: 1 }).toFile(webpOut);

  // Also emit a compressed JPG fallback
  await image.clone().jpeg({ quality: 1, mozjpeg: true }).toFile(jpgOut);

  console.log("Compressed textures written:");
  console.log(`- ${path.relative(projectRoot, avifOut)}`);
  console.log(`- ${path.relative(projectRoot, webpOut)}`);
  console.log(`- ${path.relative(projectRoot, jpgOut)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
