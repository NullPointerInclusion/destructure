import type { DestructuredSimpleStruct, SimpleStruct, PrimitiveType } from './types.ts';

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

export const PRIMITIVE_TYPES: Set<PrimitiveType> = new Set([
  'char',
  'u8',
  'u16',
  'u32',
  'i8',
  'i16',
  'i32',
  'u64',
  'i64',
  'f32',
  'f64',
]);

export const numberCoder = {
  encode: (value: number): number[] => {
    const result: number[] = [];
    do {
      result.push(value & 0xff);
      value = Math.floor(value / 256);
    } while (value);

    return result;
  },
  decode: (value: number[]): number => {
    let result = 0;
    for (let i = 0; i < value.length; ) result += (value[i] ?? 0) * 256 ** i++;
    return result;
  },
};

export const destructureSimpleStruct = (struct: SimpleStruct): DestructuredSimpleStruct => {
  const regex = /^([a-z0-9]+)(\[([0-9]+)?\])?$/i;
  const match = struct.match(regex);
  if (!match) throw new Error('Invalid struct.');

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
