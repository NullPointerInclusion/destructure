/// <reference types="bun" />

import { $, Glob } from "bun";
import { mkdir, rm } from "node:fs/promises";

export const buildTypes = async () => {
  await mkdir("./dist", { recursive: true });

  const glob = new Glob("dist/**/*.d.ts*");
  const dtsFiles = await Array.fromAsync(glob.scan());

  await Promise.all(dtsFiles.map((filePath) => rm(filePath, { force: true })));
  await $`bunx tsgo --emitDeclarationOnly`.quiet();

  return null;
};

if (import.meta.main) await buildTypes();
