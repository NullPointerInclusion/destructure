import type { PrimitiveType, SimpleSchema } from "../schema/schema.ts";
import type { DestructuredSimpleSchema, GrowingBuffer } from "./types.ts";

export const PRIMITIVE_TYPES_ARRAY: ReadonlyArray<PrimitiveType> = Object.freeze([
  "char",
  "u8",
  "u16",
  "u32",
  "i8",
  "i16",
  "i32",
  "f32",
  "f64",
]);

export const PRIMITIVE_TYPES: ReadonlySet<PrimitiveType> = new Set(PRIMITIVE_TYPES_ARRAY);

export const BITLENGTH_REGEX = /(8|16|32|64)$/;
export const PRIMITIVE_TYPE_REGEX = new RegExp(
  `^((?:${PRIMITIVE_TYPES_ARRAY.join("|")})+)(\\[([0-9])?\\])?$`,
  "i",
);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Math.log(256) -> 5.545177444479562
const getByteCount = (x: number) => +!(x % 256) + Math.ceil(Math.log(x) / 5.545177444479562);

export const coder = {
  encodeNumber: (value: number): Uint8Array<ArrayBuffer> => {
    const result = new Uint8Array(getByteCount(value));
    let offset = 0;

    do {
      result[offset++] = value & 0xff;
      value = Math.floor(value / 256);
    } while (value);

    return result;
  },

  decodeNumber: (value: ArrayLike<number>): number => {
    let result = 0;
    for (let i = 0; i < value.length; result += (value[i] ?? 0) * 256 ** i++);
    return result;
  },

  encodeString: (value: string): Uint8Array<ArrayBuffer> => textEncoder.encode(value),
  decodeString: (x: ArrayLike<number>): string => textDecoder.decode(new Uint8Array(x)),
};

export const getStringCodePoints = (value: string, guardFn?: (cp: number) => number) => {
  const codepoints: number[] = [];
  if (typeof value !== "string") throw new TypeError("value must be a string.");

  if (guardFn) {
    for (let i = 0; i < value.length; i++) codepoints.push(guardFn(value.codePointAt(i) || 0));
  } else {
    for (let i = 0; i < value.length; i++) codepoints.push(value.codePointAt(i) || 0);
  }

  return codepoints;
};

export const destructureSimpleSchema = (schema: SimpleSchema): DestructuredSimpleSchema => {
  const match = schema.match(PRIMITIVE_TYPE_REGEX);
  if (!match) throw new Error("Invalid struct.");

  const [_input, base, array, arrayLength] = match;
  const [_, _byteLength] = base?.match(BITLENGTH_REGEX) || [];
  if (_byteLength == null && base !== "char") throw new Error("Invalid struct.");

  if (!PRIMITIVE_TYPES.has(base as PrimitiveType)) {
    throw new Error(`Unknown primitive type: ${base}`);
  }

  return {
    base: base as PrimitiveType,
    isArray: array != null,
    byteLength: base === "char" ? 1 : +_byteLength! / 8,
    arrayLength: arrayLength == null ? -1 : +arrayLength,
  };
};

export const sortObjectKeys = (a: PropertyKey, b: PropertyKey): number => {
  const _a = String(a);
  const _b = String(b);
  if (_a < _b) return -1;
  if (_a > _b) return 1;
  return 0;
};

export const sortObjectEntries = <Key extends PropertyKey, Value>(
  entries: [Key, Value][],
): [Key, Value][] => {
  return entries.sort(([a], [b]) => sortObjectKeys(a, b));
};

export const createGrowingBuffer = (initialSize = 1024 * 4, growth = 2): GrowingBuffer => {
  let buffer = new Uint8Array(initialSize);
  return {
    buffer: buffer,
    view: new DataView(buffer.buffer),
    growthFactor: growth > 1 ? growth : 2,
    offset: 0,

    updateGrowthFactor(value: number) {
      if (!Number.isFinite(value)) throw new Error("Growth factor must be finite.");
      if (value <= 1) throw new Error("Growth factor must be greater than 1.");
      this.growthFactor = value;
      return null;
    },

    ensureCapacity(byteLength: number): null {
      if (this.buffer.byteLength >= this.offset + byteLength) return null;

      const newBuffer = new Uint8Array(
        Math.ceil(Math.max(this.buffer.byteLength * this.growthFactor, this.offset + byteLength)),
      );

      newBuffer.set(this.buffer, 0);
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer.buffer);

      return null;
    },

    writeOne(value: number): null {
      this.ensureCapacity(1);
      this.buffer[this.offset++] = value;
      return null;
    },

    write(values: ArrayLike<number>): null {
      this.ensureCapacity(values.length);
      this.buffer.set(values, this.offset);
      this.offset += values.length;
      return null;
    },

    finalise(): Uint8Array<ArrayBuffer> {
      return this.buffer.slice(0, this.offset);
    },
  };
};

export type * from "./types.ts";
