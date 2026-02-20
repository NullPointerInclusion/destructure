import { array } from "broadutils/data";
import type { OrArray } from "broadutils/types";
import { encodingError, EncodingError } from "./error.ts";
import type { DecodedStruct, PrimitiveEncoderMap, Struct } from "./types.ts";
import {
  destructureSimpleStruct,
  encodeNumber,
  getStringCodePoints,
  sortObjectEntries,
} from "./utils.ts";
import { isCustomStruct } from "./struct.ts";

const encodeNumberStruct: {
  <BitLength extends 8 | 16 | 32>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number>,
    isArray: boolean,
    arrayLength: number,
  ): Uint8Array<ArrayBuffer>;
  <BitLength extends 64>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number | bigint>,
    isArray: boolean,
    arrayLength: number,
  ): Uint8Array<ArrayBuffer>;
} = (
  bitLength: number,
  isFloat: boolean,
  isSigned: boolean,
  value: OrArray<number | bigint>,
  isArray: boolean,
  arrayLength: number,
): Uint8Array<ArrayBuffer> => {
  let encoder: (value: (number | bigint)[]) => Uint8Array;
  if (isFloat) {
    if (!(bitLength === 32 || bitLength === 64)) {
      throw encodingError("Invalid bit length for float value.");
    }

    const typedArrayClass = globalThis[`Float${bitLength}Array`];
    encoder = (value) => {
      const arr = new typedArrayClass(value.length);
      for (let i = 0; i < value.length; i++) {
        const num = value[i];
        if (typeof num === "number") arr[i] = num;
        else throw encodingError("Invalid internal state.");
      }

      return new Uint8Array(arr.buffer);
    };
  } else {
    if (bitLength === 8 || bitLength === 16 || bitLength === 32 || bitLength === 64) {
      const typedArrayName =
        bitLength === 64
          ? (`Big${isSigned ? "Int" : "Uint"}${bitLength}Array` as const)
          : (`${isSigned ? "Int" : "Uint"}${bitLength}Array` as const);
      const typedArrayClass = globalThis[typedArrayName];
      encoder = (value) => {
        const arr = new typedArrayClass(value.length);
        for (let i = 0; i < value.length; i++) {
          const num = value[i];
          if (bitLength === 64 && typeof num === "bigint") arr[i] = num;
          else if (typeof num === "number") arr[i] = num;
          else throw encodingError("Invalid internal state.");
        }

        return new Uint8Array(arr.buffer);
      };
    } else {
      throw encodingError(`Unexpected bit length of ${bitLength}.`);
    }
  }

  const values = Array.isArray(value) ? value : [value];
  const _arrayLength = isArray ? arrayLength : 1;

  const encodedValues = encoder(values);
  const lengthBytes = _arrayLength === -1 ? encodeNumber(values.length) : new Uint8Array(0);
  const result = new Uint8Array((lengthBytes.length ? 4 : 0) + encodedValues.length);

  if (lengthBytes.length > 4)
    throw new EncodingError({
      message: "Too many input elements.",
      data: {
        input: values,
        expectedInputLength: arrayLength,
        actualInputLength: values.length,
      },
    });

  result.set(lengthBytes, 0);
  result.set(encodedValues, lengthBytes.length ? 4 : 0);

  return result;
};

const charGuard = (codepoint: number): number => {
  if (codepoint < 256) return codepoint;
  throw encodingError(
    `char codepoint must not exceed an 8-bit binary representation, got ${codepoint.toString(2).length} bits.`,
    codepoint,
  );
};

const encodeOneChar = (char: string): number => {
  if (typeof char !== "string") {
    throw encodingError(`Invalid data. Expected string, got ${typeof char}`);
  }

  const codepoints = getStringCodePoints(char, charGuard);
  if (codepoints.length === 1) return codepoints[0]!;
  throw encodingError("char data must be a string with one codepoint.");
};

