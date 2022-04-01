function createInterpolant (xs, ys) {
    var calculateDecimalShifts = function (n) {
        var val = Math.abs(n);
        var counter = 20;
        while(val>1){
            val = val/10;
            counter--;
        }
        if(val<0.1&&val>0){
            while(val<0.1){
                val = val * 10;
                counter++;
            }
        }
        return counter;
    }   
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
    
    // console.log(ys,c1s,c2s,c3s)
    for (i = 0; i < originalL; i++) {
        if(ys[i] != 0){
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
            ys[i] = Math.abs(ys[i])
            c1s[i] = Math.abs(c1s[i])
            c2s[i] = Math.abs(c2s[i])
            c3s[i] = Math.abs(c3s[i])

            shiftsZero[i] = calculateDecimalShifts(ys[i]);
            ys[i] = ys[i]*Math.pow(10,calculateDecimalShifts(ys[i]))

            shiftsOne[i] = calculateDecimalShifts(c1s[i]);
            c1s[i] = c1s[i]*Math.pow(10,calculateDecimalShifts(c1s[i]))
            
            shiftsTwo[i] = calculateDecimalShifts(c2s[i])
            c2s[i] = c2s[i]*Math.pow(10,calculateDecimalShifts(c2s[i]))
            
            shiftsThree[i] = calculateDecimalShifts(c3s[i])
            c3s[i] = c3s[i]*Math.pow(10,calculateDecimalShifts(c3s[i]))
        } 
    }
	
    var constants = ys.concat(c1s).concat(c2s).concat(c3s);
    var shifts = shiftsZero.concat(shiftsOne).concat(shiftsTwo).concat(shiftsThree);
    var bools = boolsZero.concat(boolsOne).concat(boolsTwo).concat(boolsThree);

    
    return {subIntervalIndex:oldXs, constants:constants, shifts:shifts, signs:bools};
};

// let interp1 = createInterpolant(
//     [0,500,1000,1500,2000,2500,3000, 3500, 4000, 4500], 
//     [1000000,900000,800000,700000,600000,500000,400000,300000,200000,100000]
//     );
// console.log(interp1);

module.exports = {
    createInterpolant
};

//minimum price delta
