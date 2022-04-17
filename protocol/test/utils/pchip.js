function createInterpolant(xs, ys) {
    var calculateDecimalShifts = function (n) {
        var val = Math.abs(n);
        var counter = 20;
        while (val > 1) {
            val = val / 10;
            counter--;
        }
        if (val <= 0.1 && val > 0) {
            while (val <= 0.1) {
                val = val * 10;
                counter++;
            }
        }
        return counter;
    }
    var i, length = xs.length;

    // Deal with length issues
    if (length != ys.length) { throw 'Need an equal count of xs and ys.'; }
    if (length === 0) { return function (x) { return 0; }; }
    if (length === 1) {
        // Impl: Precomputing the result prevents problems if ys is mutated later and allows garbage collection of ys
        // Impl: Unary plus properly converts values to numbers
        var result = +ys[0];
        return function (x) { return result; };
    }

    // Rearrange xs and ys so that xs is sorted
    var indexes = [];
    for (i = 0; i < length; i++) {
        indexes.push(i);
    }

    indexes.sort(function (a, b) {
        return xs[a] < xs[b] ? -1 : 1;
    });

    var oldXs = xs
    var oldYs = ys;
    // Impl: Creating new arrays also prevents problems if the input arrays are mutated later
    xs = []; ys = [];
    // Impl: Unary plus properly converts values to numbers
    for (i = 0; i < length; i++) {
        xs.push(+oldXs[indexes[i]]);
        ys.push(+oldYs[indexes[i]]);
    }

    // Get consecutive differences and slopes
    var dys = []
    var dxs = []
    var ms = []
    for (i = 0; i < length - 1; i++) {
        var dx = xs[i + 1] - xs[i]
        var dy = ys[i + 1] - ys[i];
        dxs.push(dx);
        dys.push(dy);
        ms.push(dy / dx);
    }

    // Get degree-1 coefficients
    var c1s = [ms[0]];
    for (i = 0; i < dxs.length - 1; i++) {
        var m = ms[i]
        var mNext = ms[i + 1];
        if (m * mNext <= 0) {
            c1s.push(0);
        } else {
            var dx_ = dxs[i]
            var dxNext = dxs[i + 1]
            var common = dx_ + dxNext;
            c1s.push(3 * common / ((common + dxNext) / m + (common + dx_) / mNext));
        }
    }
    c1s.push(ms[ms.length - 1]);

    // Get degree-2 and degree-3 coefficients
    var c2s = [];
    var c3s = [];
    for (i = 0; i < c1s.length - 1; i++) {
        var c1 = c1s[i]
        var m_ = ms[i]
        var invDx = 1 / dxs[i]
        var common_ = c1 + c1s[i + 1] - m_ - m_
        c2s.push((m_ - c1 - common_) * invDx);
        c3s.push(common_ * invDx * invDx);
    }


    var originalL = xs.length;
    var xZero = new Array(10 - xs.length).fill(0)
    var zerosZero = new Array(10 - ys.length).fill(0);
    var onesZero = new Array(10 - c1s.length).fill(0);
    var twosZero = new Array(10 - c2s.length).fill(0);
    var threesZero = new Array(10 - c3s.length).fill(0);
    xs = xs.concat(xZero)
    ys = ys.concat(zerosZero)
    c1s = c1s.concat(onesZero)
    c2s = c2s.concat(twosZero)
    c3s = c3s.concat(threesZero)
    var shiftsZero = new Array(10).fill(0);
    var shiftsOne = new Array(10).fill(0);
    var shiftsTwo = new Array(10).fill(0);
    var shiftsThree = new Array(10).fill(0);
    var boolsZero = new Array(10).fill(true);
    var boolsOne = new Array(10).fill(true);
    var boolsTwo = new Array(10).fill(true);
    var boolsThree = new Array(10).fill(true);

    var oldXsZero = new Array(10 - oldXs.length).fill(0);
    var oldXsFormatted = oldXs.concat(oldXsZero)

    // console.log(ys,c1s,c2s,c3s)
    for (i = 0; i < originalL; i++) {
        if (ys[i] != 0) {
            if (ys[i] < 0) {
                boolsZero[i] = false;
            }

            if (c1s[i] < 0) {
                boolsOne[i] = false;
            }

            if (c2s[i] < 0) {
                boolsTwo[i] = false;
            }

            if (c3s[i] < 0) {
                boolsThree[i] = false;
            }
            ys[i] = Math.abs(ys[i])
            c1s[i] = Math.abs(c1s[i])
            c2s[i] = Math.abs(c2s[i])
            c3s[i] = Math.abs(c3s[i])

            shiftsZero[i] = calculateDecimalShifts(ys[i]);
            ys[i] = ys[i] * Math.pow(10, calculateDecimalShifts(ys[i]))

            shiftsOne[i] = calculateDecimalShifts(c1s[i]);
            c1s[i] = c1s[i] * Math.pow(10, calculateDecimalShifts(c1s[i]))

            shiftsTwo[i] = calculateDecimalShifts(c2s[i])
            c2s[i] = c2s[i] * Math.pow(10, calculateDecimalShifts(c2s[i]))

            shiftsThree[i] = calculateDecimalShifts(c3s[i])
            c3s[i] = c3s[i] * Math.pow(10, calculateDecimalShifts(c3s[i]))
        }
    }

    var constants = ys.concat(c1s).concat(c2s).concat(c3s);
    var shifts = shiftsZero.concat(shiftsOne).concat(shiftsTwo).concat(shiftsThree);
    var bools = boolsZero.concat(boolsOne).concat(boolsTwo).concat(boolsThree);
    // console.log(oldXsFormatted, constants, shifts, bools)
    return { subintervals: oldXsFormatted, constants: constants, shifts: shifts, signs: bools };
};

