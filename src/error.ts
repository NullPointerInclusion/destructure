import { NULL_STRUCT } from "./struct.ts";
import type { Struct } from "./types.ts";

export type StructErrorType = "INVALID_STRUCT" | "RECURSIVE_STRUCT";
export type ErrorWithDataInit = { message: string; data?: unknown };
export type DestructureErrorInit = ErrorWithDataInit & { message: string; struct?: Struct };
export type StructErrorInit = DestructureErrorInit & { reason: StructErrorType };

export class ErrorWithData extends Error {
  public readonly data: unknown;
  constructor(init: ErrorWithDataInit) {
    super(init.message);
    this.data = init.data;
  }
}

export class DestructureError extends ErrorWithData {
  public readonly struct: Struct;
  constructor(init: DestructureErrorInit) {
    super(init);
    this.struct = init.struct || NULL_STRUCT;
  }

  public setStruct(struct: Struct): this {
    return Object.assign(this, { struct });
  }
}

export class StructError extends DestructureError {
  public readonly reason: StructErrorType;
  constructor(init: StructErrorInit) {
    super(init);
    this.reason = init.reason;
  }
}

export class EncodingError extends DestructureError {}
export class DecodingError extends DestructureError {}

export const encodingError = (message: string, data?: unknown): EncodingError => {
  return new EncodingError({ message, data });
};

export const decodingError = (message: string, data?: unknown): DecodingError => {
  return new DecodingError({ message, data });
};
