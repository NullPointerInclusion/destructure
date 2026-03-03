import type { GrowingBuffer } from "../utils/utils.ts";
import type { SchemaType as _SchemaTypeMap } from "./schema.ts";

export type PrimitiveType = "char" | `u${8 | 16 | 32}` | `i${8 | 16 | 32}` | `f${32 | 64}`;
export type PrimitiveTypeMap = {
  char: string;
  u8: number;
  u16: number;
  u32: number;
  i8: number;
  i16: number;
  i32: number;
  f32: number;
  f64: number;
};

export type SchemaTypeMap = typeof _SchemaTypeMap;
export type SchemaType = SchemaTypeMap[keyof SchemaTypeMap];

export interface Compiled {
  Null: Readonly<{ type: SchemaTypeMap["Null"] }>;
  Simple: Readonly<{ type: SchemaTypeMap["Simple"]; base: PrimitiveType; byteLength: number }>;
  Object: Readonly<{ type: SchemaTypeMap["Object"]; entries: [string, Compiled["Schema"]][] }>;
  Tuple: Readonly<{ type: SchemaTypeMap["Tuple"]; entries: Compiled["Schema"][] }>;
  Array: Readonly<{ type: SchemaTypeMap["Array"]; schema: Compiled["Schema"]; count: number }>;
  Custom: Readonly<{ type: SchemaTypeMap["Custom"]; handler: CustomSchemaHandler }>;
  Schema:
    | Compiled["Null"]
    | Compiled["Simple"]
    | Compiled["Object"]
    | Compiled["Tuple"]
    | Compiled["Array"]
    | Compiled["Custom"];
}

export type StructDecodeResult<T> = { value: T; nextOffset: number };
export type SizeOfResult = { value: number; isVariable: boolean };
export interface CustomSchemaHandler<T = any> {
  encode: (value: T) => Uint8Array<ArrayBuffer>;
  encodeInto?: (buffer: GrowingBuffer, value: T) => null;
  decode: (arr: Uint8Array<ArrayBuffer>, offset: number) => StructDecodeResult<T>;
  size: () => SizeOfResult;
}

export type SimpleSchema = `${PrimitiveType}${`[${number | ""}]` | ""}`;
export type ObjectSchema = Readonly<{ [x: string]: Schema }>;
export type TupleSchema = Schema[];
export type NullSchema = null;
export type Schema = NullSchema | SimpleSchema | ObjectSchema | TupleSchema | CustomSchemaHandler;

type DecodePrimitive<T extends SimpleSchema> = T extends PrimitiveType
  ? PrimitiveTypeMap[T]
  : T extends `${infer PT extends PrimitiveType}[${number | ""}]`
    ? PrimitiveTypeMap[PT][]
    : never;

type DecodeTuple<T extends Schema[], Collector extends unknown[] = []> = any[] extends T
  ? T extends (infer ST extends Schema)[]
    ? Data<ST>[]
    : never
  : T extends [infer Schm extends Schema, ...infer Rest extends Schema[]]
    ? DecodeTuple<Rest, [...Collector, Data<Schm>]>
    : Collector;

type DecodeObject<T extends ObjectSchema> = {
  [K in keyof T]: Data<T[K] extends Schema ? T[K] : never>;
};

export type Data<Schm extends Schema> = Schm extends NullSchema
  ? null
  : Schm extends SimpleSchema
    ? DecodePrimitive<Schm>
    : Schm extends TupleSchema
      ? DecodeTuple<Schm>
      : Schm extends ObjectSchema
        ? DecodeObject<Schm>
        : Schm extends CustomSchemaHandler<infer CS>
          ? CS
          : never;
