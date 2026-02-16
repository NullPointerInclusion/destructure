import { createStruct, encode, decode } from "./destructure.ts";

const x = createStruct({ name: "char[9]", nested: { prop1: "u8", prop2: "i64" } });
const y = createStruct({ ...x, name: "char[8]" });
const z = createStruct({ x, y });

const data = {
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
};

const encodeStart = performance.now();
const encoded = encode(z, data);
const encodeDur = performance.now() - encodeStart;
const decodeStart = performance.now();
const decoded = decode(z, encoded);
const decodeDur = performance.now() - decodeStart;

console.log("Encoded Size:", encoded.length);
console.log(
  "Decoded Match:",
  JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2) ===
    JSON.stringify(decoded, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2),
);
console.log("Decoded Data:", decoded);
console.log("Timings:\n", { encoding: encodeDur, decoding: decodeDur });
