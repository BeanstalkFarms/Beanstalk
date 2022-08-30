/* global BigInt */

const {create, all} = require("mathjs");
const {BitDescriptor, BitPacker} = require("./bitpacker.js");


const config = {
    matrix: 'Array',
    number: 'BigNumber',
    precision: 256,
    predictable: false,
    epsilon: 1e-48
}

const math = create(all, config);

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

function getNumPieces(array, maxPieces) {
    var numPieces = 0;
    while(numPieces < maxPieces) {
        if(array[numPieces] == 0 && numPieces != 0) break;
        else if(array[numPieces] == undefined) break;
        numPieces++;
    }

    return numPieces;
}

function findIndex(array, value, high) {
    if(math.compare(math.bignumber(value), math.bignumber(array[0])) == -1) return 0;
    var low = 0;
    while(low < high) {
        if(math.compare(math.bignumber(array[low]), math.bignumber(value)) == 0) return low;
        else if(math.compare(math.bignumber(array[low]), math.bignumber(value)) == 1) break;
        else low++;
    }
    console.log(low>0?low-1:0)
    return low>0?low-1:0;
}

function subtract(x, y) {
    return math.subtract(x, y);
}


//implementation from https://www.wikiwand.com/en/Monotone_cubic_interpolation
function interpolatePoints(xs, ys) {
    var length = xs.length;
    if(length < 2) return;
    if(length > 64) return;
    if(ys.length != length) return;

    var maxPieces;
    if(length <= 4) {
        maxPieces = 4;        
    } else if (length <= 16) {
        maxPieces = 16;
    } else if (length <= 64) {
        maxPieces = 64;
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
            c1s.push(math.divide(math.multiply(math.bignumber(3), math.add(dxs[i], dxs[i+1])), math.add(math.divide(math.add(math.add(dxs[i], dxs[i+1]), dxs[i+1]), ms[i]), math.divide(math.add(math.add(dxs[i], dxs[i+1]), dxs[i]), ms[i+1]))));
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
    
    var breakpoints = new Array(maxPieces);
    var coefficients = new Array(maxPieces*4);
    var exponents = new Array(maxPieces*4);
    var signs = new Array(maxPieces*4);
    for(let i = 0; i < maxPieces; i++){
        if(i<length) {
            signs[i*4] = BitDescriptor.fromBool(math.sign(ys[i]) == 1 || math.sign(ys[i]) == 0);
            signs[i*4 + 1] = BitDescriptor.fromBool(math.sign(c1s[i]) == 1 || math.sign(c1s[i]) == 0);

            var c = 24; 

            exponents[i*4] = BitDescriptor.fromUint8(math.number(ys[i]).calculateShifts(c));
            exponents[i*4 + 1] = BitDescriptor.fromUint8(math.number(c1s[i]).calculateShifts(c));
            
            var exponentDeg0 = math.pow(math.bignumber(10), math.bignumber(math.number(ys[i]).calculateShifts(c)))
            var exponentDeg1 = math.pow(math.bignumber(10), math.bignumber(math.number(c1s[i]).calculateShifts(c)))
            
            coefficients[i*4] = math.format(math.floor(math.abs(math.multiply(ys[i], exponentDeg0))), {notation: "fixed"});
            coefficients[i*4 + 1] = math.format(math.floor(math.abs(math.multiply(c1s[i], exponentDeg1))), {notation: "fixed"});
            
            breakpoints[i] = math.format(xs[i], {notation: "fixed"});

            if(i<(dxs.length)) {
                signs[i*4 + 2] = BitDescriptor.fromBool(math.sign(c2s[i]) == 1 || math.sign(c2s[i]) == 0);
                signs[i*4 + 3] = BitDescriptor.fromBool(math.sign(c3s[i]) == 1 || math.sign(c3s[i]) == 0);

                exponents[i*4 + 2] = BitDescriptor.fromUint8(math.number(c2s[i]).calculateShifts(c));
                exponents[i*4 + 3] = BitDescriptor.fromUint8(math.number(c3s[i]).calculateShifts(c));

                var exponentDeg2 = math.pow(math.bignumber(10), math.bignumber(math.number(c2s[i]).calculateShifts(c)))
                var exponentDeg3 = math.pow(math.bignumber(10), math.bignumber(math.number(c3s[i]).calculateShifts(c)))
                coefficients[i*4 + 2] = math.format(math.floor(math.abs(math.multiply(c2s[i], exponentDeg2))), {notation: "fixed"});
                coefficients[i*4 + 3] = math.format(math.floor(math.abs(math.multiply(c3s[i], exponentDeg3))), {notation: "fixed"});
            } else {
                signs[i*4 + 2] = BitDescriptor.fromBool(false);
                signs[i*4 + 3] = BitDescriptor.fromBool(false);
                exponents[i*4 + 2] = BitDescriptor.fromUint8(0);
                exponents[i*4 + 3] = BitDescriptor.fromUint8(0);
                coefficients[i*4 + 2] = '0';
                coefficients[i*4 + 3] = '0';
            }
        } else {
            breakpoints[i] = '0';
            for(let j = 0; j < 4; j++){
                signs[i*4 + j] = BitDescriptor.fromBool(false);
                exponents[i*4 + j] = BitDescriptor.fromUint8(0);
                coefficients[i*4 + j] = '0';
            }
        }
    }

    const packedSignsArr = BitPacker.pack(signs);
    const packedExponentsArr = BitPacker.pack(exponents);
    
    const packedSignsIter = BitPacker.createUnpackIterator(packedSignsArr)
    const packedExponentsIter = BitPacker.createUnpackIterator(packedExponentsArr)

    const packedSigns = BigInt("0b" + [...packedSignsIter].reverse().join('')).toString();
    var packedExponents;
    if(maxPieces > 8) {
        const packedExponentsBitArr = [...packedExponentsIter];

        packedExponents = [];
        for(let i = 0; i < (Math.floor(maxPieces / 8)); i++){
            packedExponents.push(BigInt("0b" + packedExponentsBitArr.slice(i*256, (i+1)*256).join('')).toString());
        }
    } else {
        const packedExponentsBitArrString = [...packedExponentsIter].join('');
        const paddingArray = (new Array(256 - packedExponentsBitArrString.length).fill('0')).join('');
        packedExponents = BigInt("0b" + packedExponentsBitArrString + paddingArray).toString();
    }
    
    return {breakpoints: breakpoints, coefficients: coefficients, exponents: exponents, signs: signs, packedExponents: packedExponents, packedSigns: packedSigns}
}

function evaluatePolynomial(f, x, pieceIndex) {
    var _x = math.bignumber(x);
    // console.log("evaluatePolynomial: " + _x);
    var result = math.bignumber(0);
    
    var degreeIndex = 0;
    while(degreeIndex <= 3) {
        
        const coefValue = math.bignumber(f.coefficients[math.add(pieceIndex*4, degreeIndex)])
        const coefExponent = math.pow(math.bignumber(10), math.bignumber(f.exponents[math.add(pieceIndex*4, degreeIndex)].value));
        const term = math.floor(math.chain(_x).pow(degreeIndex).multiply(coefValue).divide(coefExponent).done());
        // console.log("coefValue: " + math.divide(coefValue, coefExponent) + " coefExponent: " + f.exponents[pieceIndex*4 + degreeIndex].value + " coefSign: " + f.signs[pieceIndex*4 + degreeIndex].value + " term: " + term);
        if(f.signs[math.add(pieceIndex*4, degreeIndex)].value == 1) result = math.add(result, term)
        else result = math.subtract(result, term)

        degreeIndex = math.add(degreeIndex, 1);
    }
    // console.log(math.format(result, {notation: "fixed"}));
    return math.format(result, {notation: "fixed"});
}

function evaluatePolynomialIntegration(f, start, end, pieceIndex) {

    var _x1 = math.bignumber(start);
    var _x2 = math.bignumber(end);
    // console.log("evaluatePolynomialIntegration: " + _x1 + " to " + _x2);
    
    var positiveSum = math.bignumber(0);
    var negativeSum = math.bignumber(0);
    var degreeIndex = 0;

    while(degreeIndex <= 3) {
        var coefValue = math.bignumber(f.coefficients[math.add(pieceIndex*4, degreeIndex)]);
        var coefExponent = math.pow(math.bignumber(10), math.bignumber(f.exponents[math.add(pieceIndex*4, degreeIndex)].value));

        if(f.signs[pieceIndex*4 + degreeIndex].value == 1) {
            positiveSum = math.add(positiveSum, math.floor(math.chain(_x2)
                .pow(math.add(degreeIndex, 1))
                .multiply(coefValue)
                .divide(coefExponent)
                .divide(math.add(degreeIndex, 1))
                .done()
            ));

            positiveSum = math.subtract(positiveSum, math.floor(math.chain(_x1)
                .pow(math.add(degreeIndex, 1))
                .multiply(coefValue)
                .divide(coefExponent)
                .divide(math.add(degreeIndex, 1))
                .done()
            ));
        } else {
            negativeSum = math.add(negativeSum, math.floor(math.chain(_x2)
                .pow(math.add(degreeIndex, 1))
                .multiply(coefValue)
                .divide(coefExponent)
                .divide(math.add(degreeIndex, 1))
                .done()
            ));

            negativeSum = math.subtract(negativeSum, math.floor(math.chain(_x2)
                .pow(math.add(degreeIndex, 1))
                .multiply(coefValue)
                .divide(coefExponent)
                .divide(math.add(degreeIndex, 1))
                .done()
            ));
        }
        // console.log(positiveSum, negativeSum);
        degreeIndex++;
    }
    // console.log(math.format(result, {notation: "fixed"}));
    return math.format(math.subtract(positiveSum, negativeSum), {notation: "fixed"});
}

function getAmountListing(f, placeInLine, amountBeans, maxPieces) {
    const pieceIndex = findIndex(f.breakpoints, placeInLine, getNumPieces(f.breakpoints, maxPieces) - 1);
    const pricePerPod = evaluatePolynomial(f, placeInLine, pieceIndex);
    const amountPods = math.floor(math.divide(math.multiply(amountBeans, 1000000), pricePerPod));
    return math.format(amountPods, {notation:"fixed"});

}

function getAmountOrder(f, placeInLine, amountPodsFromOrder, maxPieces) {

    var beanAmount = math.bignumber(0);
    const numPieces = getNumPieces(f.breakpoints, maxPieces);
    var pieceIndex = findIndex(f.breakpoints, math.bignumber(placeInLine), numPieces - 1);

    var start = math.bignumber(placeInLine);
    const end = math.add(start, math.bignumber(amountPodsFromOrder));

    if(math.compare(start, f.breakpoints[0]) == -1) start = math.bignumber(f.breakpoints[0]);

    while(math.compare(start, end) == -1) {
        if(!(math.compare(pieceIndex, numPieces - 1) == 0)) {
            
            if(math.compare(end, f.breakpoints[pieceIndex + 1]) == 1) {

                var term = evaluatePolynomialIntegration(f, start, f.breakpoints[pieceIndex + 1], pieceIndex); 
                start = math.bignumber(f.breakpoints[pieceIndex + 1]);
                beanAmount = math.add(beanAmount, term);

                if(pieceIndex < (numPieces - 1)) pieceIndex++;
                
            } else {

                var term = evaluatePolynomialIntegration(f, start, end, pieceIndex);
                beanAmount = math.add(beanAmount, term);
                start = end;
            }
        }else{

            var term = evaluatePolynomialIntegration(f, start, end, pieceIndex);
            beanAmount = math.add(beanAmount, term);
            start = end;
        }
    }
    return math.format(math.floor(math.divide(beanAmount, 1000000)), {notation: "fixed"});

}

module.exports = {
    getAmountOrder,
    getAmountListing,
    findIndex,
    evaluatePolynomial,
    evaluatePolynomialIntegration,
    interpolatePoints,
    getNumPieces,
    subtract
}

