import type { Data, Struct } from "./struct.ts";
import type { PrimitiveDecoderMap } from "./types.ts";
export declare const decoder: PrimitiveDecoderMap;
export declare const decode: <T extends Struct>(struct: T, buffer: Uint8Array<ArrayBuffer>, offset?: number) => Data<T>;
//# sourceMappingURL=decoder.d.ts.map