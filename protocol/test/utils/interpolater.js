/* global BigInt */

const {create, all} = require("mathjs");
const {BitDescriptor, BitPacker} = require("./bitpacker.js");


const config = {
    matrix: 'Array',
    number: 'BigNumber',
    precision: 128,
    predictable: true,
    epsilon: 1e-24
}

const math = create(all, config);

const maxpieces = 16;

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

function getNumIntervals(array) {
    var numIntervals = 0;
    while(numIntervals < maxpieces) {
        if(array[numIntervals] == 0 && numIntervals != 0) break;
        else if(array[numIntervals] == undefined) break;
        numIntervals++;
    }

    return numIntervals;
}

function findSortedIndex(array, value, high) {
    if(math.compare(math.bignumber(value), math.bignumber(array[0])) == -1) return 0;
    var low = 0;
    while(low < high) {
        if(math.compare(math.bignumber(array[low]), math.bignumber(value)) == 0) return low;
        else if(math.compare(math.bignumber(array[low]), math.bignumber(value)) == 1) break;
        else low++;
    }
    return low>0?low-1:0;
}



//javascript implementation from https://www.wikiwand.com/en/Monotone_cubic_interpolation
function interpolate(xArr, yArr) {
    //set and base cases

    // if(xArr.length != yArr.length) return;
    var length = xArr.length;
    // if(length > maxpieces || length < 2) return;

    
    var indexes = [];
    for(let i = 0; i < length; i++) {
        indexes.push(i);
    }
    indexes.sort(function(a,b) {
        return xArr[a] < xArr[b] ? -1 : 1;
    })

    var xs = [], ys = [];

    for(let i = 0; i < length; i++) {
        
        if(+xArr[indexes[i]] < +xArr[indexes[i-1]]) {
            xs.push(+xArr[indexes[i-1]]);
        } else {
            xs.push(+xArr[indexes[i]])
        }

        if(+yArr[indexes[i]] < +yArr[indexes[i-1]]) {
            ys.push(yArr[indexes[i-1]]);
        } else {
            ys.push(+yArr[indexes[i]]);
        }
    }

    var dys = [], dxs = [], ms = [];
    for(let i = 0; i < (length-1); i++) {

        const deltax = math.subtract(math.bignumber(xs[i+1]), math.bignumber(xs[i]));
        const deltay = math.subtract(math.bignumber(ys[i+1]), math.bignumber(ys[i]));

        dxs.push(deltax);
        dys.push(deltay);
        ms.push(math.divide(deltay, deltax));
    }

    var c1s = [ms[0]];
    for(let i = 0; i < (dxs.length-1); i++) {
        if(ms[i] * ms[i+1] <= 0) {
            c1s.push(math.bignumber(0));
        } else {
            // var common = math.add(dxs[i], dxs[i+1]);
            c1s.push(math.divide(
                math.multiply(math.bignumber(3), math.add(dxs[i], dxs[i+1])), 
                math.add(
                    math.divide(math.add(math.add(dxs[i], dxs[i+1]), dxs[i+1]), ms[i]),
                    math.divide(math.add(math.add(dxs[i], dxs[i+1]), dxs[i]), ms[i+1])
                )
            ));
        }
    }
    
    c1s.push(ms[ms.length - 1]);

    var c2s = [], c3s = [];

    for(let i = 0; i < c1s.length - 1; i++) {
        var invDx = math.divide(math.bignumber(1), dxs[i]);
        var common_ = math.chain(c1s[i]).add(c1s[i+1]).subtract(ms[i]).subtract(ms[i]).done();
        c2s.push(math.multiply(math.chain(ms[i]).subtract(c1s[i]).subtract(common_).done(), invDx));
        c3s.push(math.chain(common_).multiply(invDx).multiply(invDx).done());
    }
    
    var ranges = new Array(maxpieces);
    var values = new Array(maxpieces*4);
    var bases = new Array(maxpieces*4);
    var signs = new Array(maxpieces*4);
    for(let i = 0; i < maxpieces; i++){
        if(i<length) {
            signs[i*4] = BitDescriptor.fromBool(math.sign(ys[i]) == 1 || math.sign(ys[i]) == 0);
            signs[i*4 + 1] = BitDescriptor.fromBool(math.sign(c1s[i]) == 1 || math.sign(c1s[i]) == 0);

            var c = 25; //Note: arbitrary number: 10^25 is the starting base

            bases[i*4] = BitDescriptor.fromUint8(math.number(ys[i]).calculateShifts(c));
            bases[i*4 + 1] = BitDescriptor.fromUint8(math.number(c1s[i]).calculateShifts(c));
            
            var base1 = math.pow(math.bignumber(10), math.bignumber(math.number(ys[i]).calculateShifts(c)))
            var base2 = math.pow(math.bignumber(10), math.bignumber(math.number(c1s[i]).calculateShifts(c)))
            
            values[i*4] = math.format(math.floor(math.abs(math.multiply(ys[i], base1))), {notation: "fixed"});
            values[i*4 + 1] = math.format(math.floor(math.abs(math.multiply(c1s[i], base2))), {notation: "fixed"});
            
            ranges[i] = math.format(xs[i], {notation: "fixed"});

            if(i<(dxs.length)) {
                signs[i*4 + 2] = BitDescriptor.fromBool(math.sign(c2s[i]) == 1 || math.sign(c2s[i]) == 0);
                signs[i*4 + 3] = BitDescriptor.fromBool(math.sign(c3s[i]) == 1 || math.sign(c3s[i]) == 0);

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
    // console.log(baseArr.length, baseArr);
    var baseInts = [];
    for(let i = 0; i < (Math.floor(maxpieces / 8)); i++){
        //pack 32 bases per baseInt
        // console.log(baseArr.slice(i*256, (i+1)*256 - 1));
        baseInts.push(BigInt("0b" + baseArr.slice(i*256, (i+1)*256).join('')).toString());
    }

    //pack all bools (up to 256) into a single int. in this case there are only 128 bools
    const boolInt = BigInt("0b" + boolString).toString();

    return {ranges: ranges, values: values, bases: bases, signs: signs, basesPacked: baseInts, signsPacked: boolInt}
}

function ppval(f, x, index) {
    var _x = math.bignumber(x);
    var degreeIndex = math.bignumber(0);
    //only do x - k if x is greater than or equal to k
    if(math.compare(_x, math.bignumber(f.ranges[index])) != -1) {
        _x = math.subtract(_x, math.bignumber(f.ranges[index]));
    }

    var y = math.bignumber(0);
    
    while(degreeIndex < 4) {
        var termMultiplier = math.bignumber(f.values[math.add(index*4, degreeIndex)])
        var termBase = math.pow(math.bignumber(10), math.bignumber(f.bases[math.add(index*4, degreeIndex)].value));

        var term = math.floor(math.chain(_x).pow(degreeIndex).multiply(termMultiplier).divide(termBase).done());

        if(f.signs[math.add(index*4, degreeIndex)].value == 1) y = math.add(y, term)
        else y = math.subtract(y, term)

        degreeIndex = math.add(degreeIndex, 1);
    }

    return y;
}

function ppval_integrate(f, start, end, pieceIndex) {

    var _x1 = math.bignumber(start);
    var _x2 = math.bignumber(end);

    if(math.compare(_x1, math.bignumber(f.ranges[pieceIndex])) != -1 && math.compare(_x2, math.bignumber(f.ranges[pieceIndex])) != -1) {
        _x1 = math.subtract(_x1, math.bignumber(f.ranges[pieceIndex]));
        _x2 = math.subtract(_x2, math.bignumber(f.ranges[pieceIndex]));
    }

    var sum = math.bignumber(0);
    var degreeIndex = math.bignumber(0);

    while(degreeIndex < 4) {

        var termMultiplier = math.bignumber(f.values[math.add(pieceIndex*4, degreeIndex)]);
        var termBase = math.pow(math.bignumber(10), math.bignumber(f.bases[math.add(pieceIndex*4, degreeIndex)].value));

        var term = math.chain(_x2)
            .pow(math.add(degreeIndex,1))
            .multiply(termMultiplier)
            .divide(termBase)
            .divide(math.add(degreeIndex,1))
            .multiply(math.bignumber(f.signs[math.add(pieceIndex*4, degreeIndex)].value == 1 ? 1 : -1))
            .done();

        sum = math.add(sum, term);

        term = math.chain(_x1)
            .pow(math.add(degreeIndex,1))
            .multiply(termMultiplier)
            .divide(termBase)
            .divide(math.add(degreeIndex,1))
            .multiply(math.bignumber(f.signs[math.add(pieceIndex*4, degreeIndex)].value == 1 ? 1 : -1))
            .done();
        sum = math.subtract(sum, term);
        
        degreeIndex++;
    }
    
    return math.floor(sum);
}

function ppval_listing(f, placeInLine) {
    var pieceIndex = findSortedIndex(f.ranges, placeInLine, getNumIntervals(f.ranges) - 1);
    var y = ppval(f, placeInLine, pieceIndex);
    return math.format(math.floor(y), {notation:"fixed"});

}

function ppval_order(f, placeInLine, amount) {

    var beanAmount = math.bignumber(0);
    var end = math.add(math.bignumber(placeInLine), math.bignumber(amount));
    var numIntervals = getNumIntervals(f.ranges);
    var pieceIndex = findSortedIndex(f.ranges, math.bignumber(placeInLine), numIntervals - 1);

    var start = math.bignumber(placeInLine);
    var end = math.add(start, math.bignumber(amount));

    if(math.compare(start, f.ranges[0]) == -1) start = math.bignumber(f.ranges[0]);
   
    while(math.compare(start, end) == -1) {
        if(!(math.compare(pieceIndex, numIntervals-1) == 0)) {
            if(math.compare(end, math.bignumber(f.ranges[pieceIndex + 1])) == 1) {

                var term = ppval_integrate(f, start, f.ranges[pieceIndex + 1], pieceIndex); 
                start = math.bignumber(f.ranges[pieceIndex+1]);
                beanAmount = math.add(beanAmount, term);
    
                if(pieceIndex < (numIntervals - 1)) pieceIndex++;
                
            } else {
                //integrate from x until end 
                var term = ppval_integrate(f, start, end, pieceIndex);
                beanAmount = math.add(beanAmount, term);
                start = end;
            }
        }else{
            var term = ppval_integrate(f, start, end, pieceIndex);
            beanAmount = math.add(beanAmount, term);
            start = end;
        }
        
        
    }
    return math.format(math.floor(math.divide(beanAmount, 1000000)), {notation: "fixed"});

}

module.exports = {
    ppval_order,
    ppval_listing,
    findSortedIndex,
    ppval,
    ppval_integrate,
    interpolate,
    getNumIntervals
}

