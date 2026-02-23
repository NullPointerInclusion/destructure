/// <reference types="node" />

import { inspect } from "node:util";
import { decode } from "./decoder.ts";
import { encode } from "./encoder.ts";
import { createStruct, type Data } from "./struct.ts";
import { sortObjectEntries } from "./utils.ts";

const x = createStruct({ name: "char[9]", nested: { prop1: "u8", prop2: "i64" } });
const y = createStruct({ ...x, name: "char[8]" });
const z = createStruct({ x, y, tuple: ["i8", "i8", { value: "f64" }] as const });

const data: Data<typeof z> = {
  x: {
    name: Array.from("Anonymous"),
    nested: {
      prop1: 215,
      prop2: 89n,
    },
  },
  y: {
    name: Array.from("Somebody"),
    nested: {
      prop1: 87,
      prop2: 603n,
    },
  },
  tuple: [-25, 49, { value: 3.14159 }],
};

decode(z, encode(z, decode(z, encode(z, data))));

const encodeStart = performance.now();
const encoded = encode(z, data);
const encodeDur = performance.now() - encodeStart;
const decodeStart = performance.now();
const decoded = decode(z, encoded);
const decodeDur = performance.now() - decodeStart;
const replacer = (_: string, v: any) => (typeof v === "bigint" ? v.toString() + "n" : v);
const getJSONString = (data: object) => {
  return JSON.stringify(Object.fromEntries(sortObjectEntries(Object.entries(data))), replacer, 2);
};

console.log(`
Encoded Size: ${encoded.length}
Decoded Match: ${getJSONString(data) === getJSONString(decoded)}
Encoded Data: ${inspect(encoded)}
Decoded Data: ${inspect(decoded)}
Timings:
  encoding: ${encodeDur}
  decoding: ${decodeDur}
`);

process.nextTick(() => process.exit(0));
