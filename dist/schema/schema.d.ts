import type { Compiled, CustomSchemaHandler, Schema } from "./types.ts";
export declare const SchemaType: {
    readonly Null: -1;
    readonly Simple: 0;
    readonly Object: 1;
    readonly Tuple: 2;
    readonly Array: 3;
    readonly Optional: 4;
    readonly Custom: 5;
};
export declare const optionalSchemaKey: unique symbol;
export declare const schema: {
    <T extends Schema>(value: T): T;
    compile: (value: Schema | Compiled["Schema"]) => Compiled["Schema"];
};
export declare const array: <T extends Schema>(value: T, count?: number) => T[];
export declare const optional: <T extends Schema>(value: T) => Readonly<{
    [optionalSchemaKey]: true;
    schema: T;
}>;
export declare const custom: <T>(handler: CustomSchemaHandler<T>) => CustomSchemaHandler<T>;
export declare const string: CustomSchemaHandler<string>;
export declare const isCustomSchema: (value: unknown) => value is CustomSchemaHandler<any>;
export type * from "./types.ts";
//# sourceMappingURL=schema.d.ts.map