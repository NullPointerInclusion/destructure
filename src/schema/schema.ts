import {
  destructureSimpleSchema,
  getStringCodePoints,
  PRIMITIVE_TYPES_ARRAY,
  sortObjectEntries,
  textDecoder,
  textEncoder,
} from "../utils/utils.ts";
import type { Compiled, CustomSchemaHandler, OptionalSchema, Schema } from "./types.ts";

export const SchemaType = {
  Null: -1,
  Simple: 0,
  Object: 1,
  Tuple: 2,
  Array: 3,
  Optional: 4,
  Custom: 5,
} as const;

export const optionalSchemaKey = Symbol.for(crypto.randomUUID());

const schemaMap: Map<Schema, Compiled["Schema"]> = new Map();
const schemaSet: Set<Compiled["Schema"]> = new Set();
const customSchema: Set<CustomSchemaHandler> = new Set();

export const schema: {
  <T extends Schema>(value: T): T;
  compile: (value: Schema | Compiled["Schema"]) => Compiled["Schema"];
} = (value) => value;
schema.compile = (value: Schema | Compiled["Schema"]): Compiled["Schema"] => {
  if (schemaMap.has(value as Schema)) return schemaMap.get(value as Schema)!;
  if (schemaSet.has(value as Compiled["Schema"])) return value as Compiled["Schema"];
  let compiled: Compiled["Schema"];

  if (value === null) compiled = { type: SchemaType.Null };
  else if (isCustomSchema(value)) compiled = { type: SchemaType.Custom, handler: value };
  else if (typeof value === "string") {
    const ds = destructureSimpleSchema(value);
    compiled = ds.isArray
      ? {
          type: SchemaType.Array,
          schema: { type: SchemaType.Simple, base: ds.base, byteLength: ds.byteLength },
          count: ds.arrayLength,
        }
      : { type: SchemaType.Simple, base: ds.base, byteLength: ds.byteLength };
  } else if (typeof value === "object") {
    type StackEntry = [Compiled["Schema"], string | null, Schema];

    compiled = Array.isArray(value)
      ? { type: SchemaType.Tuple, entries: [] }
      : { type: SchemaType.Object, entries: [] };
    const stack: StackEntry[] = Array.isArray(value)
      ? value.map<StackEntry>((s) => [compiled, null, s]).reverse()
      : sortObjectEntries(Object.entries(value))
          .map<StackEntry>((s) => [compiled, s[0], s[1]])
          .reverse();

    while (stack.length) {
      const [parent, key, value] = stack.pop()!;
      let compiled: Compiled["Schema"];

      if (schemaMap.has(value)) compiled = schemaMap.get(value)!;
      else if (typeof value === "string") compiled = schema.compile(value);
      else if (value === null) compiled = schema.compile(value);
      else if (isCustomSchema(value)) compiled = schema.compile(value);
      else if (Array.isArray(value)) {
        compiled = { type: SchemaType.Tuple, entries: [] };
        stack.push(...value.map<StackEntry>((s) => [compiled, null, s]).reverse());
      } else if (typeof value === "object") {
        compiled = { type: SchemaType.Object, entries: [] };
        stack.push(
          ...sortObjectEntries(Object.entries(value))
            .map<StackEntry>((s) => [compiled, s[0], s[1]])
            .reverse(),
        );
      } else throw new Error("Invalid schema.");

      if (parent.type === SchemaType.Object) key && parent.entries.push([key, compiled]);
      else if (parent.type === SchemaType.Tuple) parent.entries.push(compiled);
    }
  } else throw new Error("Invalid schema.");

  schemaMap.set(value as Schema, compiled);
  schemaSet.add(compiled);
  return compiled;
};

export const array = <T extends Schema>(value: T, count: number = -1): T[] => {
  const compiled = { type: SchemaType.Array, schema: schema.compile(value), count };
  const placeholderSchema: T[] = [];

  schemaMap.set(placeholderSchema, compiled);
  schemaSet.add(compiled);
  return placeholderSchema;
};

export const optional = <T extends Schema>(value: T): OptionalSchema<T> => {
  const placeholderSchema: OptionalSchema<T> = { [optionalSchemaKey]: true, schema: value };
  const compiled = { type: SchemaType.Optional, schema: schema.compile(value) };

  schemaMap.set(placeholderSchema, compiled);
  schemaSet.add(compiled);
  return placeholderSchema;
};

export const custom = <T>(handler: CustomSchemaHandler<T>): CustomSchemaHandler<T> => {
  if (
    !(
      handler.encode &&
      typeof handler.encode === "function" &&
      handler.decode &&
      typeof handler.decode === "function" &&
      handler.size &&
      typeof handler.size === "function"
    )
  )
    throw new Error("Invalid custom schema handler.");

  const compiled: Compiled["Custom"] = { type: SchemaType.Custom, handler };
  schemaMap.set(handler, compiled);
  customSchema.add(handler);
  return handler;
};

export const string = custom<string>({
  encode: (value) => {
    const encoded = textEncoder.encode(value);
    if (encoded.length > 2 ** 32 - 1) throw new RangeError("Input length exceeds limit.");

    const result = new Uint8Array(encoded.length + 4);
    const view = new DataView(result.buffer);

    result.set(encoded, 4);
    view.setUint32(0, encoded.length, true);

    return result;
  },
  decode: (bytes, offset) => {
    const dataLength = bytes.view.getUint32(offset, true);
    const dataOffset = offset + 4;
    return {
      value: textDecoder.decode(bytes.array.subarray(dataOffset, dataOffset + dataLength)),
      nextOffset: offset + 4 + dataLength,
    };
  },
  encodeInto: (buffer, value) => {
    const encoded = textEncoder.encode(value);
    if (encoded.length > 2 ** 32 - 1) throw new RangeError("Input length exceeds limit.");

    buffer.ensureCapacity(encoded.length + 4);
    buffer.view.setUint32(buffer.offset, encoded.length, true);
    buffer.buffer.set(encoded, (buffer.offset += 4));
    buffer.offset += encoded.length;

    return null;
  },
  size: () => ({ value: 4, isVariable: true }),
});

export const isCustomSchema = (value: unknown): value is CustomSchemaHandler => {
  return customSchema.has(value as CustomSchemaHandler);
};

PRIMITIVE_TYPES_ARRAY.map(schema); // Precompile schemas

export type * from "./types.ts";
