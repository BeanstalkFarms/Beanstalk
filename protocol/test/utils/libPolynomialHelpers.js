const {create, all} = require('mathjs');

const config = {
    matrix: 'Array',
    number: 'BigNumber',
    precision: 256,
    predictable: false,
    epsilon: 1e-48
}

const math = create(all, config);

function evaluatePolynomial(f, x, pieceIndex) {
    var _x = math.bignumber(x);

    var result = math.bignumber(0);
    
    var degreeIndex = 0;
    while(degreeIndex <= 3) {
        
        const coefValue = math.bignumber(f.coefficients[math.add(pieceIndex*4, degreeIndex)])
        const coefExponent = math.pow(math.bignumber(10), math.bignumber(f.exponents[math.add(pieceIndex*4, degreeIndex)]));
        const term = math.floor(math.chain(_x).pow(degreeIndex).multiply(coefValue).divide(coefExponent).done());
        if(f.signs[math.add(pieceIndex*4, degreeIndex)]== 1) result = math.add(result, term)
        else result = math.subtract(result, term)

        degreeIndex = math.add(degreeIndex, 1);
    }

    return math.format(result, {notation: "fixed"});
}

function evaluatePolynomialIntegration(f, start, end, pieceIndex) {

    var _x1 = math.bignumber(start);
    var _x2 = math.bignumber(end);
    
    var positiveSum = math.bignumber(0);
    var negativeSum = math.bignumber(0);
    var degreeIndex = 0;

    while(degreeIndex <= 3) {
        var coefValue = math.bignumber(f.coefficients[math.add(pieceIndex*4, degreeIndex)]);
        var coefExponent = math.pow(math.bignumber(10), math.bignumber(f.exponents[math.add(pieceIndex*4, degreeIndex)]));

        if(f.signs[pieceIndex*4 + degreeIndex] == 1) {
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
        degreeIndex++;
    }
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
        console.log("beanAmount: ", beanAmount);
        console.log("coefficients: ", getValueArray(f.coefficients, pieceIndex))
        console.log("exponents: ", getValueArray(f.exponents, pieceIndex))
        console.log("signs: ", getValueArray(f.signs, pieceIndex))
        if(!(math.compare(pieceIndex, numPieces - 1) == 0)) {
            
            if(math.compare(end, f.breakpoints[pieceIndex + 1]) == 1) {
                
                var term = evaluatePolynomialIntegration(f, math.subtract(start, f.breakpoints[pieceIndex]), math.subtract(f.breakpoints[pieceIndex + 1], f.breakpoints[pieceIndex]), pieceIndex); 
                start = math.bignumber(f.breakpoints[pieceIndex + 1]);
                beanAmount = math.add(beanAmount, term);

                if(pieceIndex < (numPieces - 1)) pieceIndex++;
                
            } else {

                var term = evaluatePolynomialIntegration(f, math.subtract(start, f.breakpoints[pieceIndex]), math.subtract(end, f.breakpoints[pieceIndex]), pieceIndex);
                beanAmount = math.add(beanAmount, term);
                start = end;
            }
        }else{

            var term = evaluatePolynomialIntegration(f, math.subtract(start, f.breakpoints[pieceIndex]), math.subtract(end, f.breakpoints[pieceIndex]), pieceIndex);
            beanAmount = math.add(beanAmount, term);
            start = end;
        }
    }
    return math.format(math.floor(math.divide(beanAmount, 1000000)), {notation: "fixed"});

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

    return low>0?low-1:0;
}

function getValueArray(values, pieceIndex) {
    return [values[pieceIndex*4], values[pieceIndex*4 + 1], values[pieceIndex*4 + 2], values[pieceIndex*4 + 3]];
}

exports.evaluatePolynomial = evaluatePolynomial;
exports.evaluatePolynomialIntegration = evaluatePolynomialIntegration;
exports.getAmountListing = getAmountListing;
exports.getAmountOrder = getAmountOrder;
exports.getNumPieces = getNumPieces;
exports.findIndex = findIndex;
exports.getValueArray = getValueArray;