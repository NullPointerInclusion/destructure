import type { Struct } from "./types.ts";
export type StructErrorType = "INVALID_STRUCT" | "RECURSIVE_STRUCT";
export type ErrorWithDataInit = {
    message: string;
    data?: unknown;
};
export type DestructureErrorInit = ErrorWithDataInit & {
    message: string;
    struct?: Struct;
};
export type StructErrorInit = DestructureErrorInit & {
    reason: StructErrorType;
};
export declare class ErrorWithData extends Error {
    readonly data: unknown;
    constructor(init: ErrorWithDataInit);
}
export declare class DestructureError extends ErrorWithData {
    readonly struct: Struct;
    constructor(init: DestructureErrorInit);
    setStruct(struct: Struct): this;
}
export declare class StructError extends DestructureError {
    readonly reason: StructErrorType;
    constructor(init: StructErrorInit);
}
export declare class EncodingError extends DestructureError {
}
export declare class DecodingError extends DestructureError {
}
export declare const encodingError: (message: string, data?: unknown) => EncodingError;
export declare const decodingError: (message: string, data?: unknown) => DecodingError;
//# sourceMappingURL=error.d.ts.map