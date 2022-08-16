const {create, all} = require("mathjs");
const {BitDescriptor, BitPacker} = require("./bitpacker.js");


const config = {
    matrix: 'Array',
    number: 'BigNumber',
    precision: 64,
    predictable: true,
}

const math = create(all, config);

function getMaxIndex(array) {
    var maxIndex = 0;
    while(maxIndex < 32) {
        // console.log("maxIndex: ", array[maxIndex]);
        if((array[maxIndex] == 0 || array[maxIndex] == undefined) && maxIndex != 0) break;
        maxIndex++;
    }
    maxIndex--;
    return maxIndex;
}

function findSortedIndex(array, value, max) {
    // var numArr = array.map(x => math.bignumber(x));
    // var val = math.bignumber(value);
    var low = 0;
    var high = max ? max : getMaxIndex(array);
    if(value == 0) return 0;
    while (low <= high) {
        var mid = math.floor(math.divide(math.add(low, high), 2));
        // console.log("high: ", high, "mid:", mid, "low: ", low, array[mid], "value: ", value, "array value: ", array[mid])
        if( math.compare(math.bignumber(array[mid]), math.bignumber(value)) == -1) low = mid + 1;
        else high = mid - 1;
    }
    // console.log("low: ", low);
    return low;
}

String.prototype.calculateShifts = function (c) {
    let val = +this;
    if(Math.abs(val) == 0) {
        return 0;
    }
    while(val > 1) {
        val /= 10;
        c--;
    }
    if(val <= 0.1 && val > 0) {
        while(val <= 0.1) {
            val *= 10;
            c++;
        }
    }
    return c;
}

Number.prototype.calculateShifts = function (counter) {
    let val = +this;
    if(Math.abs(val) == 0) {
        return 0;
    }
    while(val > 1) {
        val /= 10;
        counter--;
    }
    if(val <= 0.1 && val > 0) {
        while(val <= 0.1) {
            val *= 10;
            counter++;
        }
    }
    return counter;
}

Number.prototype.muld = function (_v, base) {
    const value = math.bignumber(this);
    const multiplier = math.bignumber(_v);
    const b = math.pow(math.bignumber(10), math.bignumber(base));
    return math.chain(value).multiply(multiplier).divide(b).done();
}

