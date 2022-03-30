var dpchst = function(arg1, arg2) {
    if (arg1 === 0 || arg2 === 0) {
        return 0;
    }
    if (arg1 > 0) {
        return arg2 > 0 ? 1 : -1;
    }
    return arg2 > 0 ? -1 : 1;
}

function dpchim(x, y) {
    if (x.length !== y.length) {
        throw new Error('input array lengths must match');
    }
    const n = x.length;
    if (n < 2) {
        throw new Error('number of data points less than two');
    }
    for (let i = 1; i < n; ++i) {
        if (x[i] <= x[i - 1]) {
            throw new Error('x-array not strictly increasing');
        }
    }
    if (n === 2) {
        const deriv = (y[1] - y[0]) / (x[1] - x[0]);
        return [deriv, deriv];
    }
    const d = new Array(n);
    let h1 = x[1] - x[0];
    let del1 = (y[1] - y[0]) / h1;
    let h2 = x[2] - x[1];
    let del2 = (y[2] - y[1]) / h2;

    // set d[0] via non-centered three-point formula, adjusted to be shape-preserving
    let hsum = h1 + h2;
    let w1 = (h1 + hsum) / hsum;
    let w2 = -h1 / hsum;
    d[0] = w1 * del1 + w2 * del2;
    if (dpchst(d[0], del1) < 0) {
        d[0] = 0;
    }
    else if (dpchst(del1, del2) < 0) {
        // need do this check only if monotonicity switches
        const dmax = 3 * del1;
        if (Math.abs(d[0]) > Math.abs(dmax)) {
            d[0] = dmax;
        }
    }

    // loop through interior points
    for (let i = 1; i < n - 1; ++i) {
        if (i > 1) {
            h1 = h2;
            h2 = x[i + 1] - x[i];
            hsum = h1 + h2;
            del1 = del2;
            del2 = (y[i + 1] - y[i]) / h2;
        }
        d[i] = 0;
        if (dpchst(del1, del2) > 0) {
            // use Brodlie modification of Butland formula
            const hsumt3 = hsum * 3;
            w1 = (hsum + h1) / hsumt3;
            w2 = (hsum + h2) / hsumt3;
            const dmax = Math.max(Math.abs(del1), Math.abs(del2));
            const dmin = Math.min(Math.abs(del1), Math.abs(del2));
            const drat1 = del1 / dmax;
            const drat2 = del2 / dmax;
            d[i] = dmin / (w1 * drat1 + w2 * drat2);
        }
        else {
            d[i] = 0; // set d[i] = 0 unless data are strictly monotonic
        }
    }

    // set d[n - 1] via non-centered three-point formula, adjusted to be shape-preserving
    w1 = -h2 / hsum;
    w2 = (h2 + hsum) / hsum;
    d[n - 1] = w1 * del1 + w2 * del2;
    if (dpchst(d[n - 1], del2) < 0) {
        d[n - 1] = 0;
    }
    else if (dpchst(del1, del2) < 0) {
        // need do this check only if monotonicity switches
        const dmax = 3 * del2;
        if (Math.abs(d[n - 1]) > Math.abs(dmax)) {
            d[n - 1] = dmax;
        }
    }

    return d;
}

