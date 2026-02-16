import type { DestructuredSimpleStruct, PrimitiveType, SimpleStruct } from "./types.ts";

export const BASE_SIZE: Record<PrimitiveType, number> = {
  char: 8,
  u8: 8,
  u16: 16,
  u32: 32,
  u64: 64,
  i8: 8,
  i16: 16,
  i32: 32,
  i64: 64,
  f32: 32,
  f64: 64,
} as const;

export const PRIMITIVE_TYPES_ARRAY: ReadonlyArray<PrimitiveType> = Object.freeze([
  "char",
  "u8",
  "u16",
  "u32",
  "i8",
  "i16",
  "i32",
  "u64",
  "i64",
  "f32",
  "f64",
]);

export const PRIMITIVE_TYPES: ReadonlySet<PrimitiveType> = (<T>(set: Set<T>) => {
  set.add = (value) => set;
  set.delete = (value) => false;
  set.clear = () => {};
  return Object.freeze(set) as ReadonlySet<T>;
})(new Set(PRIMITIVE_TYPES_ARRAY));

export const PRIMITIVE_TYPE_REGEX = Object.freeze(
  new RegExp(`^((?:${PRIMITIVE_TYPES_ARRAY.join("|")})+)(\\[([0-9])?\\])?$`, "i"),
);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const encodeNumber = (value: number): number[] => {
  const result: number[] = [];

  do {
    result.push(value & 0xff);
    value = Math.floor(value / 256);
  } while (value);

  return result;
};
export const decodeNumber = (value: number[]): number => {
  let result = 0;
  for (let i = 0; i < value.length; ) result += (value[i] ?? 0) * 256 ** i++;
  return result;
};
export const encodeString = (value: string): number[] => [...textEncoder.encode(value)];
export const decodeString = (value: number[]): string => textDecoder.decode(new Uint8Array(value));
export const getStringCodePoints = (value: string, guardFn?: (cp: number) => number) => {
  const codepoints: number[] = [];

  if (guardFn) {
    for (let i = 0; i < value.length; i++) codepoints.push(guardFn(value.codePointAt(i) || 0));
  } else {
    for (let i = 0; i < value.length; i++) codepoints.push(value.codePointAt(i) || 0);
  }

  return codepoints;
};

export const destructureSimpleStruct = (struct: SimpleStruct): DestructuredSimpleStruct => {
  const match = struct.match(PRIMITIVE_TYPE_REGEX);
  if (!match) throw new Error("Invalid struct.");

  const [_input, base, array, arrayLength] = match;
  if (!PRIMITIVE_TYPES.has(base as PrimitiveType)) {
    throw new Error(`Unknown primitive type: ${base}`);
  }

  return {
    base: base as PrimitiveType,
    isArray: array != null,
    arrayLength: arrayLength == null ? -1 : +arrayLength,
  };
};