export const encoder: PrimitiveEncoderMap & {
  tuple: (struct: Struct[], value: unknown[]) => Uint8Array<ArrayBuffer>;
} = {
  char: (value, isArray, arrayLength) => {
    if (!isArray) {
      if (typeof value === "string") return new Uint8Array([encodeOneChar(value)]);
      throw encodingError(`Invalid data. Expected string, got ${typeof value}`);
    }

    if (!Array.isArray(value)) {
      throw encodingError(`Invalid data. Expected an array, got ${typeof value}`);
    }

    const encodedValues = value.map(encodeOneChar);
    const lengthBytes = arrayLength === -1 ? encodeNumber(encodedValues.length) : new Uint8Array(0);
    const result = new Uint8Array((lengthBytes.length ? 4 : 0) + encodedValues.length);

    if (lengthBytes.length > 4)
      throw new EncodingError({
        message: "Too many elements in input.",
        data: {
          input: value,
          maxArrayLength: 2 ** 32 - 1,
          actualArrayLength: encodedValues.length,
        },
      });

    if (arrayLength !== -1 && encodedValues.length > arrayLength)
      throw new EncodingError({
        message: "Input length exceeded specification.",
        data: {
          input: value,
          expectedInputLength: arrayLength,
          actualInputLength: encodedValues.length,
        },
      });

    result.set(lengthBytes, 0);
    result.set(encodedValues, lengthBytes.length ? 4 : 0);

    return result;
  },
  u8: (...args) => encodeNumberStruct(8, false, false, ...args),
  u16: (...args) => encodeNumberStruct(16, false, false, ...args),
  u32: (...args) => encodeNumberStruct(32, false, false, ...args),
  u64: (...args) => encodeNumberStruct(64, false, false, ...args),
  i8: (...args) => encodeNumberStruct(8, false, true, ...args),
  i16: (...args) => encodeNumberStruct(16, false, true, ...args),
  i32: (...args) => encodeNumberStruct(32, false, true, ...args),
  i64: (...args) => encodeNumberStruct(64, false, true, ...args),
  f32: (...args) => encodeNumberStruct(32, true, false, ...args),
  f64: (...args) => encodeNumberStruct(64, true, false, ...args),
  tuple: (struct, value) => {
    const arrays: Uint8Array<ArrayBuffer>[] = [];
    let totalLength = 0;

    if (struct.length !== value.length)
      throw new EncodingError({
        message: "Tuple length mismatch.",
        struct: struct,
        data: {
          expectedTupleLength: struct.length,
          actualTupleLength: value.length,
        },
      });

    for (let i = 0; i < struct.length; i++) {
      const _struct = struct[i];
      const _data = value[i];

      if (_struct == null || _data == null)
        throw new EncodingError({
          message: "Nullish struct or data",
          struct: struct,
          data: {
            struct: _struct,
            data: _data,
            index: i,
          },
        });

      const result = encode(_struct, _data);
      arrays.push(result);
      totalLength += result.length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }

    return result;
  },
};

export const encode = <T extends Struct>(
  struct: T,
  payload: DecodedStruct<T>,
): Uint8Array<ArrayBuffer> => {
  const pairings: [Struct, any][] = [[struct, payload]];
  const arrays: Uint8Array<ArrayBuffer>[] = [];
  let totalLength = 0;

  while (pairings.length) {
    const pair = pairings.shift();
    if (!pair) continue;

    const [_struct, data] = pair;
    if (typeof _struct === "string") {
      const ds = destructureSimpleStruct(_struct);
      const result = encoder[ds.base](data, ds.isArray, ds.arrayLength);
      totalLength += arrays[arrays.push(result) - 1]!.length;
    } else if (Array.isArray(_struct)) {
      if (!Array.isArray(data)) {
        throw new EncodingError({
          message: "Struct mismatch.",
          struct: struct,
          data: {
            currentStruct: _struct,
            expectedDataType: "array",
            actualDataType: typeof data,
          },
        });
      }

      const structTuple = _struct;
      const tuplePairings: typeof pairings = [];

      for (let i = 0; i < structTuple.length; i++) {
        const _struct = structTuple[i];
        const _data = data[i];

        if (_struct == null || _data == null)
          throw new EncodingError({
            message: "Nullish struct or data",
            struct: struct,
            data: {
              struct: _struct,
              data: _data,
              index: i,
            },
          });

        tuplePairings.push([_struct, _data]);
      }

      pairings.unshift(...tuplePairings);
    } else if (isCustomStruct(_struct)) {
      totalLength += arrays[arrays.push(_struct.encode(data)) - 1]!.length;
    } else if (typeof _struct === "object") {
      if (!(data && typeof data === "object")) {
        throw new EncodingError({
          message: "Struct mismatch.",
          struct: struct,
          data: {
            currentStruct: _struct,
            expectedDataType: "object",
            actualDataType: typeof data,
          },
        });
      }

      const structEntries = sortObjectEntries(Object.entries(_struct));
      const dataEntries = sortObjectEntries(Object.entries(data));
      const pairs: typeof pairings = [];

      if (structEntries.length !== dataEntries.length) {
        throw new EncodingError({
          message: "Struct mismatch.",
          struct: struct,
          data: {
            currentStruct: _struct,
            expectedDataKeys: structEntries.map((e) => e[0]),
            actualDataKeys: dataEntries.map((e) => e[0]),
          },
        });
      }

      for (let i = 0; i < structEntries.length; i++) {
        const se = structEntries[i];
        const de = dataEntries[i];

        if (!se || !de)
          throw new EncodingError({
            message: "Nullish struct or data",
            struct: struct,
            data: {
              structEntry: se,
              dataEntry: de,
            },
          });
        if (se[0] !== de[0])
          throw new EncodingError({
            message: "Struct mismatch.",
            struct: struct,
            data: {
              structEntry: se,
              dataEntry: de,
            },
          });
        pairs.push([se[1], de[1]]);
      }

      pairings.unshift(...pairs);
    } else {
      throw new EncodingError({
        message: "Invalid struct.",
        struct: struct,
        data: {
          currentStruct: _struct,
        },
      });
    }
  }

  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
};
