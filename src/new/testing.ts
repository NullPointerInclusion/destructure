/// <reference types="node" />

import { inspect } from "node:util";
import { encode } from "./encoder/encoder.ts";
import { schema, type Data, type Schema } from "./schema/schema.ts";
import { sortObjectEntries } from "./utils/utils.ts";
import { decode } from "./decoder/decoder.ts";

const s = schema({ name: "char[9]", nested: { prop1: "u8", prop2: "i32" } });
const z = schema({
  x: s,
  y: { ...s, name: "char[8]" },
  tuple: ["i8", "i8", { value: "f64" }] as const,
});

const data: Data<typeof z> = {
  x: {
    name: Array.from("Anonymous"),
    nested: {
      prop1: 215,
      prop2: 89,
    },
  },
  y: {
    name: Array.from("Somebody"),
    nested: {
      prop1: 87,
      prop2: 603,
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
const getJSONString = (data: object) => {
  return JSON.stringify(Object.fromEntries(sortObjectEntries(Object.entries(data))), null, 2);
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
