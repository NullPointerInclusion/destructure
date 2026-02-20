import { decode } from "./decoder.ts";
import { encode } from "./encoder.ts";
import { createCustomStruct, createStruct, isCustomStruct } from "./struct.ts";
import type { CustomStruct, SizeOfResult, Struct } from "./types.ts";
import { BASE_SIZE, destructureSimpleStruct } from "./utils.ts";

const sizeof = (struct: Struct): SizeOfResult => {
  const result: SizeOfResult = { value: 0, isVariable: false };
  if (isCustomStruct(struct)) return struct.size();
  if (typeof struct === "string") {
    const { base, isArray, arrayLength } = destructureSimpleStruct(struct);
    const bSize = BASE_SIZE[base] / 8;
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

export { createCustomStruct, createStruct, decode, encode, isCustomStruct, sizeof };
export type { CustomStruct };
