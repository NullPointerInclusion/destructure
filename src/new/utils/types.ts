import type { PrimitiveType } from "../schema/schema.ts";

export interface DestructuredSimpleSchema {
  base: PrimitiveType;
  isArray: boolean;
  byteLength: number;
  arrayLength: number;
}

export interface GrowingBuffer {
  buffer: Uint8Array<ArrayBuffer>;
  view: DataView<ArrayBuffer>;
  growthFactor: number;
  offset: number;

  updateGrowthFactor(value: number): null;
  ensureCapacity(byteLength: number): null;
  writeOne(value: number): null;
  write(values: ArrayLike<number>): null;
  finalise(): Uint8Array<ArrayBuffer>;
}
