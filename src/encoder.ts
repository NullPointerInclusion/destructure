import type { OrArray } from "broadutils/types";
import { encodingError, EncodingError } from "./error.ts";
import type {
  CustomStruct,
  Data,
  ObjectStruct,
  SimpleStruct,
  Struct,
  TupleStruct,
} from "./struct.ts";
import { getStructType, StructType } from "./struct.ts";
import type { EncoderState, GrowingBuffer, PrimitiveEncoderMap } from "./types.ts";
import {
  destructureSimpleStruct,
  encodeNumber,
  getStringCodePoints,
  sortObjectEntries,
} from "./utils.ts";

const createEncoderState = (): EncoderState => ({ buffer: createGrowingBuffer() });
const createGrowingBuffer = (initialSize = 1024 * 4, growthFactor = 2): GrowingBuffer => {
  const buffer = new ArrayBuffer(initialSize);
  return {
    buffer: buffer,
    view: new DataView(buffer),
    growthFactor: growthFactor,
    offset: 0,

    ensureCapacity(byteLength) {
      while (this.offset + byteLength > this.buffer.byteLength) {
        const previousData = new Uint8Array(this.buffer);
        const newData = new Uint8Array(this.buffer.byteLength * this.growthFactor);
        newData.set(previousData, 0);
        this.buffer = newData.buffer;
      }

      if (this.view.buffer !== this.buffer) this.view = new DataView(this.buffer);
      return null;
    },

    normalise() {
      return this.buffer.slice(0, this.offset);
    },
  };
};

const encodeNumberStruct: {
  <BitLength extends 8 | 16 | 32>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number>,
    isArray: boolean,
    arrayLength: number,
    state: EncoderState,
  ): null;
  <BitLength extends 64>(
    bitLength: BitLength,
    isFloat: boolean,
    isSigned: boolean,
    value: OrArray<number | bigint>,
    isArray: boolean,
    arrayLength: number,
    state: EncoderState,
  ): null;
} = (
  bitLength: number,
  isFloat: boolean,
  isSigned: boolean,
  value: OrArray<number | bigint>,
  isArray: boolean,
  arrayLength: number,
  state: EncoderState,
): null => {
  const buffer = state.buffer;
  const values = Array.isArray(value) ? value : [value];
  const byteLength = bitLength / 8;
  const shouldEncodeLength = isArray && arrayLength !== -1;
  const lengthBytes = shouldEncodeLength ? encodeNumber(values.length) : new Uint8Array(0);
  const totalLength = (shouldEncodeLength ? 4 : 0) + byteLength * values.length;
  let writer:
    | DataView[
        | `setFloat${32 | 64}`
        | `set${"Int" | "Uint"}${8 | 16 | 32}`
        | `setBig${"Int" | "Uint"}${64}`]
    | null = null;

  if (isFloat) {
    if (bitLength === 32) writer = state.buffer.view.setFloat32;
    if (bitLength === 64) writer = state.buffer.view.setFloat64;
  } else {
    if (isSigned) {
      if (bitLength === 8) writer = state.buffer.view.setInt8;
      if (bitLength === 16) writer = state.buffer.view.setInt16;
      if (bitLength === 32) writer = state.buffer.view.setInt32;
      if (bitLength === 64) writer = state.buffer.view.setBigInt64;
    } else {
      if (bitLength === 8) writer = state.buffer.view.setUint8;
      if (bitLength === 16) writer = state.buffer.view.setUint16;
      if (bitLength === 32) writer = state.buffer.view.setUint32;
      if (bitLength === 64) writer = state.buffer.view.setBigUint64;
    }
  }

  if (!writer) throw encodingError("Could not find a valid writer for the given arguments.");
  if (isArray && arrayLength !== -1 && values.length !== arrayLength) {
    throw encodingError("Struct mismatch.");
  }

  buffer.ensureCapacity(totalLength);
  writer = writer.bind(buffer.view);

  for (const num of lengthBytes) buffer.view.setUint8(buffer.offset++, num);
  for (const value of values) {
    // @ts-expect-error
    writer(buffer.offset, value, true);
    buffer.offset += byteLength;
  }

  return null;
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

export const encoder: PrimitiveEncoderMap = {
  char: (value, isArray, arrayLength, state) => {
    const buffer = state.buffer;

    if (!isArray) {
      if (typeof value === "string") {
        buffer.ensureCapacity(1);
        buffer.view.setUint8(buffer.offset++, encodeOneChar(value));
      }
      throw encodingError(`Invalid data. Expected string, got ${typeof value}`);
    }

    if (!Array.isArray(value)) {
      throw encodingError(`Invalid data. Expected an array, got ${typeof value}`);
    }

    const encodedValues = value.map(encodeOneChar);
    const lengthBytes = arrayLength === -1 ? encodeNumber(encodedValues.length) : new Uint8Array(0);

    if (lengthBytes.length > 4)
      throw new EncodingError({
        message: "Too many elements in input.",
        data: {
          input: value,
          maxArrayLength: 2 ** 32 - 1,
          actualArrayLength: encodedValues.length,
        },
      });

    if (arrayLength !== -1 && encodedValues.length !== arrayLength)
      throw new EncodingError({
        message: "Input length did not match specification.",
        data: {
          input: value,
          expectedInputLength: arrayLength,
          actualInputLength: encodedValues.length,
        },
      });

    buffer.ensureCapacity(lengthBytes.length + encodedValues.length);
    for (const num of lengthBytes) buffer.view.setUint8(buffer.offset++, num);
    for (const num of encodedValues) buffer.view.setUint8(buffer.offset++, num);

    return null;
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
};

export const encode = <T extends Struct>(
  struct: T,
  payload: Data<T>,
  state = createEncoderState(),
): Uint8Array<ArrayBuffer> => {
  const pairings: [Struct, any][] = [[struct, payload]];

  while (pairings.length) {
    const pair = pairings.shift();
    if (!pair) continue;

    switch (getStructType(pair[0])) {
      case StructType.Simple: {
        const ds = destructureSimpleStruct(pair[0] as SimpleStruct);
        const result = encoder[ds.base](pair[1], ds.isArray, ds.arrayLength, state);
        break;
      }
      case StructType.Object: {
        const structEntries = sortObjectEntries(Object.entries(pair[0] as ObjectStruct));
        const dataEntries = sortObjectEntries(Object.entries(pair[1]));
        const pairs: typeof pairings = [];

        if (structEntries.length !== dataEntries.length) {
          throw new EncodingError({
            message: "Struct mismatch.",
            struct: struct,
            data: {
              currentStruct: pair[0],
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
        break;
      }
      case StructType.Tuple: {
        const [struct, data] = pair as [TupleStruct, any];
        pairings.unshift(...struct.map<[Struct, any]>((s, i) => [s, data[i]]));
        break;
      }
      case StructType.Custom: {
        const result = (pair[0] as CustomStruct).encode(pair[1]);
        break;
      }
      default: {
        throw new EncodingError({
          message: "Invalid struct.",
          struct: struct,
          data: {
            currentStruct: pair[0],
          },
        });
      }
    }
  }

  return new Uint8Array(state.buffer.normalise());
};
