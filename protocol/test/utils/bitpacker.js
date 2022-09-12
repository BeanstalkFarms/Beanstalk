const binaryRegex = /^(0|1)+$/;

class BitDescriptor {
   
    constructor(value, bits) {
        if(!(value > -1 && Number.isInteger(value))) { 
            throw new Error("Value must be an integer > -1");
        }

        if(!(bits > 0 && Number.isInteger(bits))) { 
            throw new Error("Bits must be an integer > 0");
        }

        this.value = value;
        this.bits = bits;
    }

    static fromString(value) {
        if (!binaryRegex.test(value)) {
            throw new Error("Value must be a binary string");
        }
       
        return new BitDescriptor(parseInt(value, 2), value.length);
    }

    static fromBool(value) {
        return new BitDescriptor(value ? 1 : 0, 1);
    }

    static fromUint8(value) {
        if(!(value >= 0 && value <= 255)) {
            throw new Error("Value must be an unsigned 8-bit integer");
        }
        return new BitDescriptor(value, 8);
    }

    static fromUint256String(value) {
        if(!(value >= 0)) {
            throw new Error("Value must be an unsigned 256-bit integer");
        }
        return new BitDescriptor(BigInt(value), 256);
    }
}

// type UnpackFn<T> = (pattern: string) => T;

class BitPacker {
    
    static pack(bitDescriptors) {
        let size = 0;
        for (const bitDesc of bitDescriptors) {
            size += bitDesc.bits;
        }
        size = (size + 7) >>> 3; // Round up to nearest byte

        const buffer = new Uint8Array(size);
        BitPacker.packIntoBuffer(bitDescriptors, buffer);
        return buffer;
    }

    static packIntoBuffer(bitDescriptors, buffer) {
        let index = 0;
        let bitIndex = 7;

        for (const bitDesc of bitDescriptors) {
            let value = bitDesc.value;
            let vLen = bitDesc.bits;
            const bitsToPack = bitIndex + 1;

            while (vLen > 0) {
                if (index >= buffer.byteLength) return;

                if (vLen <= bitsToPack) {
                    const mask = ((1 << vLen) - 1);
                    buffer[index] |= (value & mask) << (bitsToPack - vLen);
                    bitIndex -= vLen;
    
                    if(bitIndex === -1) {
                        bitIndex = 7;
                        index++;
                    }
                    
                    vLen = 0;
                } else {
                    const mask = ((1 << bitsToPack) - 1) << (vLen - bitsToPack);
                    buffer[index] |= (value & mask) >>> (vLen - bitsToPack);

                    bitIndex = 7;
                    index++;
                    vLen -= bitsToPack;
                }
            }
            
        }
    }

    static createUnpackIterator = function* (buffer, unpackFn = (pattern) => {
        switch(pattern) {
            case '1': return 1;
            case '0': return 0;
            default: throw new Error("Invalid pattern");
        }
    }) {
        let index = 0;
        let bitIndex = 7;

        let pattern = '';

        while(index < buffer.byteLength) {
            pattern += (buffer[index] & (1 << bitIndex)) >>> bitIndex;
            bitIndex--;

            const transformedPatternValue = unpackFn(pattern);
            if(transformedPatternValue !== null) {
                yield transformedPatternValue;
                pattern = '';
            }

            if(bitIndex === -1) {
                index++;
                bitIndex = 7;
            }
        }
    }
}

// const packedBools = BitPacker.pack([
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(false),
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(false),
//     BitDescriptor.fromBool(true),
//     BitDescriptor.fromBool(false),
// ]);

// const packedUint8s = BitPacker.pack([
//     BitDescriptor.fromUint8(0),
//     BitDescriptor.fromUint8(56),
//     BitDescriptor.fromUint8(34),
//     BitDescriptor.fromUint8(23),
//     BitDescriptor.fromUint8(0),
//     BitDescriptor.fromUint8(77),
//     BitDescriptor.fromUint8(21),
//     BitDescriptor.fromUint8(0),
// ]);

// const booliterator = BitPacker.createUnpackIterator(packedBools, pattern => {
//     switch(pattern) {
//         case '1': return '1';
//         case '0': return '0';
//         default: return null;
//     }
// })

// const uint8iterator = BitPacker.createUnpackIterator(packedUint8s, pattern => {
//     switch(pattern) {
//         case '1': return '1';
//         case '0': return '0';
//         default: return null;
//     }
// })

// const binaryString = [...booliterator].reverse().join('');
// const uint8String = [...uint8iterator].join('');

// const uint8num = parseInt(uint8String, 2);
// const binaryNum = parseInt(binaryString, 2);

// 1010000100011111111110111XXXXXXX
// 10100001000111110001111100000010

// debugger;


module.exports = {
    BitDescriptor,
    BitPacker
}