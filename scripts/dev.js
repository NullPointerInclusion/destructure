/// <reference types="node" />

import { spawn } from "node:child_process";
import { buildWatch } from "./build-watch.js";

export const dev = async () => {
  const watcher = await buildWatch();

  return { watcher };
};

if (import.meta.main) await dev();
