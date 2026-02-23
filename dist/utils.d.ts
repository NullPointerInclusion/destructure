import type { PrimitiveType } from "./struct.ts";
import type { DestructuredSimpleStruct } from "./types.ts";
export declare const BASE_SIZE: Record<PrimitiveType, number>;
export declare const PRIMITIVE_TYPES_ARRAY: ReadonlyArray<PrimitiveType>;
export declare const PRIMITIVE_TYPES: ReadonlySet<PrimitiveType>;
export declare const PRIMITIVE_TYPE_REGEX: Readonly<RegExp>;
export declare const encodeNumber: (value: number) => Uint8Array<ArrayBuffer>;
export declare const decodeNumber: (value: ArrayLike<number>) => number;
export declare const encodeString: (value: string) => Uint8Array<ArrayBuffer>;
export declare const decodeString: (x: ArrayLike<number>) => string;
export declare const getStringCodePoints: (value: string, guardFn?: ((cp: number) => number) | undefined) => number[];
export declare const destructureSimpleStruct: (struct: "char" | "char[]" | "f32" | "f32[]" | "f64" | "f64[]" | "i16" | "i16[]" | "i32" | "i32[]" | "i64" | "i64[]" | "i8" | "i8[]" | "u16" | "u16[]" | "u32" | "u32[]" | "u64" | "u64[]" | "u8" | "u8[]" | `char[${number}]` | `f32[${number}]` | `f64[${number}]` | `i16[${number}]` | `i32[${number}]` | `i64[${number}]` | `i8[${number}]` | `u16[${number}]` | `u32[${number}]` | `u64[${number}]` | `u8[${number}]`) => DestructuredSimpleStruct;
export declare const sortObjectKeys: (a: PropertyKey, b: PropertyKey) => number;
export declare const sortObjectEntries: <Key extends PropertyKey, Value>(entries: [Key, Value][]) => [Key, Value][];
export type { DestructuredSimpleStruct } from "./types.ts";
//# sourceMappingURL=utils.d.ts.map