import { object } from "broadutils/data";
import { StructError } from "./error.ts";
import type { CustomStruct, ObjectStruct, PrimitiveType, Struct, StructInfo } from "./types.ts";
import { destructureSimpleStruct, PRIMITIVE_TYPE_REGEX } from "./utils.ts";

const customStructKey = crypto.randomUUID();

export type StructType = (typeof StructType)[keyof typeof StructType];
export const StructType = {
  Primitive: 0,
  Object: 1,
  Tuple: 2,
  Custom: 3,
} as const;

export const createStruct = <T extends Struct>(struct: T): T => {
  if (!struct) {
    throw new StructError({
      message: "Invalid struct.",
      reason: "INVALID_STRUCT",
      data: { inputStruct: struct },
    });
  }

  if (isPrimitiveStruct(struct)) return struct;
  if (isCustomStruct(struct)) return struct;
  if (Array.isArray(struct)) return Object.freeze([...struct]) as T;
  if (typeof struct === "object") return Object.freeze({ ...struct }) as T;

  throw new StructError({
    message: "Invalid struct.",
    reason: "INVALID_STRUCT",
    data: { inputStruct: struct },
  });
};

export const createCustomStruct = <T>(
  customStruct: Omit<CustomStruct<T>, "key">,
): CustomStruct<T> => {
  if (!("key" in customStruct)) return object.mergeInto({ key: customStructKey }, customStruct);
  throw new StructError({
    message: "The custom struct object must not provide its own key.",
    reason: "INVALID_STRUCT",
    data: { inputStruct: customStruct },
  });
};

export const getStructType = (struct: Struct): StructType => {
  if (isPrimitiveStruct(struct)) return StructType.Primitive;
  if (isObjectStruct(struct)) return StructType.Object;
  if (isTupleStruct(struct)) return StructType.Tuple;
  if (isCustomStruct(struct)) return StructType.Custom;
  throw new StructError({ message: "Invalid struct.", reason: "INVALID_STRUCT", struct });
};

export const isCustomStruct = (value: unknown): value is CustomStruct<any> => {
  return typeof value === "object" && value !== null && (value as any)?.key === customStructKey;
};

export const isObjectStruct = (value: unknown): value is ObjectStruct => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([k, v]) => typeof k === "string" && isValidStruct(v))
  );
};

export const isPrimitiveStruct = (value: unknown): value is PrimitiveType => {
  return typeof value === "string" && PRIMITIVE_TYPE_REGEX.test(value);
};

export const isTupleStruct = (value: unknown): value is Struct[] => {
  return Array.isArray(value) && value.every((v) => isValidStruct(v));
};

export const isValidStruct = (value: unknown): value is Struct => {
  return (
    isPrimitiveStruct(value) ||
    isCustomStruct(value) ||
    isObjectStruct(value) ||
    isTupleStruct(value)
  );
};
export const NULL_STRUCT = createStruct({});
