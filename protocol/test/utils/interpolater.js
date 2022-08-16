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
        if((array[maxIndex] == 0 || array[maxIndex] == undefined) && maxIndex != 0) break;
        maxIndex++;
    }
    maxIndex--;
    return maxIndex;
}

function findSortedIndex(array, value, max) {
    
    var low = 0;
    var high = max ? max : getMaxIndex(array);
    if(value == 0) return 0;
    while (low <= high) {
        var mid = math.floor(math.divide(math.add(low, high), 2));
        if( math.compare(math.bignumber(array[mid]), math.bignumber(value)) == -1) low = mid + 1;
        else high = mid - 1;
    }
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
    if(xArr.length != yArr.length) return;
    var maxpieces = 32;
    var length = xArr.length;
    if(length === 0) { return function(x) { return 0; }}
    if(length === 1) { return function(x) { return +yArr[0]; }}

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

    var dys = [], dxs = [], ms = [];
    for(let i = 0; i < (length-1); i++) {

        const deltax = math.subtract(math.bignumber(xs[i+1] || 0), math.bignumber(xs[i]));
        const deltay = math.subtract(math.bignumber(ys[i+1] || 0), math.bignumber(ys[i]));

        dxs.push(deltax);
        dys.push(deltay);
        ms.push(math.divide(deltay, deltax));
    }

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
    
    c1s.push(ms[ms.length - 1]);

    var c2s = [], c3s = [];
    for(let i = 0; i < (c1s.length - 1 ); i ++ ) {
        var invDx = math.divide(math.bignumber(1), dxs[i]);
        var common_ = math.chain(c1s[i]).add(c1s[i+1]).subtract(ms[i]).subtract(ms[i]).done();
        var c2sv = math.chain(ms[i]).subtract(c1s[i]).subtract(common_).multiply(invDx).done();
        c2s.push(c2sv);
        var c3sv = math.chain(common_).multiply(invDx).multiply(invDx).done();
        c3s.push(c3sv);
    }
    
    var ranges = new Array(maxpieces);
    var values = new Array(maxpieces*4);
    var bases = new Array(maxpieces*4);
    var signs = new Array(maxpieces*4);
    for(let i = 0; i < maxpieces; i++){
        if(i<length) {
            signs[i*4] = BitDescriptor.fromBool(math.sign(ys[i]) == (1||0));
            signs[i*4 + 1] = BitDescriptor.fromBool(math.sign(c1s[i]) == (1||0));

            var c = 25; //Note: arbitrary number: 10^25 is the starting base

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
        //pack 32 bases per baseInt
        baseInts.push(BigInt("0b" + baseArr.slice((i)*maxpieces*8, (i+1)*maxpieces*8).join('')).toString());
    }

    //pack all bools (up to 256) into a single int. in this case there are only 128 bools
    const boolInt = BigInt("0b" + boolString).toString();

    return {ranges: ranges, values: values, bases: bases, signs: signs, basesPacked: baseInts, signsPacked: boolInt}
}

function ppval(f, x, index, degree) {
    var _x = math.bignumber(x);

    //only do x - k if x is greater than or equal to k
    if(math.compare(_x, math.bignumber(f.ranges[index])) != -1) {
        _x = math.subtract(_x, math.bignumber(f.ranges[index]));
    }

    var y = math.bignumber(0);
    var degreeIndex = 0;

    while(degreeIndex <= degree) {
        var termMultiplier = math.bignumber(f.values[index*4 + degreeIndex])
        var termBase = math.pow(math.bignumber(10), math.bignumber(f.bases[index*4 + degreeIndex].value));

        var term = math.floor(math.chain(_x).pow(degreeIndex).multiply(termMultiplier).divide(termBase).done());

        if(f.signs[index*4 + degreeIndex].value == 1) y = math.add(y, term)
        else y = math.subtract(y, term)

        degreeIndex++;
    }

    return y;
}

function ppval_integrate(f, start, end, pieceIndex, degree) {
    
    var _x1 = math.bignumber(start);
    var _x2 = math.bignumber(end);

    if(math.compare(_x1, math.bignumber(f.ranges[pieceIndex])) != -1 && math.compare(_x2, math.bignumber(f.ranges[pieceIndex])) != -1) {
        _x1 = math.subtract(_x1, math.bignumber(f.ranges[pieceIndex]));
        _x2 = math.subtract(_x2, math.bignumber(f.ranges[pieceIndex]));
    }

    var sum = math.bignumber(0);
    var degreeIndex = 0;

    while(degreeIndex <= degree) {

        var termMultiplier = math.bignumber(f.values[pieceIndex*4 + degreeIndex]);
        var termBase = math.pow(math.bignumber(10), math.bignumber(f.bases[pieceIndex*4 + degreeIndex].value));

        var term = math.floor(
            math.chain(_x2)
            .pow(degreeIndex + 1)
            .multiply(termMultiplier)
            .divide(termBase)
            .divide(degreeIndex + 1)
            .multiply(f.signs[pieceIndex*4 + degreeIndex].value == 1 ? 1 : -1)
            .done());
        sum = math.add(sum, term);

        term = math.floor(
            math.chain(_x1)
            .pow(degreeIndex + 1)
            .multiply(termMultiplier)
            .divide(termBase)
            .divide(degreeIndex + 1)
            .multiply(f.signs[pieceIndex*4 + degreeIndex].value == 1 ? 1 : -1)
            .done());
        sum = math.subtract(sum, term);
        
        degreeIndex++;
    }
    
    return sum;
}

function ppval_listing(f, placeInLine) {
    var pieceIndex = findSortedIndex(f.ranges, placeInLine);
    var degree = getFunctionDegree(f, pieceIndex > 0 ? pieceIndex - 1 : 0);
    var y = ppval(f, placeInLine, pieceIndex > 0 ? pieceIndex - 1 : 0, degree);
    return math.format(math.floor(y), {notation:"fixed"});

}

function ppval_order(f, placeInLine, amount) {

    var beanAmount = math.bignumber(0);
    placeInLine = math.bignumber(placeInLine);
    var end = math.add(placeInLine, math.bignumber(amount));

    var pieceIndex = findSortedIndex(f.ranges, placeInLine);
    var i =  pieceIndex > 0 ? pieceIndex - 1 : 0;

    while(math.compare(end, placeInLine) == 1) {

        var degree = getFunctionDegree(f, i);

        if(i < getMaxIndex(f.ranges)-1 && math.compare(end, f.ranges[i+1]) == 1) {

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

// const set = {
//     xs: [0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15],
//     ys: [10, 10, 10, 10, 10, 10, 10.5, 15, 50, 60, 85]
// }

// let f = interpolate(set.xs, set.ys);

module.exports = {
    ppval_order,
    ppval_listing,
    findSortedIndex,
    ppval,
    ppval_integrate,
    interpolate,
    getFunctionDegree
}