function interpolate(xArr, yArr) {
    //set and base cases
    // if(xArr.length != yArr.length) return;
    var maxpieces = 32;
    var length = xArr.length;
    // if(length === 0) { return function(x) { return 0; }}
    // if(length === 1) { return function(x) { return +yArr[0]; }}

    //not sorting the data arrays
    // var indexes = [];
    // for(let i = 0; i < length; i++) {
    //     indexes.push(i);
    // }
    // indexes.sort(function(a,b) {
    //     return xArr[a] < xArr[b] ? -1 : 1;
    // })

    var xs = [], ys = [];

    for(let i = 0; i < length; i++) {
        xs.push(+xArr[i]);
        ys.push(+yArr[i])
        // if(+xArr[indexes[i]] < +xArr[indexes[i-1]]) {
        //     xs.push(+xArr[indexes[i-1]] || 0);
        // } else {
        //     xs.push(+xArr[indexes[i]] || 0)
        // }

        // if(+yArr[indexes[i]] < +yArr[indexes[i-1]]) {
        //     ys.push(yArr[indexes[i-1]] || 0);
        // } else {
        //     ys.push(+yArr[indexes[i]] || 0);
        // }
    }
    // console.log(xs, ys, "length: ", length);
    var dys = [], dxs = [], ms = [];
    for(let i = 0; i < (length-1); i++) {

        const deltax = math.subtract(math.bignumber(xs[i+1] || 0), math.bignumber(xs[i]));
        const deltay = math.subtract(math.bignumber(ys[i+1] || 0), math.bignumber(ys[i]));

        dxs.push(deltax);
        dys.push(deltay);
        ms.push(math.divide(deltay, deltax));
        // console.log(deltax, deltay)
    }
    // console.log(dxs, dys, ms, "length: ", dxs.length)
    var c1s = [ms[0]];
    for(let i = 0; i < (length-1-1); i++) {
        if(ms[i] * ms[i+1] <= 0) {
            c1s.push(math.bignumber(0));
        } else {
            var common = math.add(dxs[i], dxs[i+1]);
            const val = math.divide(
                math.multiply(math.bignumber(3), common), 
                math.add(
                    math.divide(math.add(common, dxs[i+1]), ms[i]),
                    math.divide(math.add(common, dxs[i]), ms[i+1])
                ))
            c1s.push(val);
        }
    }
    //
    c1s.push(ms[ms.length - 1]);
    // console.log("c1s: ", c1s, c1s.length);

    var c2s = [], c3s = [];
    for(let i = 0; i < (c1s.length - 1 ); i ++ ) {
        var invDx = math.divide(math.bignumber(1), dxs[i]);
        var common_ = math.chain(c1s[i]).add(c1s[i+1]).subtract(ms[i]).subtract(ms[i]).done();
        var c2sv = math.chain(ms[i]).subtract(c1s[i]).subtract(common_).multiply(invDx).done();
        c2s.push(c2sv);
        var c3sv = math.chain(common_).multiply(invDx).multiply(invDx).done();
        c3s.push(c3sv);
    }
    // console.log("lens: ", xs.length, c1s.length, c2s.length,c3s.length);
    // console.log(c1s, c2s, c3s);
    var ranges = new Array(maxpieces);
    var values = new Array(maxpieces*4);
    var bases = new Array(maxpieces*4);
    var signs = new Array(maxpieces*4);
    for(let i = 0; i < maxpieces; i++){
        if(i<length) {
            signs[i*4] = BitDescriptor.fromBool(math.sign(ys[i]) == (1||0));
            signs[i*4 + 1] = BitDescriptor.fromBool(math.sign(c1s[i]) == (1||0));

            var c = 25; //Note: arbitrary number

            bases[i*4] = BitDescriptor.fromUint8(math.number(ys[i]).calculateShifts(c));
            bases[i*4 + 1] = BitDescriptor.fromUint8(math.number(c1s[i]).calculateShifts(c));
            
            var base1 = math.pow(math.bignumber(10), math.bignumber(math.number(ys[i]).calculateShifts(c)))
            var base2 = math.pow(math.bignumber(10), math.bignumber(math.number(c1s[i]).calculateShifts(c)))
            
            values[i*4] = math.format(math.floor(math.abs(math.multiply(ys[i], base1))), {notation: "fixed"});
            values[i*4 + 1] = math.format(math.floor(math.abs(math.multiply(c1s[i], base2))), {notation: "fixed"});
            
            ranges[i] = math.format(xs[i], {notation: "fixed"});

            if(i<(length - 1)) {
                signs[i*4 + 2] = BitDescriptor.fromBool(math.sign(c2s[i]) == 1);
                signs[i*4 + 3] = BitDescriptor.fromBool(math.sign(c3s[i]) == 1);

                bases[i*4 + 2] = BitDescriptor.fromUint8(math.number(c2s[i]).calculateShifts(c));
                bases[i*4 + 3] = BitDescriptor.fromUint8(math.number(c3s[i]).calculateShifts(c));

                var base3 = math.pow(math.bignumber(10), math.bignumber(math.number(c2s[i]).calculateShifts(c)))
                var base4 = math.pow(math.bignumber(10), math.bignumber(math.number(c3s[i]).calculateShifts(c)))
                values[i*4 + 2] = math.format(math.floor(math.abs(math.multiply(c2s[i], base3))), {notation: "fixed"});
                values[i*4 + 3] = math.format(math.floor(math.abs(math.multiply(c3s[i], base4))), {notation: "fixed"});
            } else {
                signs[i*4 + 2] = BitDescriptor.fromBool(false);
                signs[i*4 + 3] = BitDescriptor.fromBool(false);
                bases[i*4 + 2] = BitDescriptor.fromUint8(0);
                bases[i*4 + 3] = BitDescriptor.fromUint8(0);
                values[i*4 + 2] = '0';
                values[i*4 + 3] = '0';
            }
        } else {
            ranges[i] = '0';
            for(let j = 0; j < 4; j++){
                signs[i*4 + j] = BitDescriptor.fromBool(false);
                bases[i*4 + j] = BitDescriptor.fromUint8(0);
                values[i*4 + j] = '0';
            }
        }
    }

    const packedBools = BitPacker.pack(signs);
    const packedBases = BitPacker.pack(bases);

    const booliterator = BitPacker.createUnpackIterator(packedBools, pattern => {
        switch(pattern) {
            case '1': return '1';
            case '0': return '0';
            default: return null;
        }
    })
    const baseiterator = BitPacker.createUnpackIterator(packedBases, pattern => {
        switch(pattern) {
            case '1': return '1';
            case '0': return '0';
            default: return null;
        }
    })
    const boolString = [...booliterator].reverse().join('');
    const baseArr = [...baseiterator];
    var baseInts = [];
    for(let i = 0; i < 4; i++){
        baseInts.push(BigInt("0b" + baseArr.slice((i)*maxpieces*8, (i+1)*maxpieces*8).join('')).toString());
        // console.log("bigint at index ", i, " :", BigInt("0b" + baseArr.slice((i)*maxpieces*8, (i+1)*maxpieces*8).join('')).toString());
        // console.log(bases.slice((i)*maxpieces, (1+i)*maxpieces).map(x => x.value));
    }

    const boolInt = BigInt("0b" + boolString).toString();

    //32 bases packed into a single uint
    // console.log(ranges.length, ranges, values.length, values)
    return {ranges: ranges, values: values, bases: bases, signs: signs, basesPacked: baseInts, signsPacked: boolInt}
}

