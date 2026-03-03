/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { decode } from "../decoder/decoder.js";
import { encode } from "../encoder/encoder.js";
import { array, custom, optional, schema } from "../schema/schema.js";
describe("destructure", () => {
    describe("Primitives", () => {
        it("should encode and decode u8", () => {
            const s = "u8";
            const data = 255;
            const encoded = encode(s, data);
            expect(encoded).toEqual(new Uint8Array([255]));
            expect(decode(s, encoded)).toBe(data);
        });
        it("should encode and decode i32", () => {
            const s = "i32";
            const data = -123456789;
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded).toBe(data);
        });
        it("should encode and decode f64", () => {
            const s = "f64";
            const data = Math.PI;
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded).toBeCloseTo(data, 10);
        });
        it("should encode and decode char", () => {
            const s = "char";
            const data = "A";
            const encoded = encode(s, data);
            expect(encoded).toEqual(new Uint8Array([65]));
            expect(decode(s, encoded)).toBe(data);
        });
    });
    describe("Arrays", () => {
        it("should encode and decode fixed-size primitive arrays", () => {
            const s = "u8[4]";
            const data = [1, 2, 3, 4];
            const encoded = encode(s, data);
            expect(encoded).toEqual(new Uint8Array([1, 2, 3, 4]));
            expect(decode(s, encoded)).toEqual(data);
        });
        it("should encode and decode dynamic primitive arrays", () => {
            const s = "u16[]";
            const data = [1000, 2000, 3000];
            const encoded = encode(s, data);
            // 4 bytes for length (3) + 3 * 2 bytes = 10 bytes
            expect(encoded.length).toBe(10);
            expect(decode(s, encoded)).toEqual(data);
        });
        it("should encode and decode complex arrays using array() helper", () => {
            const s = array({ id: "u32", active: "u8" }, 2);
            const data = [
                { id: 1, active: 1 },
                { id: 2, active: 0 },
            ];
            const encoded = encode(s, data);
            expect(decode(s, encoded)).toEqual(data);
        });
    });
    describe("Objects and Tuples", () => {
        it("should handle nested objects with sorted keys", () => {
            const s = schema({
                b: "u8",
                a: {
                    z: "f32",
                    y: "char",
                },
            });
            const data = {
                b: 42,
                a: { z: 1.5, y: "!" },
            };
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded).toEqual(data);
        });
        it("should handle tuples", () => {
            const s = schema(["u8", "i32", "char"]);
            const data = [255, -1, "X"];
            const encoded = encode(s, data);
            expect(decode(s, encoded)).toEqual(data);
        });
    });
    describe("Optional", () => {
        const s = schema({
            id: "u32",
            metadata: optional("u16"),
            tags: optional(array("char", 3)),
        });
        it("should encode and decode when optional fields are present", () => {
            const data = {
                id: 123,
                metadata: 456,
                tags: ["a", "b", "c"],
            };
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded).toEqual(data);
        });
        it("should encode and decode when optional fields are missing", () => {
            const data = {
                id: 123,
                // metadata and tags are undefined
            };
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded.id).toBe(123);
            expect(decoded.metadata).toBeUndefined();
            expect(decoded.tags).toBeUndefined();
        });
    });
    describe("Custom Handlers", () => {
        it("should handle custom types", () => {
            const dateHandler = custom({
                encode: (d) => {
                    const buf = new Uint8Array(8);
                    new DataView(buf.buffer).setBigUint64(0, BigInt(d.getTime()), true);
                    return buf;
                },
                decode: (buf, offset) => {
                    const time = new DataView(buf.buffer).getBigUint64(offset, true);
                    return { value: new Date(Number(time)), nextOffset: offset + 8 };
                },
                size: () => ({ value: 8, isVariable: false }),
            });
            const s = schema({ timestamp: custom(dateHandler) });
            const now = new Date();
            now.setMilliseconds(0); // For precision in simple comparisons
            const data = { timestamp: now };
            const encoded = encode(s, data);
            const decoded = decode(s, encoded);
            expect(decoded.timestamp.getTime()).toBe(now.getTime());
        });
    });
    describe("Null", () => {
        it("should handle null schemas", () => {
            const s = { field: null };
            const data = { field: null };
            const encoded = encode(s, data);
            expect(decode(s, encoded)).toEqual(data);
        });
    });
});
//# sourceMappingURL=schema.test.js.map