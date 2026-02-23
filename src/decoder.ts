import { decodingError } from "./error.ts";
import type {
  CustomStruct,
  Data,
  SimpleStruct,
  Struct,
  StructDecodeResult,
  TupleStruct,
} from "./struct.ts";
import { getStructType, StructType } from "./struct.ts";
import type { PrimitiveDecoderMap } from "./types.ts";
import { decodeNumber, decodeString, destructureSimpleStruct, sortObjectEntries } from "./utils.ts";

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

const decodeNumberStruct2: {
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
  const dv = new DataView(buffer.buffer, currentOffset, totalBytes);
  let result: any = [];

  let methodName:
    | `getFloat${32 | 64}`
    | `get${"Int" | "Uint"}${8 | 16 | 32}`
    | `getBig${"Int" | "Uint"}${64}`;
  {
    if (isFloat) {
      if (bitLength === 32) methodName = "getFloat32";
      else if (bitLength === 64) methodName = "getFloat64";
      else throw decodingError(`Unexpected bit length of ${bitLength} for floats.`);
    } else {
      if (bitLength === 8 || bitLength === 16 || bitLength === 32 || bitLength === 64) {
        methodName =
          bitLength === 64
            ? `getBig${isSigned ? "Int" : "Uint"}${bitLength}`
            : `get${isSigned ? "Int" : "Uint"}${bitLength}`;
      } else throw decodingError(`Unexpected bit length of ${bitLength}.`);
    }
  }

  let viewOffset = 0;
  while (count--) {
    result.push(dv[methodName](viewOffset, true));
    viewOffset += elementSize;
  }

  return { value: isArray ? result : result[0], nextOffset: currentOffset + totalBytes };
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
  u8: (...args) => decodeNumberStruct2(8, false, false, ...args),
  u16: (...args) => decodeNumberStruct2(16, false, false, ...args),
  u32: (...args) => decodeNumberStruct2(32, false, false, ...args),
  u64: (...args) => decodeNumberStruct2(64, false, false, ...args),
  i8: (...args) => decodeNumberStruct2(8, false, true, ...args),
  i16: (...args) => decodeNumberStruct2(16, false, true, ...args),
  i32: (...args) => decodeNumberStruct2(32, false, true, ...args),
  i64: (...args) => decodeNumberStruct2(64, false, true, ...args),
  f32: (...args) => decodeNumberStruct2(32, true, false, ...args),
  f64: (...args) => decodeNumberStruct2(64, true, false, ...args),
};

export const decode = <T extends Struct>(
  struct: T,
  buffer: Uint8Array<ArrayBuffer>,
  offset = 0,
): Data<T> => {
  type ObjectQueueEntry = ["object", Record<string, any>, string];
  type TupleQueueEntry = ["tuple", any[]];
  interface DecoderState {
    stack: Struct[];
    stackData: WeakMap<Exclude<Struct, string>, Record<string, any>>;
    processingQueue: (ObjectQueueEntry | TupleQueueEntry)[];
    offset: number;
    result: any;
  }

  const state: DecoderState = {
    stack: [struct],
    stackData: new WeakMap(),
    processingQueue: [],
    offset: offset,
    result: null,
  };
  const handleQueue = (value: any): typeof value => {
    const processingQueue = state.processingQueue;
    if (!processingQueue.length) return value;

    const entry = processingQueue.shift()!;
    if (entry[0] === "object") entry[1][entry[2]] = value;
    else if (entry[0] === "tuple") entry[1].push(value);

    return value;
  };

  do {
    const current = state.stack.shift();
    if (!current) continue;

    let _value: any = null;
    switch (getStructType(current)) {
      case StructType.Simple: {
        const { base, isArray, arrayLength } = destructureSimpleStruct(current as SimpleStruct);
        const { value, nextOffset } = decoder[base](buffer, state.offset, isArray, arrayLength);
        state.offset = nextOffset;

        handleQueue((_value = value));
        break;
      }
      case StructType.Object: {
        const entries = sortObjectEntries(Object.entries(current));
        const value: Record<string, any> = {};

        handleQueue((_value = value));
        state.stack.unshift(...entries.map((entry) => entry[1]));
        state.processingQueue.unshift(
          ...entries.map<ObjectQueueEntry>((entry) => ["object", value, entry[0]]),
        );
        break;
      }
      case StructType.Tuple: {
        const struct = current as TupleStruct;
        const value: any[] = [];
        const procEntry = ["tuple", handleQueue((_value = value))];
        state.stack.unshift(...(current as TupleStruct));
        state.processingQueue.unshift(...new Array(struct.length).fill(procEntry));
        break;
      }
      case StructType.Custom: {
        const { value, nextOffset } = (current as CustomStruct).decode(buffer, state.offset);
        state.offset = nextOffset;

        handleQueue((_value = value));
        break;
      }
    }

    state.result === null && (state.result = _value);
  } while (state.stack.length);

  return state.result;
};
