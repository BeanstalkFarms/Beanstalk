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
    var _x = math.subtract(math.bignumber(x), math.bignumber(f.breakpoints[pieceIndex]));

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

    var _x1 = math.subtract(math.bignumber(start), math.bignumber(f.breakpoints[pieceIndex]));
    var _x2 =  math.subtract(math.bignumber(end), math.bignumber(f.breakpoints[pieceIndex]));
    
    var positiveSum = math.bignumber(0);
    var negativeSum = math.bignumber(0);
    var degreeIndex = 0;

    while(degreeIndex <= 3) {
        var coefValue = math.bignumber(f.coefficients[math.add(pieceIndex*4, degreeIndex)]);
        var coefExponent = math.pow(math.bignumber(10), math.bignumber(f.exponents[math.add(pieceIndex*4, degreeIndex)]));

        if(f.signs[pieceIndex*4 + degreeIndex] == 1) {
            positiveSum = math.add(positiveSum, math.floor(math.chain(_x2).pow(math.add(degreeIndex, 1)).multiply(coefValue).divide(coefExponent).divide(math.add(degreeIndex, 1)).done()));

            positiveSum = math.subtract(positiveSum, math.floor(math.chain(_x1).pow(math.add(degreeIndex, 1)).multiply(coefValue).divide(coefExponent).divide(math.add(degreeIndex, 1)).done()));
        } else {
            negativeSum = math.add(negativeSum, math.floor(math.chain(_x2).pow(math.add(degreeIndex, 1)).multiply(coefValue).divide(coefExponent).divide(math.add(degreeIndex, 1)).done()));

            negativeSum = math.subtract(negativeSum, math.floor(math.chain(_x2).pow(math.add(degreeIndex, 1)).multiply(coefValue).divide(coefExponent).divide(math.add(degreeIndex, 1)).done()));
        }
        degreeIndex++;
    }
    return math.format(math.subtract(positiveSum, negativeSum), {notation: "fixed"});
}

function getAmountListing(f, placeInLine, amountBeans,) {
    const pieceIndex = findIndex(f.breakpoints, placeInLine, f.numPieces);
    const pricePerPod = evaluatePolynomial(f, placeInLine, pieceIndex);
    const amountPods = math.floor(math.divide(math.multiply(amountBeans, 1000000), pricePerPod));
    return math.format(amountPods, {notation:"fixed"});

}

function getAmountOrder(f, placeInLine, amountPodsFromOrder) {
    
    var beanAmount = math.bignumber(0);
    var start = math.bignumber(placeInLine);
    const end = math.add(start, math.bignumber(amountPodsFromOrder));
    var currentPieceIndex = findIndex(f.breakpoints, placeInLine, f.numPieces);
    var nextPieceStart = math.bignumber(f.breakpoints[currentPieceIndex + 1]);
    var integrateToEnd = false;

    while(!integrateToEnd) {
        if(math.compare(end, nextPieceStart) == 1) {
            integrateToEnd = false;
        } else {
            integrateToEnd = true;
        }

        const endIntegration = integrateToEnd ? end : nextPieceStart;
        
        beanAmount = math.add(beanAmount, math.bignumber(evaluatePolynomialIntegration(f, start, endIntegration, currentPieceIndex)));
        
        if(!integrateToEnd) {
            start = nextPieceStart;
            if(currentPieceIndex == (f.numPieces - 1)) {
                integrateToEnd = true;
            } else {
                currentPieceIndex++;
                if(currentPieceIndex != (f.numPieces - 1)) nextPieceStart = math.bignumber(f.breakpoints[currentPieceIndex + 1]);
            }
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
        else if(math.compare(math.bignumber(array[low]), math.bignumber(value)) == 1) return low - 1;
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