var lowerBound = function (arr,value) {
    if (arr.length === 0) {
        return 0;
    }
    let low = 0;
    let high = arr.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (arr[mid] < value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return high;
}

var createInterpolant = function(xs, ys) {
	var i, length = xs.length;
	
	// Deal with length issues
	if (length != ys.length) { throw 'Need an equal count of xs and ys.'; }
	if (length === 0) { return function(x) { return 0; }; }
	if (length === 1) {
		// Impl: Precomputing the result prevents problems if ys is mutated later and allows garbage collection of ys
		// Impl: Unary plus properly converts values to numbers
		var result = +ys[0];
		return function(x) { return result; };
	}
	
	// Rearrange xs and ys so that xs is sorted
	var indexes = [];
	for (i = 0; i < length; i++) { 
        indexes.push(i); 
    }

	indexes.sort(function(a, b) { 
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
        ms.push(dy/dx);
	}
	
	// Get degree-1 coefficients
	var c1s = [ms[0]];
	for (i = 0; i < dxs.length - 1; i++) {
		var m = ms[i]
        var mNext = ms[i + 1];
		if (m*mNext <= 0) {
			c1s.push(0);
		} else {
			var dx_ = dxs[i]
            var dxNext = dxs[i + 1]
            var common = dx_ + dxNext;
			c1s.push(3*common/((common + dxNext)/m + (common + dx_)/mNext));
		}
	}
	c1s.push(ms[ms.length - 1]);
	
	// Get degree-2 and degree-3 coefficients
	var c2s = [];
    var c3s = [];
	for (i = 0; i < c1s.length - 1; i++) {
		var c1 = c1s[i]
        var m_ = ms[i]
        var invDx = 1/dxs[i]
        var common_ = c1 + c1s[i + 1] - m_ - m_
		c2s.push((m_ - c1 - common_)*invDx); 
        c3s.push(common_*invDx*invDx);
	}

    
    var rangeIntegration;
    var termValueStart;
    var termValueEnd;

    var calculateDefiniteIntegral = function (start, end, k, a, b, c, d) {
        end -= end/100000000;
        termValueStart = (a/4*(start-k)**4) + (b/3*(start-k)**3) + (c/2*(start-k)**2) + d*(start - k)
        termValueEnd =   (a/4*(end-k)**4) + (b/3*(end-k)**3) + (c/2*((end-k)**2)) + d*(end - k)
        
        return termValueEnd - termValueStart;
        
    }
    var calculateDecimalShifts = function (n) {
        var val = Math.abs(n);
        var counter = 0;
        while (val > 1) {
            val  = val / 10;
            counter--;
        }
        while (0< val < 1) {
            val = val * 10;
            counter++;
        }
        return counter;
    }
    var originalL = xs.length;
    var xZero = new Array(10-xs.length).fill(0)
    var zerosZero = new Array(10-ys.length).fill(0);
    var onesZero = new Array(10-c1s.length).fill(0);
    var twosZero = new Array(10-c2s.length).fill(0);
    var threesZero = new Array(10-c3s.length).fill(0);
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
    var integrations = new Array(9).fill(0);
    console.log(xs,ys,c1s,c2s,c3s)
    for (i = 0; i < originalL-1; i++) {
        if(ys[i] != 0){
            // if(i<9){
            //     if(xs[i]!=0){
            //         rangeIntegration = calculateDefiniteIntegral(xs[i], xs[i+1], xs[i], c3s[i], c2s[i], c1s[i], ys[i]);
            //         console.log(rangeIntegration)
            //         integrations[i] = rangeIntegration;
            //     }
            // }
            shiftsZero[i] = calculateDecimalShifts(ys[i]);
            shiftsOne[i] = calculateDecimalShifts(c1s[i]);
            shiftsTwo[i] = calculateDecimalShifts(c2s[i])
            shiftsThree[i] = calculateDecimalShifts(c3s[i])

            if(ys[i] < 0) {
                boolsZero[i] = false;
            }
            if(c1s[i] < 0){
                boolsOne[i] = false;
            }
            if(c2s[i] < 0) {
                boolsTwo[i] = false;
            }
            if(c3s[i] < 0){
                boolsThree[i] = false;
            }
        } else {
            break;
        }
    }
	// Return interpolant function
	// var eval = function(x,k) {
	// 	// The rightmost point in the dataset should give an exact result

    //     //-> store xs and ys
	// 	var i = xs.length - 1;
	// 	if (x == xs[i]) { return ys[i]; }
		
	// 	// Search for the interval x is in, returning the corresponding y if x is one of the original xs
	// 	// store c3s, c2s, c1s
    //     var low = 0;
    //     var mid, high = c3s.length - 1;
	// 	while (low <= high) {
	// 		mid = Math.floor(0.5*(low + high));
	// 		var xHere = xs[mid];
	// 		if (xHere < x) { low = mid + 1; }
	// 		else if (xHere > x) { high = mid - 1; }
	// 		else { return ys[mid]; }
	// 	}
	// 	i = Math.max(0, high);
		
	// 	// Interpolate
	// 	var diff = x - k;
    //     var diffSq = diff*diff;
	// 	return ys[i] + c1s[i]*diff + c2s[i]*diffSq + c3s[i]*diff*diffSq;
	// };
    //cut off at arbitrary number of digits
    var constants = ys.concat(c1s).concat(c2s).concat(c3s);
    var shifts = shiftsZero.concat(shiftsOne).concat(shiftsTwo).concat(shiftsThree);
    var bools = boolsZero.concat(boolsOne).concat(boolsTwo).concat(boolsThree);

    //
    return {integrations, constants, shifts, bools};
};

module.exports = {
    createInterpolant
};

//minimum price delta
