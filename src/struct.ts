import { object } from "broadutils/data";
import { StructError } from "./error.ts";
import type { CustomStruct, PrimitiveType, Struct } from "./types.ts";
import { PRIMITIVE_TYPE_REGEX } from "./utils.ts";

const customStructKey = crypto.randomUUID();
const structMap: WeakSet<Exclude<Struct, string>> = new WeakSet();

export const createStruct = <T extends Struct>(struct: T): T => {
  if (!struct) {
    throw new StructError({
      message: "Invalid struct.",
      type: "INVALID_STRUCT",
      data: { inputStruct: struct },
    });
  }

  if (isPrimitiveStruct(struct)) return struct;
  if (Array.isArray(struct)) return Object.freeze([...struct]) as T;
  if (typeof struct === "object") return struct;

  throw new StructError({
    message: "Invalid struct.",
    type: "INVALID_STRUCT",
    data: { inputStruct: struct },
  });
};

export const createCustomStruct = <T>(
  customStruct: Omit<CustomStruct<T>, "key">,
): CustomStruct<T> => {
  if (!("key" in customStruct)) return object.mergeInto({ key: customStructKey }, customStruct);
  throw new StructError({
    message: "The custom struct object must not provide its own key.",
    type: "INVALID_STRUCT",
    data: { inputStruct: customStruct },
  });
};

export const isCustomStruct = (value: unknown): value is CustomStruct<any> => {
  return typeof value === "object" && value !== null && (value as any)?.key === customStructKey;
};

export const isPrimitiveStruct = (value: unknown): value is PrimitiveType => {
  return typeof value === "string" && PRIMITIVE_TYPE_REGEX.test(value);
};

export const NULL_STRUCT = createStruct({});
