import { array, object } from "broadutils/data";
import type { OrArray } from "broadutils/types";
import { nonNullable } from "broadutils/validate";

import type {
  CustomStruct,
  DecodedStruct,
  DestructuredSimpleStruct,
  PrimitiveDecoderMap,
  PrimitiveEncoderMap,
  PrimitiveType,
  SimpleStruct,
  SizeOfResult,
  Struct,
  StructDecodeResult
} from "./types.ts";
import { baseSize, destructureSimpleStruct } from "./utils.ts"

const customStructKey = crypto.randomUUID();
const createStruct = <T extends Struct>(struct: T): T => struct;
const createCustomStruct = <T>(customStruct: Omit<CustomStruct<T>, "key">) => {
  const key = customStructKey;
  if (!("key" in customStruct)) return object.mergeInto({ key }, customStruct);
  throw new Error("The custom struct object must not provide its own key.");
};
const isCustomStruct = (value: unknown): value is CustomStruct<any> => {
  return (
    typeof value === "object" && value !== null && "key" in value && value.key === customStructKey
  );
};

const sizeof = (struct: Struct): SizeOfResult => {
  const result: SizeOfResult = { value: 0, isVariable: false };
  if (isCustomStruct(struct)) return struct.size();
  if (typeof struct === "string") {
    const { base, isArray, arrayLength } = destructureSimpleStruct(struct);
    const bSize = baseSize[base] / 8;
    if (isArray) {
      result.value = arrayLength === -1 ? 4 : bSize * arrayLength;
      result.isVariable = arrayLength === -1;
    } else {
      result.value = bSize;
      result.isVariable = false;
    }

    return result;
  }

  for (const value of Object.values(struct)) {
    const size = sizeof(value);
    result.value += size.value;
    result.isVariable ||= size.isVariable;
  }

  return result;
};
const arrayof = <T extends Struct>(
  struct: T,
  length: number | null = null,
): CustomStruct<DecodedStruct<T>[]> => {
  return createCustomStruct({
    encode: (value) => [],
    decode: (arr, offset) => ({ value: [], bytesConsumed: 0 }),
    size: () => ({ value: 0, isVariable: true }),
  });
};

