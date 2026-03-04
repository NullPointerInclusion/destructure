import type { PrimitiveType } from "../schema/schema.ts";
import type { DestructuredSimpleSchema, GrowingBuffer } from "./types.ts";
export declare const PRIMITIVE_TYPES_ARRAY: ReadonlyArray<PrimitiveType>;
export declare const PRIMITIVE_TYPES: ReadonlySet<PrimitiveType>;
export declare const BITLENGTH_REGEX: RegExp;
export declare const PRIMITIVE_TYPE_REGEX: RegExp;
export declare const textEncoder: TextEncoder;
export declare const textDecoder: TextDecoder;
export declare const coder: {
    encodeNumber: (value: number) => Uint8Array<ArrayBuffer>;
    decodeNumber: (value: ArrayLike<number>) => number;
    encodeString: (value: string) => Uint8Array<ArrayBuffer>;
    decodeString: (x: ArrayLike<number>) => string;
};
export declare const getStringCodePoints: (value: string, guardFn?: ((cp: number) => number) | undefined) => number[];
export declare const destructureSimpleSchema: (schema: "char" | "char[]" | "f32" | "f32[]" | "f64" | "f64[]" | "i16" | "i16[]" | "i32" | "i32[]" | "i8" | "i8[]" | "u16" | "u16[]" | "u32" | "u32[]" | "u8" | "u8[]" | `char[${number}]` | `f32[${number}]` | `f64[${number}]` | `i16[${number}]` | `i32[${number}]` | `i8[${number}]` | `u16[${number}]` | `u32[${number}]` | `u8[${number}]`) => DestructuredSimpleSchema;
export declare const sortObjectKeys: (a: PropertyKey, b: PropertyKey) => number;
export declare const sortObjectEntries: <Key extends PropertyKey, Value>(entries: [Key, Value][]) => [Key, Value][];
export declare const createGrowingBuffer: (initialSize?: number, growth?: number) => GrowingBuffer;
export type * from "./types.ts";
//# sourceMappingURL=utils.d.ts.map