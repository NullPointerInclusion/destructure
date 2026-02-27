import {
  type Compiled,
  type Data,
  type Schema,
  SchemaType,
  schema as _schema,
} from "../schema/schema.ts";
import { createGrowingBuffer, coder, getStringCodePoints } from "../utils/utils.ts";

const dvMethodMap = {
  u8: DataView.prototype.setUint8,
  u16: DataView.prototype.setUint16,
  u32: DataView.prototype.setUint32,
  i8: DataView.prototype.setInt8,
  i16: DataView.prototype.setInt16,
  i32: DataView.prototype.setInt32,
  f32: DataView.prototype.setFloat32,
  f64: DataView.prototype.setFloat64,
};

export const encode = <T extends Schema>(schema: T, data: Data<T>): Uint8Array<ArrayBuffer> => {
  type StackEntry = [schema: Compiled["Schema"], payload: any, data: Record<string, any>];

  const buffer = createGrowingBuffer();
  const stack: StackEntry[] = [[_schema.compile(schema), data, {}]];

  while (stack.length) {
    const [schema, payload, data] = stack.pop()!;
    switch (schema.type) {
      case SchemaType.Null: {
        break;
      }
      case SchemaType.Simple: {
        if (schema.base === "char") {
          const codepoints = getStringCodePoints(payload);
          if (codepoints.length === 1) buffer.writeOne(codepoints[0]!);
          else throw new Error("char data must be a string with one codepoint.");
          break;
        }

        const method = dvMethodMap[schema.base];
        buffer.ensureCapacity(schema.byteLength);
        method.call(buffer.view, buffer.offset, payload, true);
        buffer.offset += schema.byteLength;
        break;
      }
      case SchemaType.Object: {
        if (typeof payload !== "object") throw new TypeError("data must be an object.");
        stack.push(
          ...schema.entries
            .map<StackEntry>(([key, schema]) => [schema, payload[key], {}])
            .reverse(),
        );
        break;
      }
      case SchemaType.Tuple: {
        if (!Array.isArray(payload)) throw new TypeError("data must be an array.");
        stack.push(
          ...schema.entries.map<StackEntry>((schema, i) => [schema, payload[i], {}]).reverse(),
        );
        break;
      }
      case SchemaType.Array: {
        if (!Array.isArray(payload)) throw new TypeError("data must be an array.");
        if (schema.count === -1) {
          const encodedLength = coder.encodeNumber(payload.length);
          if (encodedLength.length > 4) throw new RangeError("Too many elements in input.");
          buffer.write(encodedLength);
          buffer.offset += 4 - encodedLength.length;
        }
        stack.push(...payload.map<StackEntry>((payload) => [schema.schema, payload, {}]).reverse());
        break;
      }
      case SchemaType.Custom: {
        if ("encodeInto" in schema.handler) schema.handler.encodeInto(buffer, payload);
        else {
          const data = schema.handler.encode(payload);
          buffer.write(data);
        }
        break;
      }
    }
  }

  return buffer.finalise();
};
