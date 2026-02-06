/// <reference types="node" />

import { spawn } from "node:child_process";
import { buildWatch } from "./build-watch.js";

export const dev = async () => {
  const tsc = await buildWatch();
  const cafe = spawn("node", ["./node_modules/cafe/dist/bin.js"], {
    stdio: ["ignore", "inherit", "inherit"],
  });

  return { cafe, tsc };
};

if (import.meta.main) dev();
