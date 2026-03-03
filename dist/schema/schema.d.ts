import type { Compiled, CustomSchemaHandler, Schema } from "./types.ts";
export declare const SchemaType: {
    readonly Null: -1;
    readonly Simple: 0;
    readonly Object: 1;
    readonly Tuple: 2;
    readonly Array: 3;
    readonly Custom: 4;
};
export declare const schema: {
    <T extends Schema>(value: T): T;
    compile: (value: Schema | Compiled["Schema"]) => Compiled["Schema"];
};
export declare const array: <T extends Schema>(value: T, count?: number) => T[];
export declare const custom: <T>(handler: CustomSchemaHandler<T>) => Readonly<{
    type: 4;
    handler: CustomSchemaHandler<any>;
}>;
export declare const isCustomSchema: (value: unknown) => value is CustomSchemaHandler<any>;
export type * from "./types.ts";
//# sourceMappingURL=schema.d.ts.map