function findIndex(ranges, x, start, end) {
    let index = start;
    while (index < end) {
        if(x >= ranges[index] && (ranges[index+1] ? x < ranges[index+1] : true)){
            break;
        } else {
            index++;
        } 
    }
    // console.log(index)
    return index;
}

//integrate a PCHIP from x to k, with a piecewise of 10 parts
function evaluatePCHIPI(f, x, amount) {
    let startIndex = findIndex(f.subintervals, x, 0, f.subintervals.length)
    let endIndex = findIndex(f.subintervals, x + amount, 0, f.subintervals.length)

    if (x + amount <= f.subintervals[startIndex + 1]) {
        return evaluateCubic(f.constants[startIndex] / Math.pow(10, f.shifts[startIndex]), f.constants[startIndex + 10] / Math.pow(10, f.shifts[startIndex + 10]), f.constants[startIndex + 20] / Math.pow(10, f.shifts[startIndex + 20]), f.constants[startIndex + 30] / Math.pow(10, f.shifts[startIndex + 30]), x, amount, true);
    }

    let midSum = 0;
    let i;
    for (i = 1; i < (endIndex - startIndex - 1); i++) {
        midSum += evaluateCubic(f.constants[startIndex + i] / Math.pow(10, f.shifts[startIndex + i] - 6), f.constants[startIndex + i + 10] / Math.pow(10, f.shifts[startIndex + i + 10] - 6), f.constants[startIndex + i + 20] / Math.pow(10, f.shifts[startIndex + i + 20] - 6), f.constants[startIndex + i + 30] / Math.pow(10, f.shifts[startIndex + i + 30] - 6), 0, f.subintervals[startIndex + i + 1] - f.subintervals[startIndex + i])
    }
    var cubic1 = evaluateCubic(f.constants[startIndex] / Math.pow(10, f.shifts[startIndex]), f.constants[startIndex + 10] / Math.pow(10, f.shifts[startIndex + 10]), f.constants[startIndex + 20] / Math.pow(10, f.shifts[startIndex + 20]), f.constants[startIndex + 30] / Math.pow(10, f.shifts[startIndex + 30]), x, f.subintervals[startIndex], true)
    var cubic2 = evaluateCubic(f.constants[endIndex] / Math.pow(10, f.shifts[endIndex]), f.constants[endIndex + 10] / Math.pow(10, f.shifts[endIndex + 10]), f.constants[endIndex + 20] / Math.pow(10, f.shifts[endIndex + 20]), f.constants[endIndex + 30] / Math.pow(10, f.shifts[endIndex + 30]), f.subintervals[endIndex], amount+x,true)
    // console.log(cubic1, cubic2, midSum)
    return cubic1 + cubic2 + midSum;
}

function evaluatePchip(f, x, i) {
    let val = evaluateCubic([f.constants[i], f.constants[i+10], f.constants[i+20], f.constants[i+30]], [f.shifts[i], f.shifts[i+10], f.shifts[i+20], f.shifts[i+30]],[f.signs[i], f.signs[i+10], f.signs[i+20], f.signs[i+30]], x, false);
    console.log([f.constants[i], f.constants[i+10], f.constants[i+20], f.constants[i+30]], [f.shifts[i], f.shifts[i+10], f.shifts[i+20], f.shifts[i+30]]);
    val = Math.round(val)
    return val;
}

function evaluateCubic(valueArray, shiftsArray, signArray, x, integrate) {
    console.log(valueArray, shiftsArray)
    console.log(valueArray[0]/Math.pow(10,shiftsArray[0]))
    console.log(valueArray[1]*x/Math.pow(10,shiftsArray[1]))
    console.log(valueArray[2]*x**2/Math.pow(10,shiftsArray[2]))
    console.log(valueArray[3]*x**3/Math.pow(10, shiftsArray[3]))
    let y = 0;
    for(let i = 0; i < 4; i++){
        if(signArray[i]){
            y += valueArray[i]*(x**i) / Math.pow(10, shiftsArray[i])
        } else {
            y -= valueArray[i]*(x**i) / Math.pow(10, shiftsArray[i])
        }
    }
    if(y<0){
        throw Error("Subtraction overflow")
    }
    return y
}

module.exports = {
    createInterpolant,
    getInterpSum:evaluatePCHIPI,
    getInterpPrice:evaluatePchip,
    findIndex
};

// let x = [0, 1000, 6000]
// let y = [800000,700000,600000]

// var interp = createInterpolant(x,y);

// console.log(interp);

// console.log("1: ", evaluatePchip(interp, 0));

// console.log("2: ", evaluatePCHIPI(interp, 0, 2000));

//minimum price delta
