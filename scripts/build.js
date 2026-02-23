/// <reference types="bun" />

import { build as bunBuild, Glob } from "bun";
import { watchFile } from "node:fs";
import { mkdir, rm } from "node:fs/promises";

export const buildOnce = async () => {
  await mkdir("./dist", { recursive: true });

  const glob = new Glob("dist/**/*.js*");
  const dtsFiles = await Array.fromAsync(glob.scan());

  await Promise.all(dtsFiles.map((filePath) => rm(filePath, { force: true })));
  await bunBuild({
    entrypoints: [
      "./src/decoder.ts",
      "./src/encoder.ts",
      "./src/error.ts",
      "./src/struct.ts",
      "./src/utils.ts",
    ],
    sourcemap: "external",
    minify: true,
    outdir: "./dist",
    target: "browser",
  });

  return null;
};

export const build = async (watch = false) => {
  if (!watch) return buildOnce();

  let pendingBuild = false;
  let building = false;
  const watchCallback = async () => {
    if (building) {
      pendingBuild = true;
      return null;
    }

    building = true;
    pendingBuild = false;

    try {
      await buildOnce();
    } finally {
      building = false;
      pendingBuild && setImmediate(watchCallback);
    }

    return null;
  };

  return watchFile("./src", { interval: 100 }, watchCallback);
};

if (import.meta.main) await build();
