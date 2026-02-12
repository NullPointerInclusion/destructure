import type { OrArray } from 'broadutils/types';

type NumericBitLength = 8 | 16 | 32;
export type NumericType = `${'u' | 'i'}${NumericBitLength}`;

type BigIntBitLength = 64;
export type BigIntType = `${'u' | 'i'}${BigIntBitLength}`;

export type TextType = 'char';
export type FloatType = `f${32 | 64}`;
export type PrimitiveType = TextType | NumericType | BigIntType | FloatType;

export type SimpleStruct = `${PrimitiveType}${`[${number | ''}]` | ''}`;
export type ObjectStruct = { [x: string]: Struct };
export type Struct = CustomStruct<any> | SimpleStruct | ObjectStruct | Struct[];

export type PrimitiveTypeMap = { [K in TextType]: string } & {
  [K in NumericType | FloatType]: number;
} & {
  [K in BigIntType]: bigint;
};

type DecodePrimitive<T extends SimpleStruct> = T extends PrimitiveType
  ? PrimitiveTypeMap[T]
  : T extends `${infer PT extends PrimitiveType}[${number | ''}]`
    ? PrimitiveTypeMap[PT][]
    : never;
type DecodeTuple<T extends Struct[], Collector extends unknown[] = []> = T extends [
  infer Strct extends Struct,
  ...infer Rest extends Struct[],
]
  ? DecodeTuple<Rest, [...Collector, DecodedStruct<Strct>]>
  : Collector;
export type DecodedStruct<Strct extends Struct> = Strct extends SimpleStruct
  ? DecodePrimitive<Strct>
  : Strct extends CustomStruct<infer CS>
    ? CS
    : Strct extends Struct[]
      ? DecodeTuple<Strct>
      : Strct extends Struct
        ? {
            [K in keyof Strct]: DecodedStruct<Strct[K] extends Struct ? Strct[K] : never>;
          }
        : never;

export type StructDecodeResult<T> = { value: T; bytesConsumed: number };
export type SizeOfResult = { value: number; isVariable: boolean };

export interface DestructuredSimpleStruct {
  base: PrimitiveType;
  isArray: boolean;
  arrayLength: number;
}

export interface CustomStruct<T> {
  key: string;
  encode: (value: T) => number[];
  decode: (arr: number[], offset: number) => StructDecodeResult<T>;
  size: () => SizeOfResult;
}

export type PrimtiveEncoder<T> = (
  value: OrArray<T>,
  isArray: boolean,
  arrayLength: number,
) => number[];
export type PrimtiveDecoder<T> = (
  arr: number[],
  offset: number,
  isArray: boolean,
  arrayLength: number,
) => StructDecodeResult<OrArray<T>>;

export type PrimitiveEncoderMap = { [K in PrimitiveType]: PrimtiveEncoder<DecodePrimitive<K>> };
export type PrimitiveDecoderMap = { [K in PrimitiveType]: PrimtiveDecoder<DecodePrimitive<K>> };