function ppval(f, x, index, degree) {
    var _x = math.bignumber(x);

    //only do x - k if x is greater than or equal to k
    // console.log(_x, f.ranges[index],math.compare(_x, math.bignumber(f.ranges[index])));
    if(math.compare(_x, math.bignumber(f.ranges[index])) != -1) {
        _x = math.subtract(_x, math.bignumber(f.ranges[index]));
    }

    var y = math.bignumber(0);
    var degIdx = 0;

    while(degIdx <= degree) {
        var v = math.bignumber(f.values[index*4 + degIdx])
        var b = math.pow(math.bignumber(10), math.bignumber(f.bases[index*4 + degIdx].value));

        // console.log("index: ", index, degIdx, f.bases[index*4 + degIdx].value, f.signs[index*4 + degIdx].value == 1);
        // console.log("x: ", _x, "v: ", v, "b: ", b);
        
        var term = math.floor(math.chain(_x).pow(degIdx).multiply(v).divide(b).done());
        // console.log("term: ", term);
        if(f.signs[index*4 + degIdx].value == 1) y = math.add(y, term)
        else y = math.subtract(y, term)
        // console.log("term res: ", y)
        degIdx++;
    }
    return y;
}

function ppval_integrate(f, x1, x2, index, degree) {
    
    var _x1 = math.bignumber(x1);
    var _x2 = math.bignumber(x2);

    if(math.compare(_x1, math.bignumber(f.ranges[index])) != -1 && math.compare(_x2, math.bignumber(f.ranges[index])) != -1) {
        _x1 = math.subtract(_x1, math.bignumber(f.ranges[index]));
        _x2 = math.subtract(_x2, math.bignumber(f.ranges[index]));
    }

    var y = math.bignumber(0);
    var degIdx = 0;

    while(degIdx <= degree) {
        var v = math.bignumber(f.values[index*4 + degIdx]);
        var b = math.pow(math.bignumber(10), math.bignumber(f.bases[index*4 + degIdx].value));
        var term = math.floor(math.chain(_x2).pow(degIdx + 1).multiply(v).divide(b).divide(degIdx + 1).multiply(f.signs[index*4 + degIdx].value == 1 ? 1 : -1).done());
        y = math.add(y, term);
        term = math.floor(math.chain(_x1).pow(degIdx + 1).multiply(v).divide(b).divide(degIdx + 1).multiply(f.signs[index*4 + degIdx].value == 1 ? 1 : -1).done());
        y = math.subtract(y, term);
        
        degIdx++;
    }
    
    return y;

}

function ppval_listing(f, placeInLine) {
    var ppIndex = findSortedIndex(f.ranges, placeInLine);
    var degree = getFunctionDegree(f, ppIndex > 0 ? ppIndex - 1 : 0);
    // console.log(ppIndex,degree);
    var y = ppval(f, placeInLine, ppIndex > 0 ? ppIndex - 1 : 0, degree);
    return math.format(math.floor(y), {notation:"fixed"});

}

