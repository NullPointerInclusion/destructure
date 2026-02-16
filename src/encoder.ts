import { array } from "broadutils/data";
import type { OrArray } from "broadutils/types";
import { encodingError, EncodingError } from "./error.ts";
import type { DecodedStruct, PrimitiveEncoderMap, Struct } from "./types.ts";
import { destructureSimpleStruct, encodeNumber, getStringCodePoints } from "./utils.ts";
import { isCustomStruct } from "./struct.ts";

const encodeNumberStruct: {
  <BitLength extends 8 | 16 | 32>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number>,
    isArray: boolean,
    arrayLength: number,
  ): number[];
  <BitLength extends 64>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number | bigint>,
    isArray: boolean,
    arrayLength: number,
  ): number[];
} = (
  bitLength: number,
  isFloat: boolean,
  isSigned: boolean,
  value: OrArray<number | bigint>,
  isArray: boolean,
  arrayLength: number,
): number[] => {
  let encoder: (value: (number | bigint)[]) => number[];
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

      return [...new Uint8Array(arr.buffer)];
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

        return [...new Uint8Array(arr.buffer)];
      };
    } else {
      throw encodingError(`Unexpected bit length of ${bitLength}.`);
    }
  }

  const values = Array.isArray(value) ? value : [value];
  const _arrayLength = isArray ? arrayLength : 1;
  const result: number[] = [];

  if (_arrayLength === -1) {
    const lengthBytes = array.padEnd(encodeNumber(values.length), 4, 0);
    if (lengthBytes.length > 4)
      throw new EncodingError({
        message: "Too many input elements.",
        data: {
          input: values,
          expectedInputLength: arrayLength,
          actualInputLength: values.length,
        },
      });

    array.append(result, lengthBytes);
  }

  return array.append(result, encoder(values));
};

const charGuard = (codepoint: number): number => {
  if (codepoint < 256) return codepoint;
  throw encodingError(
    `char codepoint must not exceed an 8-bit binary representation, got ${codepoint.toString(2).length} bits.`,
    codepoint,
  );
};

export const encoder: PrimitiveEncoderMap & {
  tuple: (struct: Struct[], value: unknown[]) => number[];
} = {
  char: (value, isArray, arrayLength) => {
    if (!isArray) {
      let codepoints: number[];
      if (typeof value !== "string") {
        throw encodingError(`Invalid data. Expected string, got ${typeof value}`);
      }
      if ((codepoints = getStringCodePoints(value, charGuard)).length !== 1) {
        throw encodingError("char data must be a string with one codepoint.");
      }
      return codepoints;
    }

    if (!Array.isArray(value)) {
      throw encodingError(`Invalid data. Expected an array, got ${typeof value}`);
    }

    const result: number[] = [];
    for (let i = 0; i < value.length; i++) {
      const char = value[i]!;
      let codepoints: number[];
      if (typeof char !== "string") throw encodingError("Invalid data type. Expected string.");
      if ((codepoints = getStringCodePoints(char, charGuard)).length !== 1) {
        throw encodingError("char data must be a string with one codepoint.");
      }
      array.append(result, codepoints);
    }

    if (arrayLength === -1) {
      const lengthBytes = array.padEnd(encodeNumber(result.length), 4, 0);
      if (lengthBytes.length > 4)
        throw new EncodingError({
          message: "Too many elements in input.",
          data: {
            input: result,
            expectedArrayLength: arrayLength,
            actualArrayLength: result.length,
          },
        });
      result.unshift(...lengthBytes);
    } else {
      array.padEnd(result, arrayLength, 0);
      if (result.length > arrayLength)
        throw new EncodingError({
          message: "Input length exceeded specification.",
          data: {
            input: result,
            expectedInputLength: arrayLength,
            actualInputLength: result.length,
          },
        });
    }

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
    const result: number[] = [];

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

      array.append(result, encode(_struct, _data));
    }

    return result;
  },
};

export const encode = <T extends Struct>(struct: T, payload: DecodedStruct<T>): number[] => {
  const pairings: [Struct, any][] = [[struct, payload]];
  const result: number[] = [];
  while (pairings.length) {
    const pair = pairings.shift();
    if (!pair) continue;

    const [_struct, data] = pair;
    if (typeof _struct === "string") {
      const ds = destructureSimpleStruct(_struct);
      result.push(...encoder[ds.base](data, ds.isArray, ds.arrayLength));
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
    } else if (isCustomStruct(_struct)) result.push(..._struct.encode(data));
    else if (typeof _struct === "object") {
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

      const structEntries = Object.entries(_struct);
      const dataEntries = Object.entries(data);
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

  return result;
};
