import { clone, object } from "broadutils/data";
import { StructError } from "./error.ts";
import type {
  CustomStruct,
  ObjectStruct,
  PrimitiveType,
  SimpleStruct,
  SizeOfResult,
  Struct,
  TupleStruct,
} from "./types.ts";
import { BASE_SIZE, destructureSimpleStruct, PRIMITIVE_TYPE_REGEX } from "./utils.ts";

const customStructSet: WeakSet<CustomStruct> = new WeakSet();
const structSet: WeakSet<ObjectStruct | TupleStruct> = new WeakSet();

export type StructType = (typeof StructType)[keyof typeof StructType];
export const StructType = {
  Simple: 0,
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

  if (isSimpleStruct(struct)) return struct;
  if (isCustomStruct(struct)) return struct;
  if (typeof struct === "object") {
    if (structSet.has(struct)) return struct;

    const cloned = clone(struct);
    for (const { value } of object.walk(cloned, { leafPriority: true })) {
      typeof value === "object" && !structSet.has(value) && structSet.add(Object.freeze(value));
    }

    return cloned as T;
  }

  throw new StructError({
    message: "Invalid struct.",
    reason: "INVALID_STRUCT",
    data: { inputStruct: struct },
  });
};

export const createCustomStruct = <T>(
  customStruct: Omit<CustomStruct<T>, "key">,
): CustomStruct<T> => {
  if (typeof customStruct !== "object")
    throw new StructError({
      message: "The custom struct must be an object.",
      reason: "INVALID_STRUCT",
      data: { inputStruct: customStruct },
    });

  let errored = false;
  let erroredAt = "";

  for (const methodName of ["encode", "decode", "size"] as const) {
    if (errored) break;
    if (typeof customStruct[methodName] !== "function") {
      errored = true;
      erroredAt = methodName;
    }
  }

  if (errored)
    throw new StructError({
      message: `The custom struct must include a/an ${erroredAt} method.`,
      reason: "INVALID_STRUCT",
      data: { inputStruct: customStruct },
    });

  const clone = { ...customStruct };
  customStructSet.add(clone);
  return Object.freeze(clone);
};

export const getStructType = (struct: Struct): StructType => {
  if (isSimpleStruct(struct)) return StructType.Simple;
  if (isObjectStruct(struct)) return StructType.Object;
  if (isTupleStruct(struct)) return StructType.Tuple;
  if (isCustomStruct(struct)) return StructType.Custom;
  throw new StructError({ message: "Invalid struct.", reason: "INVALID_STRUCT", struct });
};

export const isCustomStruct = (value: unknown): value is CustomStruct => {
  return customStructSet.has(value as any);
};

export const isObjectStruct = (value: unknown): value is ObjectStruct => {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    structSet.has(value as ObjectStruct | TupleStruct)
  );
};

export const isSimpleStruct = (value: unknown): value is PrimitiveType => {
  return typeof value === "string" && PRIMITIVE_TYPE_REGEX.test(value);
};

export const isTupleStruct = (value: unknown): value is Struct[] => {
  return Array.isArray(value) && structSet.has(value as ObjectStruct | TupleStruct);
};

export const isStruct = (value: unknown): value is Struct => {
  return (
    isSimpleStruct(value) || isCustomStruct(value) || isObjectStruct(value) || isTupleStruct(value)
  );
};

const sizeof = (struct: Struct): SizeOfResult => {
  const result: SizeOfResult = { value: 0, isVariable: false };
  switch (getStructType(struct)) {
    case StructType.Simple: {
      const ds = destructureSimpleStruct(struct as SimpleStruct);
      const bSize = BASE_SIZE[ds.base] / 8;
      if (ds.isArray) {
        result.value = ds.arrayLength === -1 ? 4 : bSize * ds.arrayLength;
        result.isVariable = ds.arrayLength === -1;
      } else {
        result.value = bSize;
        result.isVariable = false;
      }

      break;
    }
    case StructType.Object: {
      for (const value of Object.values(struct)) {
        const size = sizeof(value);
        result.value += size.value;
        result.isVariable ||= size.isVariable;
      }
      break;
    }
    case StructType.Tuple: {
      for (const value of struct as TupleStruct) {
        const size = sizeof(value);
        result.value += size.value;
        result.isVariable ||= size.isVariable;
      }
      break;
    }
    case StructType.Custom: {
      const sizeResult = (struct as CustomStruct).size();
      result.value = sizeResult.value;
      result.isVariable = sizeResult.isVariable;
      break;
    }
  }

  return result;
};

export const NULL_STRUCT = createStruct({});

export type {
  CustomStruct,
  Data,
  ObjectStruct,
  PrimitiveType,
  SimpleStruct,
  Struct,
  StructDecodeResult,
  StructInfo,
  TupleStruct,
} from "./types.ts";
