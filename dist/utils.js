export const BASE_SIZE = {
    char: 8,
    u8: 8,
    u16: 16,
    u32: 32,
    u64: 64,
    i8: 8,
    i16: 16,
    i32: 32,
    i64: 64,
    f32: 32,
    f64: 64,
};
export const PRIMITIVE_TYPES_ARRAY = Object.freeze([
    "char",
    "u8",
    "u16",
    "u32",
    "i8",
    "i16",
    "i32",
    "u64",
    "i64",
    "f32",
    "f64",
]);
export const PRIMITIVE_TYPES = ((set) => {
    set.add = (value) => set;
    set.delete = (value) => false;
    set.clear = () => { };
    return Object.freeze(set);
})(new Set(PRIMITIVE_TYPES_ARRAY));
export const PRIMITIVE_TYPE_REGEX = Object.freeze(new RegExp(`^((?:${PRIMITIVE_TYPES_ARRAY.join("|")})+)(\\[([0-9])?\\])?$`, "i"));
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
// Math.log(256) -> 5.545177444479562
const getByteCount = (x) => +!(x % 256) + Math.ceil(Math.log(x) / 5.545177444479562);
export const encodeNumber = (value) => {
    const result = new Uint8Array(getByteCount(value));
    let offset = 0;
    do {
        result[offset++] = value & 0xff;
        value = Math.floor(value / 256);
    } while (value);
    return result;
};
export const decodeNumber = (value) => {
    let result = 0;
    for (let i = 0; i < value.length;)
        result += (value[i] ?? 0) * 256 ** i++;
    return result;
};
export const encodeString = (value) => textEncoder.encode(value);
export const decodeString = (x) => textDecoder.decode(new Uint8Array(x));
export const getStringCodePoints = (value, guardFn) => {
    const codepoints = [];
    if (guardFn) {
        for (let i = 0; i < value.length; i++)
            codepoints.push(guardFn(value.codePointAt(i) || 0));
    }
    else {
        for (let i = 0; i < value.length; i++)
            codepoints.push(value.codePointAt(i) || 0);
    }
    return codepoints;
};
export const destructureSimpleStruct = (struct) => {
    const match = struct.match(PRIMITIVE_TYPE_REGEX);
    if (!match)
        throw new Error("Invalid struct.");
    const [_input, base, array, arrayLength] = match;
    if (!PRIMITIVE_TYPES.has(base)) {
        throw new Error(`Unknown primitive type: ${base}`);
    }
    return {
        base: base,
        isArray: array != null,
        arrayLength: arrayLength == null ? -1 : +arrayLength,
    };
};
export const sortObjectKeys = (a, b) => {
    const _a = String(a);
    const _b = String(b);
    if (_a < _b)
        return -1;
    if (_a > _b)
        return 1;
    return 0;
};
export const sortObjectEntries = (entries) => {
    return entries.sort(([a], [b]) => sortObjectKeys(a, b));
};
//# sourceMappingURL=utils.js.map