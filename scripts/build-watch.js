/// <reference types="node" />

export const buildWatch = async () => {
  const { build } = await import("./build.js");
  return await build(true, true);
};

if (import.meta.main) buildWatch();