const numberCoder = {
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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const encodeNumber: {
  <ByteLength extends 8 | 16 | 32>(
    byteLength: ByteLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number>,
    isArray: boolean,
    arrayLength: number,
  ): number[];
  <ByteLength extends 64>(
    byteLength: ByteLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number | bigint>,
    isArray: boolean,
    arrayLength: number,
  ): number[];
} = (
  byteLength: number,
  isFloat: boolean,
  isSigned: boolean,
  value: OrArray<number | bigint>,
  isArray: boolean,
  arrayLength: number,
): number[] => {
  let encoder: (value: (number | bigint)[]) => number[];
  if (isFloat) {
    if (!(byteLength === 32 || byteLength === 64)) {
      throw new Error("Invalid bit length for float value.");
    }

    const typedArrayClass = globalThis[`Float${byteLength}Array`];
    encoder = (value) => {
      const arr = new typedArrayClass(value.length);
      for (let i = 0; i < value.length; i++) {
        const num = value[i];
        if (typeof num === "number") arr[i] = num;
        else throw new Error("Expected number.");
      }

      return [...new Uint8Array(arr.buffer)];
    };
  } else {
    if (byteLength === 8 || byteLength === 16 || byteLength === 32 || byteLength === 64) {
      const typedArrayName =
        byteLength === 64
          ? (`Big${isSigned ? "Int" : "Uint"}${byteLength}Array` as const)
          : (`${isSigned ? "Int" : "Uint"}${byteLength}Array` as const);
      const typedArrayClass = globalThis[typedArrayName];
      encoder = (value) => {
        const arr = new typedArrayClass(value.length);
        for (let i = 0; i < value.length; i++) {
          const num = value[i];
          if (byteLength === 64 && typeof num === "bigint") arr[i] = num;
          else if (typeof num === "number") arr[i] = num;
          else throw new Error("Expected number.");
        }

        return [...new Uint8Array(arr.buffer)];
      };
    } else {
      throw new TypeError("Unexpected byteLength.");
    }
  }

  const values = Array.isArray(value) ? value : [value];
  const _arrayLength = isArray ? arrayLength : 1;
  const result: number[] = [];

  if (_arrayLength === -1) {
    const lengthBytes = array.padEnd(numberCoder.encode(values.length), 4, 0);
    if (lengthBytes.length > 4) throw new Error("Too many input elements.");

    array.append(result, lengthBytes);
  }

  return array.append(result, encoder(values));
};

const decodeNumber: {
  <ByteLength extends 8 | 16 | 32>(
    byteLength: ByteLength,
    isFloat: boolean,
    isSigned: boolean,
    arr: number[],
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<number>;
  <ByteLength extends 64>(
    byteLength: ByteLength,
    isFloat: true,
    isSigned: boolean,
    arr: number[],
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<number>;
  <ByteLength extends 64>(
    byteLength: ByteLength,
    isFloat: false,
    isSigned: boolean,
    arr: number[],
    offset: number,
    isArray: boolean,
    arrayLength: number,
  ): StructDecodeResult<bigint>;
} = (
  byteLength: number,
  isFloat: boolean,
  isSigned: boolean,
  arr: number[],
  offset: number,
  isArray: boolean,
  arrayLength: number,
): StructDecodeResult<any> => {
  let count = 1;
  let currentOffset = offset;

  if (isArray) {
    if (arrayLength === -1) {
      const lengthBytes = arr.slice(currentOffset, currentOffset + 4);
      count = numberCoder.decode(lengthBytes);
      currentOffset += 4;
    } else {
      count = arrayLength;
    }
  }

  const elementSize = byteLength / 8;
  const totalBytes = count * elementSize;
  const dataBytes = arr.slice(currentOffset, currentOffset + totalBytes);
  const buffer = new Uint8Array(dataBytes).buffer;

  let result: any;
  if (isFloat) {
    if (byteLength === 32 || byteLength === 64) {
      const typedArrayClass = globalThis[`Float${byteLength}Array`];
      result = Array.from(new typedArrayClass(buffer));
    } else {
      throw new Error("Invalid bit length for float value.");
    }
  } else {
    if (byteLength === 8 || byteLength === 16 || byteLength === 32 || byteLength === 64) {
      const typedArrayName =
        byteLength === 64
          ? (`Big${isSigned ? "Int" : "Uint"}${byteLength}Array` as const)
          : (`${isSigned ? "Int" : "Uint"}${byteLength}Array` as const);
      const typedArrayClass = globalThis[typedArrayName];
      result = Array.from<number | bigint>(new typedArrayClass(buffer));
    } else {
      throw new Error("Unexpected bit length.");
    }
  }

  if (!isArray) result = result[0];

  return { value: result, bytesConsumed: currentOffset + totalBytes - offset };
};

const encoder: PrimitiveEncoderMap = {
  char: (value, isArray, arrayLength) => {
    const result: number[] = [];
    if (!isArray) {
      if (!(typeof value === "string" && value.length === 1)) {
        throw new TypeError(
          `Invalid data. Expected string of length 1, got ${Object.toString.call(value)}`,
        );
      }

      result.push(textEncoder.encode(value)[0]!);
    } else {
      if (!Array.isArray(value)) {
        throw new TypeError(`Invalid data. Expected an array, got ${Object.toString.call(value)}`);
      }

      let string = "";
      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (typeof char !== "string") throw new TypeError("Invalid data type. Expected string.");
        if (char.length !== 1) throw new Error(`A "char" value must be a string of length 1.`);
        string += char;
      }

      const encoded = [...textEncoder.encode(string)];

      if (arrayLength === -1) {
        const lengthBytes = array.padEnd(numberCoder.encode(encoded.length), 4, 0);
        if (lengthBytes.length > 4) throw new Error("Too many elements in input.");

        array.append(result, lengthBytes, encoded);
      } else {
        array.padEnd(encoded, arrayLength, 0);
        if (encoded.length > arrayLength) {
          throw new RangeError("Input length exceeded specification.");
        }

        array.append(result, encoded);
      }
    }
    return result;
  },
  u8: (...args) => encodeNumber(8, false, false, ...args),
  u16: (...args) => encodeNumber(16, false, false, ...args),
  u32: (...args) => encodeNumber(32, false, false, ...args),
  u64: (...args) => encodeNumber(64, false, false, ...args),
  i8: (...args) => encodeNumber(8, false, true, ...args),
  i16: (...args) => encodeNumber(16, false, true, ...args),
  i32: (...args) => encodeNumber(32, false, true, ...args),
  i64: (...args) => encodeNumber(64, false, true, ...args),
  f32: (...args) => encodeNumber(32, true, false, ...args),
  f64: (...args) => encodeNumber(64, true, false, ...args),
};

const decoder: PrimitiveDecoderMap = {
  char: (arr, offset, isArray, arrayLength) => {
    let currentOffset = offset;
    let byteLength = 0;

    if (!isArray) {
      byteLength = 1;
      const val = arr[currentOffset];
      if (!val) throw new Error("Unexpected element value.");
      return { value: String.fromCharCode(val), bytesConsumed: 1 };
    }

    if (arrayLength === -1) {
      const lengthBytes = arr.slice(currentOffset, currentOffset + 4);
      const len = numberCoder.decode(lengthBytes);
      currentOffset += 4;
      byteLength = len;
    } else {
      byteLength = arrayLength;
    }

    const bytes = arr.slice(currentOffset, currentOffset + byteLength);
    const decodedString = textDecoder.decode(new Uint8Array(bytes));
    const result = decodedString.split("");

    return { value: result, bytesConsumed: currentOffset + byteLength - offset };
  },
  u8: (...args) => decodeNumber(8, false, false, ...args),
  u16: (...args) => decodeNumber(16, false, false, ...args),
  u32: (...args) => decodeNumber(32, false, false, ...args),
  u64: (...args) => decodeNumber(64, false, false, ...args),
  i8: (...args) => decodeNumber(8, false, true, ...args),
  i16: (...args) => decodeNumber(16, false, true, ...args),
  i32: (...args) => decodeNumber(32, false, true, ...args),
  i64: (...args) => decodeNumber(64, false, true, ...args),
  f32: (...args) => decodeNumber(32, true, false, ...args),
  f64: (...args) => decodeNumber(64, true, false, ...args),
};

const encode = <T extends Struct>(struct: T, payload: DecodedStruct<T>): number[] => {
  const pairings: [Struct, any][] = [[struct, payload]];
  const result: number[] = [];
  while (pairings.length) {
    const pair = pairings.shift();
    if (!pair) continue;

    const [_struct, data] = pair;
    if (typeof _struct === "string") {
      const ds = destructureSimpleStruct(_struct);
      result.push(...encoder[ds.base](data, ds.isArray, ds.arrayLength));
    } else if (isCustomStruct(_struct)) {
      result.push(..._struct.encode(data));
    } else if (typeof _struct === "object") {
      if (!(data && typeof data === "object")) {
        throw new TypeError("Struct mismatch.");
      }

      const structEntries = Object.entries(_struct);
      const dataEntries = Object.entries(data);
      const pairs: typeof pairings = [];

      if (structEntries.length !== dataEntries.length) {
        throw new TypeError("Struct mismatch.");
      }

      for (let i = 0; i < structEntries.length; i++) {
        const se = structEntries[i];
        const de = dataEntries[i];

        if (!se || !de) throw new TypeError("Struct mismatch.");
        if (se[0] !== de[0]) throw new TypeError("Struct mismatch.");
        pairs.push([se[1], de[1]]);
      }

      pairings.unshift(...pairs);
    } else throw new TypeError("Invalid Struct.");
  }

  return result;
};

const decode = <T extends Struct>(struct: T, buffer: number[], offset = 0): DecodedStruct<T> => {
  const _decode = (s: Struct, buf: number[], off: number): StructDecodeResult<any> => {
    if (typeof s === "string") {
      const { base, isArray, arrayLength } = destructureSimpleStruct(s);
      return decoder[base](buf, off, isArray, arrayLength);
    } else if (isCustomStruct(s)) {
      return s.decode(buf, off);
    } else {
      const resultObj: any = {};
      let currentOff = off;
      for (const key in s) {
        const res = _decode(nonNullable(s[key]), buf, currentOff);
        resultObj[key] = res.value;
        currentOff += res.bytesConsumed;
      }
      return { value: resultObj, bytesConsumed: currentOff - off };
    }
  };

  return _decode(struct, buffer, offset).value;
};

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

const encoded = encode(z, data);
const decoded = decode(z, encoded);

console.log("Encoded Size:", encoded.length);
console.log(
  "Decoded Match:",
  JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2) ===
    JSON.stringify(decoded, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2),
);
console.log("Decoded Data:", decoded);
