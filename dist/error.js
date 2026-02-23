import { NULL_STRUCT } from "./struct.js";
export class ErrorWithData extends Error {
    data;
    constructor(init) {
        super(init.message);
        this.data = init.data;
    }
}
export class DestructureError extends ErrorWithData {
    struct;
    constructor(init) {
        super(init);
        this.struct = init.struct || NULL_STRUCT;
    }
    setStruct(struct) {
        return Object.assign(this, { struct });
    }
}
export class StructError extends DestructureError {
    reason;
    constructor(init) {
        super(init);
        this.reason = init.reason;
    }
}
export class EncodingError extends DestructureError {
}
export class DecodingError extends DestructureError {
}
export const encodingError = (message, data) => {
    return new EncodingError({ message, data });
};
export const decodingError = (message, data) => {
    return new DecodingError({ message, data });
};
//# sourceMappingURL=error.js.map