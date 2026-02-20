import { noop } from "broadutils/misc";
import type { DecodedStruct, PrimitiveDecoderMap, Struct, StructDecodeResult } from "./types.ts";
import { decodeNumber, decodeString } from "./utils.ts";

const decodeNumberStruct: {
  <BitLength extends 8 | 16 | 32>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    buffer: Uint8Array<ArrayBuffer>,
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<number>;
  <BitLength extends 64>(
    bitLength: BitLength,
    isFloat: true,
    isSigned: boolean,
    buffer: Uint8Array<ArrayBuffer>,
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<number>;
  <BitLength extends 64>(
    bitLength: BitLength,
    isFloat: false,
    isSigned: boolean,
    buffer: Uint8Array<ArrayBuffer>,
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<bigint>;
} = (
  bitLength: number,
  isFloat: boolean,
  isSigned: boolean,
  buffer: Uint8Array<ArrayBuffer>,
  offset: number,
  isArray: boolean,
  arrayLength: number,
): StructDecodeResult<any> => {
  let count = 1;
  let currentOffset = offset;

  if (isArray) {
    if (arrayLength === -1) {
      const lengthBytes = buffer.slice(currentOffset, (currentOffset += 4));
      count = decodeNumber(lengthBytes);
    } else {
      count = arrayLength;
    }
  }

  const elementSize = bitLength / 8;
  const totalBytes = count * elementSize;
  const data = buffer.slice(currentOffset, (currentOffset += totalBytes));
  console.log({
    bitLength,
    isFloat,
    isSigned,
    buffer,
    offset,
    isArray,
    arrayLength,
    currentOffset,
    totalBytes,
    data,
  });

  let result: any;
  if (isFloat) {
    if (bitLength === 32 || bitLength === 64) {
      const typedArrayClass = globalThis[`Float${bitLength}Array`];
      result = Array.from(new typedArrayClass(data.buffer));
    } else {
      throw new Error("Invalid bit length for float value.");
    }
  } else {
    if (bitLength === 8 || bitLength === 16 || bitLength === 32 || bitLength === 64) {
      const typedArrayName =
        bitLength === 64
          ? (`Big${isSigned ? "Int" : "Uint"}${bitLength}Array` as const)
          : (`${isSigned ? "Int" : "Uint"}${bitLength}Array` as const);
      const typedArrayClass = globalThis[typedArrayName];
      result = Array.from<number | bigint>(new typedArrayClass(data.buffer));
    } else {
      throw new Error("Unexpected bit length.");
    }
  }

  if (!isArray) result = result[0];

  return { value: result, nextOffset: currentOffset + totalBytes };
};

export const decoder: PrimitiveDecoderMap = {
  char: (arr, offset, isArray, arrayLength) => {
    let currentOffset = offset;
    let byteLength = 0;

    if (!isArray) {
      byteLength = 1;
      const val = arr[currentOffset];
      if (!val) throw new Error("Unexpected element value.");
      return { value: String.fromCodePoint(val), nextOffset: currentOffset + 1 };
    }

    if (arrayLength === -1) {
      const lengthBytes = arr.slice(currentOffset, currentOffset + 4);
      const len = decodeNumber(lengthBytes);
      currentOffset += 4;
      byteLength = len;
    } else {
      byteLength = arrayLength;
    }

    const bytes = arr.slice(currentOffset, (currentOffset += byteLength));
    const decodedString = decodeString(bytes);
    const result = decodedString.split("");

    return { value: result, nextOffset: currentOffset };
  },
  u8: (...args) => decodeNumberStruct(8, false, false, ...args),
  u16: (...args) => decodeNumberStruct(16, false, false, ...args),
  u32: (...args) => decodeNumberStruct(32, false, false, ...args),
  u64: (...args) => decodeNumberStruct(64, false, false, ...args),
  i8: (...args) => decodeNumberStruct(8, false, true, ...args),
  i16: (...args) => decodeNumberStruct(16, false, true, ...args),
  i32: (...args) => decodeNumberStruct(32, false, true, ...args),
  i64: (...args) => decodeNumberStruct(64, false, true, ...args),
  f32: (...args) => decodeNumberStruct(32, true, false, ...args),
  f64: (...args) => decodeNumberStruct(64, true, false, ...args),
};

export const decode = <T extends Struct>(
  struct: T,
  buffer: Uint8Array<ArrayBuffer>,
  offset = 0,
): DecodedStruct<T> => {
  interface DecoderState {
    stack: Struct[];
    stackData: WeakMap<Exclude<Struct, string>, Record<string, any>>;
    offset: number;
    lastValue: any;
  }

  const state: DecoderState = {
    stack: [struct],
    stackData: new WeakMap(),
    offset: offset,
    lastValue: null,
  };

  return "" as any;
};
