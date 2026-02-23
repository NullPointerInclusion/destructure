import type { CustomStruct, PrimitiveType, Struct } from "./types.ts";
export type StructType = (typeof StructType)[keyof typeof StructType];
export declare const StructType: {
    readonly Simple: 0;
    readonly Object: 1;
    readonly Tuple: 2;
    readonly Custom: 3;
};
export declare const createStruct: <T extends Struct>(struct: T) => T;
export declare const createCustomStruct: <T>(customStruct: Omit<CustomStruct<T>, "key">) => CustomStruct<T>;
export declare const getStructType: (struct: Struct) => StructType;
export declare const isCustomStruct: (value: unknown) => value is CustomStruct<any>;
export declare const isObjectStruct: (value: unknown) => value is Readonly<{
    [x: string]: Struct;
}>;
export declare const isSimpleStruct: (value: unknown) => value is PrimitiveType;
export declare const isTupleStruct: (value: unknown) => value is Struct[];
export declare const isStruct: (value: unknown) => value is Struct;
export declare const NULL_STRUCT: {};
export type { CustomStruct, Data, ObjectStruct, PrimitiveType, SimpleStruct, Struct, StructDecodeResult, StructInfo, TupleStruct, } from "./types.ts";
//# sourceMappingURL=struct.d.ts.map