/* global BigInt */

const {create, all} = require("mathjs");

const config = {
    matrix: 'Array',
    number: 'BigNumber',
    precision: 128,
    predictable: true,
    epsilon: 1e-24
}

const math = create(all, config);

const startingExponent = 24;

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

function parseBigInt(str, base=10) {
    base = BigInt(base)
    var bigint = BigInt(0)
    for (var i = 0; i < str.length; i++) {
      var code = str[str.length-1-i].charCodeAt(0) - 48; if(code >= 10) code -= 39
      bigint += base**BigInt(i) * BigInt(code)
    }
    return bigint
  }


function bnToHex(bn) {
    bn = BigInt(bn);
  
    var pos = true;
    if (bn < 0) {
      pos = false;
      bn = bitnot(bn);
    }
  
    var hex = bn.toString(16);
    if (hex.length % 2) { hex = '0' + hex; }
  
    if (pos && (0x80 & parseInt(hex.slice(0, 2), 16))) {
      hex = '00' + hex;
    }
  
    return hex;
}
  
function bitnot(bn) {
    bn = -bn;
    var bin = (bn).toString(2)
    var prefix = '';
    while (bin.length % 8) { bin = '0' + bin; }
    if ('1' === bin[0] && -1 !== bin.slice(1).indexOf('1')) {
      prefix = '11111111';
    }
    bin = bin.split('').map(function (i) {
      return '0' === i ? '1' : '0';
    }).join('');
    return BigInt('0b' + prefix + bin) + BigInt(1);
}

const toHexArray = (binArray, numBytes) => {
    const hexArray = [];
    for(let i = 0; i < binArray.length / (8*numBytes); i++) {
        hexArray.push(parseBigInt(binArray.slice(i*8*numBytes, (i+1)*8*numBytes).join(''), 2).toString(16).padStart(numBytes*2, 0));
    }
    return hexArray;
}

//implementation from https://www.wikiwand.com/en/Monotone_cubic_interpolation
function interpolatePoints(xs, ys) {
    var length = xs.length;
    if(length < 2) return;
    if(length > 64) return;
    if(ys.length != length) return;

    // var maxPieces;
    // if(length <= 4) {
    //     maxPieces = 4;        
    // } else if (length <= 16) {
    //     maxPieces = 16;
    // } else if (length <= 64) {
    //     maxPieces = 64;
    // }
    
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
    
    var breakpoints = new Array(length);
    var coefficients = new Array(length*4);
    var exponents = new Array(length*4);
    var signs = new Array(length*4);
    for(let i = 0; i < length; i++){

        signs[i*4] = math.sign(ys[i]) == 1 || math.sign(ys[i]) == 0;
        signs[i*4 + 1] = math.sign(c1s[i]) == 1 || math.sign(c1s[i]) == 0;

        exponents[i*4] = math.number(ys[i]).calculateShifts(startingExponent);
        exponents[i*4 + 1] = math.number(c1s[i]).calculateShifts(startingExponent);
        
        let exponentDeg0 = math.pow(math.bignumber(10), math.bignumber(math.number(ys[i]).calculateShifts(startingExponent)))
        let exponentDeg1 = math.pow(math.bignumber(10), math.bignumber(math.number(c1s[i]).calculateShifts(startingExponent)))
        
        coefficients[i*4] = math.format(math.floor(math.abs(math.multiply(ys[i], exponentDeg0))), {notation: "fixed"});
        coefficients[i*4 + 1] = math.format(math.floor(math.abs(math.multiply(c1s[i], exponentDeg1))), {notation: "fixed"});
        
        breakpoints[i] = math.format(xs[i], {notation: "fixed"});

        if(i<(dxs.length)) {
            signs[i*4 + 2] = math.sign(c2s[i]) == 1 || math.sign(c2s[i]) == 0;
            signs[i*4 + 3] = math.sign(c3s[i]) == 1 || math.sign(c3s[i]) == 0;

            exponents[i*4 + 2] = math.number(c2s[i]).calculateShifts(startingExponent);
            exponents[i*4 + 3] = math.number(c3s[i]).calculateShifts(startingExponent);

            let exponentDeg2 = math.pow(math.bignumber(10), math.bignumber(math.number(c2s[i]).calculateShifts(startingExponent)))
            let exponentDeg3 = math.pow(math.bignumber(10), math.bignumber(math.number(c3s[i]).calculateShifts(startingExponent)))
            coefficients[i*4 + 2] = math.format(math.floor(math.abs(math.multiply(c2s[i], exponentDeg2))), {notation: "fixed"});
            coefficients[i*4 + 3] = math.format(math.floor(math.abs(math.multiply(c3s[i], exponentDeg3))), {notation: "fixed"});

        } else {
            signs[i*4 + 2] = false;
            signs[i*4 + 3] = false;
            exponents[i*4 + 2] = 0;
            exponents[i*4 + 3] = 0;
            coefficients[i*4 + 2] = '0';
            coefficients[i*4 + 3] = '0';
        }
    }
    
    const hexLen = bnToHex(length).padStart(64, 0);
    const hexBrkpts = breakpoints.map((brkpt) => {
        return bnToHex(brkpt).padStart(64, 0);
    })

    const hexCoefs = coefficients.map((coef) => {
        return bnToHex(coef).padStart(64, 0);
    })

    const hexExps = exponents.map((exp) => {
        return bnToHex(exp).padStart(2, 0);
    })

    const hexSigns = signs.map((sign) => {
        return bnToHex(sign).padStart(2, 0);
    })

    const hexFunc = "0x" + hexLen + hexBrkpts.join('') + hexCoefs.join('') + hexExps.join('') + hexSigns.join('');

    return {breakpoints: breakpoints, coefficients: coefficients, exponents: exponents, signs: signs, packedFunction: hexFunc, numPieces: length};
}

exports.interpolatePoints = interpolatePoints;
