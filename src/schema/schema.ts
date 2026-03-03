import {
  destructureSimpleSchema,
  PRIMITIVE_TYPES_ARRAY,
  sortObjectEntries,
} from "../utils/utils.ts";
import type { Compiled, CustomSchemaHandler, Schema } from "./types.ts";

export const SchemaType = {
  Null: -1,
  Simple: 0,
  Object: 1,
  Tuple: 2,
  Array: 3,
  Custom: 4,
} as const;

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
  return placeholderSchema;
};

export const custom = <T>(handler: CustomSchemaHandler<T>): Compiled["Custom"] => {
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
  return compiled;
};

export const isCustomSchema = (value: unknown): value is CustomSchemaHandler => {
  return customSchema.has(value as CustomSchemaHandler);
};

PRIMITIVE_TYPES_ARRAY.map(schema); // Precompile schemas

export type * from "./types.ts";