function ppval_order(f, placeInLine, amount) {
    var beanAmount = math.bignumber(0);
    amount = math.bignumber(amount);
    placeInLine = math.bignumber(placeInLine);
    var end = math.add(placeInLine, amount);

    var ppIndex = findSortedIndex(f.ranges, placeInLine);
    var i =  ppIndex > 0 ? ppIndex - 1 : 0;

    while(math.compare(end, placeInLine) == 1) {

        var degree = getFunctionDegree(f, i);

        if(i < getMaxIndex(f.ranges)-1 && math.compare(end, f.ranges[i+1]) == 1) {
            // console.log(i);
            var nextIndexStart = math.bignumber(f.ranges[i+1]);
            var term = ppval_integrate(f, placeInLine, nextIndexStart, i, degree); 
            beanAmount = math.add(beanAmount, term);
            
            placeInLine = nextIndexStart; // set x to end of index to continue integrating from there
            
            if(i < getMaxIndex(f.ranges)-1) i++;
            
        } else {

            //integrate from x until end 
            var term = ppval_integrate(f, placeInLine, end, i, degree);

            beanAmount = math.add(beanAmount, term);
            placeInLine = end;
            // console.log(i, placeInLine, end, beanAmount);
        }
        
    }
    return math.format(math.floor(math.divide(beanAmount, 1000000)), {notation: "fixed"});

}

function getFunctionDegree(f, index) {
    var degree = 3;
    while(f.values[index*4 + degree] == 0){ 
        degree--;
    }
    return degree;
}

const set = {
    xs: [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15],
    ys: [10, 10, 10, 10, 10, 10, 10.5, 15, 50, 60, 85]
}

// const boolArrToNumber = (arr) => {
//     var bitArr = [];
//     arr.forEach((el) => bitArr.push(+el));
//     var result = bitArr.reduce((accumulator, value) => {
//         // console.log(accumulator, value);
//         return accumulator << 1 | value;
//     });
//     console.log(result);
//     return math.format(math.bignumber(result), {notation: "fixed"});
// }
// const boolArrToNumber = (arr) => {
//     var rarr = arr;
//     const field = new Field(256);
//     for(let i = 0; i < rarr.length; i++) {
//         field.set(i, rarr[i+1]);
//     }
//     // console.log(field.buffer.reverse())
//     //each number in js can only only 
//     return ethers.BigNumber.from(field.buffer);
// }

// const getBoolsFromNum = (packedBools, length) => {
//     // var packedBool = math.bignumber(packedBools);
//     console.log(packedBools);
//     var bools = [];
//     for(let i = 0; i < length; i++) {
//         // var flag = math.bitAnd(math.rightArithShift(packedBool, math.bignumber(i)), math.bignumber(1));
//         // var flag = math.mod(math.rightArithShift(packedBool, i), math.bignumber(2));
//         var flag = (packedBools >> (i)) & ethers.BigNumber.from(1);
//         // console.log(flag);
//         bools.push(flag!=0);
//         // console.log(i, flag === 1, f.signs.reverse()[i]);
//     }
//     return bools;
// }

let f = interpolate(set.xs, set.ys);
// var a = [false, false, false, false, true, false, true, false, false, true];

// var testnum = boolArrToNumber(f.signs.reverse());
// getBoolsFromNum(testnum, f.signs.length);

// const packBases = (bases) => {
//     //move all the bases into an arraybuffer
//     let buffer = new ArrayBuffer(bases.length);
//     let view = new Uint8ClampedArray(buffer);
//     for(let i = 0; i < bases.length; i++) {
//         view[i] = bases[i];
//     }
//     console.log(view)
//     //convert the array buffer to a hex string
//     //32 bytes max per hex string
//     var hexStrings = new Array(Math.ceil(bases.length / 32));

//     for(let i = 0; i < hexStrings.length; i++) {
//         hexStrings[i] = ethers.BigNumber.from(view.slice(i*32, (i+1)*32));
//         // console.log(view.buffer.slice(i*32, (i+1)*32))
//     }
//     return hexStrings;
// }

// console.log("real: ", JSON.stringify(f.signs), f.signs.length)
// console.log("packed: ", JSON.stringify(boolsfromnum), boolsfromnum.length);

module.exports = {
    ppval_order,
    ppval_listing,
    findSortedIndex,
    ppval,
    ppval_integrate,
    interpolate,
    getFunctionDegree
}

