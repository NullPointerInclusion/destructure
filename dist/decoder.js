import { decodingError } from "./error.js";
import { getStructType, StructType } from "./struct.js";
import { decodeNumber, decodeString, destructureSimpleStruct, sortObjectEntries } from "./utils.js";
const decodeNumberStruct = (bitLength, isFloat, isSigned, buffer, offset, isArray, arrayLength) => {
    let count = 1;
    let currentOffset = offset;
    if (isArray) {
        if (arrayLength === -1) {
            const lengthBytes = buffer.slice(currentOffset, (currentOffset += 4));
            count = decodeNumber(lengthBytes);
        }
        else {
            count = arrayLength;
        }
    }
    const elementSize = bitLength / 8;
    const totalBytes = count * elementSize;
    const data = buffer.slice(currentOffset, (currentOffset += totalBytes));
    let result;
    if (isFloat) {
        if (bitLength === 32 || bitLength === 64) {
            const typedArrayClass = globalThis[`Float${bitLength}Array`];
            result = Array.from(new typedArrayClass(data.buffer));
        }
        else {
            throw new Error("Invalid bit length for float value.");
        }
    }
    else {
        if (bitLength === 8 || bitLength === 16 || bitLength === 32 || bitLength === 64) {
            const typedArrayName = bitLength === 64
                ? `Big${isSigned ? "Int" : "Uint"}${bitLength}Array`
                : `${isSigned ? "Int" : "Uint"}${bitLength}Array`;
            const typedArrayClass = globalThis[typedArrayName];
            result = Array.from(new typedArrayClass(data.buffer));
        }
        else {
            throw new Error("Unexpected bit length.");
        }
    }
    if (!isArray)
        result = result[0];
    return { value: result, nextOffset: currentOffset + totalBytes };
};
const decodeNumberStruct2 = (bitLength, isFloat, isSigned, buffer, offset, isArray, arrayLength) => {
    let count = 1;
    let currentOffset = offset;
    if (isArray) {
        if (arrayLength === -1) {
            const lengthBytes = buffer.slice(currentOffset, (currentOffset += 4));
            count = decodeNumber(lengthBytes);
        }
        else {
            count = arrayLength;
        }
    }
    const elementSize = bitLength / 8;
    const totalBytes = count * elementSize;
    const dv = new DataView(buffer.buffer, currentOffset, totalBytes);
    let result = [];
    let methodName;
    {
        if (isFloat) {
            if (bitLength === 32)
                methodName = "getFloat32";
            else if (bitLength === 64)
                methodName = "getFloat64";
            else
                throw decodingError(`Unexpected bit length of ${bitLength} for floats.`);
        }
        else {
            if (bitLength === 8 || bitLength === 16 || bitLength === 32 || bitLength === 64) {
                methodName =
                    bitLength === 64
                        ? `getBig${isSigned ? "Int" : "Uint"}${bitLength}`
                        : `get${isSigned ? "Int" : "Uint"}${bitLength}`;
            }
            else
                throw decodingError(`Unexpected bit length of ${bitLength}.`);
        }
    }
    let viewOffset = 0;
    while (count--) {
        result.push(dv[methodName](viewOffset, true));
        viewOffset += elementSize;
    }
    return { value: isArray ? result : result[0], nextOffset: currentOffset + totalBytes };
};
export const decoder = {
    char: (arr, offset, isArray, arrayLength) => {
        let currentOffset = offset;
        let byteLength = 0;
        if (!isArray) {
            byteLength = 1;
            const val = arr[currentOffset];
            if (!val)
                throw new Error("Unexpected element value.");
            return { value: String.fromCodePoint(val), nextOffset: currentOffset + 1 };
        }
        if (arrayLength === -1) {
            const lengthBytes = arr.slice(currentOffset, currentOffset + 4);
            const len = decodeNumber(lengthBytes);
            currentOffset += 4;
            byteLength = len;
        }
        else {
            byteLength = arrayLength;
        }
        const bytes = arr.slice(currentOffset, (currentOffset += byteLength));
        const decodedString = decodeString(bytes);
        const result = decodedString.split("");
        return { value: result, nextOffset: currentOffset };
    },
    u8: (...args) => decodeNumberStruct2(8, false, false, ...args),
    u16: (...args) => decodeNumberStruct2(16, false, false, ...args),
    u32: (...args) => decodeNumberStruct2(32, false, false, ...args),
    u64: (...args) => decodeNumberStruct2(64, false, false, ...args),
    i8: (...args) => decodeNumberStruct2(8, false, true, ...args),
    i16: (...args) => decodeNumberStruct2(16, false, true, ...args),
    i32: (...args) => decodeNumberStruct2(32, false, true, ...args),
    i64: (...args) => decodeNumberStruct2(64, false, true, ...args),
    f32: (...args) => decodeNumberStruct2(32, true, false, ...args),
    f64: (...args) => decodeNumberStruct2(64, true, false, ...args),
};
export const decode = (struct, buffer, offset = 0) => {
    const state = {
        stack: [struct],
        stackData: new WeakMap(),
        processingQueue: [],
        offset: offset,
        result: null,
    };
    const handleQueue = (value) => {
        const processingQueue = state.processingQueue;
        if (!processingQueue.length)
            return value;
        const entry = processingQueue.shift();
        if (entry[0] === "object")
            entry[1][entry[2]] = value;
        else if (entry[0] === "tuple")
            entry[1].push(value);
        return value;
    };
    do {
        const current = state.stack.shift();
        if (!current)
            continue;
        let _value = null;
        switch (getStructType(current)) {
            case StructType.Simple: {
                const { base, isArray, arrayLength } = destructureSimpleStruct(current);
                const { value, nextOffset } = decoder[base](buffer, state.offset, isArray, arrayLength);
                state.offset = nextOffset;
                handleQueue((_value = value));
                break;
            }
            case StructType.Object: {
                const entries = sortObjectEntries(Object.entries(current));
                const value = {};
                handleQueue((_value = value));
                state.stack.unshift(...entries.map((entry) => entry[1]));
                state.processingQueue.unshift(...entries.map((entry) => ["object", value, entry[0]]));
                break;
            }
            case StructType.Tuple: {
                const struct = current;
                const value = [];
                const procEntry = ["tuple", handleQueue((_value = value))];
                state.stack.unshift(...current);
                state.processingQueue.unshift(...new Array(struct.length).fill(procEntry));
                break;
            }
            case StructType.Custom: {
                const { value, nextOffset } = current.decode(buffer, state.offset);
                state.offset = nextOffset;
                handleQueue((_value = value));
                break;
            }
        }
        state.result === null && (state.result = _value);
    } while (state.stack.length);
    return state.result;
};
//# sourceMappingURL=decoder.js.map