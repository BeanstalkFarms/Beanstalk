function getByteSize(num) {
    var out = num >> 3;
    if(num % 8 !== 0) 
        out++;
    return out;
}

class Field {
    
    constructor(data) {
        this.buffer = new Uint8Array(getByteSize(data));
    }

    /**
     * 
     * @param {i} Bit index to get 
     */
    get(i) {
        const j = i >> 3;
        return j < this.buffer.length && !!(this.buffer[j] & (128 >> (i % 8)));
    }

    set(i, value) {
        const j = i >> 3;
        if(value) {
            // assuming this.buffer.length < j + 1
            this.buffer[j] |= 128 >> i % 8;
        } else {
            this.buffer[j] &= ~(128 >> i % 8);
        }
    }
}

module.exports = {
    Field
};