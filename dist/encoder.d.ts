import type { Data, Struct } from "./struct.ts";
import type { PrimitiveEncoderMap } from "./types.ts";
export declare const encoder: PrimitiveEncoderMap & {
    tuple: (struct: Struct[], value: unknown[]) => Uint8Array<ArrayBuffer>;
};
export declare const encode: <T extends Struct>(struct: T, payload: Data<T>) => Uint8Array<ArrayBuffer>;
//# sourceMappingURL=encoder.d.ts.map