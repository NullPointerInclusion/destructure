import { destructureSimpleSchema, PRIMITIVE_TYPES_ARRAY, sortObjectEntries, } from "../utils/utils.js";
export const SchemaType = {
    Null: -1,
    Simple: 0,
    Object: 1,
    Tuple: 2,
    Array: 3,
    Optional: 4,
    Custom: 5,
};
export const optionalSchemaKey = Symbol.for(crypto.randomUUID());
const schemaMap = new Map();
const schemaSet = new Set();
const customSchema = new Set();
export const schema = (value) => value;
schema.compile = (value) => {
    if (schemaMap.has(value))
        return schemaMap.get(value);
    if (schemaSet.has(value))
        return value;
    let compiled;
    if (value === null)
        compiled = { type: SchemaType.Null };
    else if (isCustomSchema(value))
        compiled = { type: SchemaType.Custom, handler: value };
    else if (typeof value === "string") {
        const ds = destructureSimpleSchema(value);
        compiled = ds.isArray
            ? {
                type: SchemaType.Array,
                schema: { type: SchemaType.Simple, base: ds.base, byteLength: ds.byteLength },
                count: ds.arrayLength,
            }
            : { type: SchemaType.Simple, base: ds.base, byteLength: ds.byteLength };
    }
    else if (typeof value === "object") {
        compiled = Array.isArray(value)
            ? { type: SchemaType.Tuple, entries: [] }
            : { type: SchemaType.Object, entries: [] };
        const stack = Array.isArray(value)
            ? value.map((s) => [compiled, null, s]).reverse()
            : sortObjectEntries(Object.entries(value))
                .map((s) => [compiled, s[0], s[1]])
                .reverse();
        while (stack.length) {
            const [parent, key, value] = stack.pop();
            let compiled;
            if (schemaMap.has(value))
                compiled = schemaMap.get(value);
            else if (typeof value === "string")
                compiled = schema.compile(value);
            else if (value === null)
                compiled = schema.compile(value);
            else if (isCustomSchema(value))
                compiled = schema.compile(value);
            else if (Array.isArray(value)) {
                compiled = { type: SchemaType.Tuple, entries: [] };
                stack.push(...value.map((s) => [compiled, null, s]).reverse());
            }
            else if (typeof value === "object") {
                compiled = { type: SchemaType.Object, entries: [] };
                stack.push(...sortObjectEntries(Object.entries(value))
                    .map((s) => [compiled, s[0], s[1]])
                    .reverse());
            }
            else
                throw new Error("Invalid schema.");
            if (parent.type === SchemaType.Object)
                key && parent.entries.push([key, compiled]);
            else if (parent.type === SchemaType.Tuple)
                parent.entries.push(compiled);
        }
    }
    else
        throw new Error("Invalid schema.");
    schemaMap.set(value, compiled);
    schemaSet.add(compiled);
    return compiled;
};
export const array = (value, count = -1) => {
    const compiled = { type: SchemaType.Array, schema: schema.compile(value), count };
    const placeholderSchema = [];
    schemaMap.set(placeholderSchema, compiled);
    schemaSet.add(compiled);
    return placeholderSchema;
};
export const optional = (value) => {
    const placeholderSchema = { [optionalSchemaKey]: true, schema: value };
    const compiled = { type: SchemaType.Optional, schema: schema.compile(value) };
    schemaMap.set(placeholderSchema, compiled);
    schemaSet.add(compiled);
    return placeholderSchema;
};
export const custom = (handler) => {
    if (!(handler.encode &&
        typeof handler.encode === "function" &&
        handler.decode &&
        typeof handler.decode === "function" &&
        handler.size &&
        typeof handler.size === "function"))
        throw new Error("Invalid custom schema handler.");
    const compiled = { type: SchemaType.Custom, handler };
    schemaMap.set(handler, compiled);
    customSchema.add(handler);
    return handler;
};
export const isCustomSchema = (value) => {
    return customSchema.has(value);
};
PRIMITIVE_TYPES_ARRAY.map(schema); // Precompile schemas
//# sourceMappingURL=schema.js.map