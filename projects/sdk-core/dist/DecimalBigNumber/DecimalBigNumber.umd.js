(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ethers/lib/utils')) :
    typeof define === 'function' && define.amd ? define(['exports', 'ethers/lib/utils'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.SDKCore = {}, global.utils));
})(this, (function (exports, utils) { 'use strict';

    function assert(value, message) {
        if (value === false || value === null || typeof value === "undefined") {
            throw new Error(message || "Assertion failed");
        }
    }

    // Class copied from sushiswap
    // https://github.com/sushiswap/mev-router-devkit/blob/6c94562561797fe11216e7e656828906d783ca79/src/DecimalBigNumber.ts
    class DecimalBigNumber {
        constructor(value, decimals) {
            if (typeof value === "string") {
                const _value = value.trim() === "" || isNaN(Number(value)) ? "0" : value;
                const _decimals = decimals === undefined ? this._inferDecimalAmount(value) : this._ensurePositive(decimals);
                const formatted = this._setDecimalAmount(_value, _decimals);
                this._value = utils.parseUnits(formatted, _decimals);
                this._decimals = _decimals;
                return;
            }
            assert(decimals !== undefined, "Decimal cannot be undefined");
            this._value = value;
            this._decimals = decimals;
        }
        getDecimals() {
            return this._decimals;
        }
        _inferDecimalAmount(value) {
            const [, decimalStringOrUndefined] = value.split(".");
            return decimalStringOrUndefined?.length || 0;
        }
        /**
         * Sets a value to a specific decimal amount
         *
         * Trims unnecessary decimals
         * Or pads decimals if needed
         *
         * @param value Input value as a string
         * @param decimals Desired decimal amount
         */
        _setDecimalAmount(value, decimals) {
            const [integer, _decimalsOrUndefined] = value.split(".");
            const _decimals = _decimalsOrUndefined || "";
            const paddingRequired = this._ensurePositive(decimals - _decimals.length);
            return integer + "." + _decimals.substring(0, decimals) + "0".repeat(paddingRequired);
        }
        /**
         * Ensures the desired decimal amount is positive
         */
        _ensurePositive(decimals) {
            return Math.max(0, decimals);
        }
        /**
         * Converts this value to a BigNumber
         *
         * Often used when passing this value as
         * an argument to a contract method
         */
        toBigNumber(decimals) {
            return decimals === undefined ? this._value : new DecimalBigNumber(this.toString(), decimals)._value;
        }
        /**
         * Converts to a different decimal
         */
        reDecimal(decimals) {
            return decimals === this._decimals ? this : new DecimalBigNumber(this.toString(), decimals);
        }
        /**
         * Converts this value to a string
         *
         * By default, the string returned will:
         * - Have the same decimal amount that it was initialized with
         * - Have trailing zeroes removed
         * - Not have thousands separators
         *
         * This ensures that the number string is accurate.
         *
         * To override any of these settings, add the `args` object as a parameter.
         *
         * @param args an object containing any of the properties: decimals, trim, format
         * @returns a string version of the number
         */
        toString({ decimals, trim = true, format = false } = {}) {
            let result = utils.formatUnits(this._value, this._decimals);
            // Add thousands separators
            if (format)
                result = utils.commify(result);
            // We default to the number of decimal places specified
            const _decimals = decimals === undefined ? this._decimals : this._ensurePositive(decimals);
            result = this._setDecimalAmount(result, _decimals);
            // We default to trimming trailing zeroes (and decimal points), unless there is an override
            if (trim)
                result = result.replace(/(?:\.|(\..*?))\.?0*$/, "$1");
            return result;
        }
        /**
         * @deprecated
         * Please avoid using this method.
         * If used for calculations: rather than converting this DecimalBigNumber
         * "down" to a number, convert the other number "up" to a DecimalBigNumber.
         *
         * Used when performing approximate calculations with
         * the number where precision __is not__ important.
         *
         * Ex: (new DecimalBigNumber("100", 6)).toApproxNumber() => 100
         */
        toApproxNumber() {
            return parseFloat(this.toString());
        }
        /**
         * Determines if the two values are equal
         */
        eq(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            // Normalize decimals to the largest of the two values
            const largestDecimalAmount = Math.max(valueAsDBN._decimals, this._decimals);
            // Normalize values to the correct decimal amount
            const normalisedThis = new DecimalBigNumber(this.toString(), largestDecimalAmount);
            const normalisedValue = new DecimalBigNumber(valueAsDBN.toString(), largestDecimalAmount);
            return normalisedThis._value.eq(normalisedValue._value);
        }
        /**
         * Subtracts this value by the value provided
         */
        sub(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            // Normalize decimals to the largest of the two values
            const largestDecimalAmount = Math.max(valueAsDBN._decimals, this._decimals);
            // Normalize values to the correct decimal amount
            const normalisedThis = new DecimalBigNumber(this.toString(), largestDecimalAmount);
            const normalisedValue = new DecimalBigNumber(valueAsDBN.toString(), largestDecimalAmount);
            return new DecimalBigNumber(normalisedThis._value.sub(normalisedValue._value), largestDecimalAmount);
        }
        /**
         * Sums this value and the value provided
         */
        add(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            // Normalize decimals to the largest of the two values
            const largestDecimalAmount = Math.max(valueAsDBN._decimals, this._decimals);
            // Normalize values to the correct decimal amount
            const normalisedThis = new DecimalBigNumber(this.toString(), largestDecimalAmount);
            const normalisedValue = new DecimalBigNumber(valueAsDBN.toString(), largestDecimalAmount);
            return new DecimalBigNumber(normalisedThis._value.add(normalisedValue._value), largestDecimalAmount);
        }
        isPositive() {
            return this._value.gte(0);
        }
        /**
         * Determines if this value is greater than the provided value
         */
        gt(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            // Normalize decimals to the largest of the two values
            const largestDecimalAmount = Math.max(valueAsDBN._decimals, this._decimals);
            // Normalize values to the correct decimal amount
            const normalisedThis = new DecimalBigNumber(this.toString(), largestDecimalAmount);
            const normalisedValue = new DecimalBigNumber(valueAsDBN.toString(), largestDecimalAmount);
            return normalisedThis._value.gt(normalisedValue._value);
        }
        /**
         * Determines if this value is greater than or equal to the provided value
         */
        gte(value) {
            return this.gt(value) || this.eq(value);
        }
        /**
         * Determines if this value is less than the provided value
         */
        lt(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            // Normalize decimals to the largest of the two values
            const largestDecimalAmount = Math.max(valueAsDBN._decimals, this._decimals);
            // Normalize values to the correct decimal amount
            const normalisedThis = new DecimalBigNumber(this.toString(), largestDecimalAmount);
            const normalisedValue = new DecimalBigNumber(valueAsDBN.toString(), largestDecimalAmount);
            return normalisedThis._value.lt(normalisedValue._value);
        }
        /**
         * Determines if this value is less than or equal to the provided value
         */
        lte(value) {
            return this.lt(value) || this.eq(value);
        }
        /**
         * Multiplies this value by the provided value
         */
        mul(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            const product = this._value.mul(valueAsDBN._value);
            // Multiplying two BigNumbers produces a product with a decimal
            // amount equal to the sum of the decimal amounts of the two input numbers
            return new DecimalBigNumber(product, this._decimals + valueAsDBN._decimals);
        }
        mod(value) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            return new DecimalBigNumber(this._value.mod(valueAsDBN._value), this._decimals);
        }
        mulMod(value, denominator) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            const denominatorAsDBN = denominator instanceof DecimalBigNumber ? denominator : new DecimalBigNumber(denominator);
            const result = this._value.mul(valueAsDBN._value).mod(denominatorAsDBN._value);
            return new DecimalBigNumber(result, this._decimals);
        }
        mulDiv(value, denominator, rounding) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            const denominatorAsDBN = denominator instanceof DecimalBigNumber ? denominator : new DecimalBigNumber(denominator);
            let result = this._value.mul(valueAsDBN._value).div(denominatorAsDBN._value);
            if (rounding === "up" && this.mulMod(value, denominator).gt("0")) {
                result = result.add(1);
            }
            return new DecimalBigNumber(result, this._decimals);
        }
        /**
         * Divides this value by the provided value
         *
         * By default, this returns a value whose decimal amount is equal
         * to the sum of the decimal amounts of the two values used.
         * If this isn't enough, you can specify a desired
         * decimal amount using the second function argument.
         *
         * @param decimals The expected decimal amount of the output value
         */
        div(value, decimals) {
            const valueAsDBN = value instanceof DecimalBigNumber ? value : new DecimalBigNumber(value);
            const _decimals = decimals === undefined ? this._decimals + valueAsDBN._decimals : this._ensurePositive(decimals);
            // When we divide two BigNumbers, the result will never
            // include any decimal places because BigNumber only deals
            // with whole integer values. Therefore, in order for us to
            // include a specific decimal amount in our calculation, we need to
            // normalize the decimal amount of the two numbers, such that the difference
            // in their decimal amount is equal to the expected decimal amount
            // of the result, before we do the calculation
            //
            // E.g:
            // 22/5 = 4.4
            //
            // But ethers would return:
            // 22/5 = 4 (no decimals)
            //
            // So before we calculate, we add n padding zeros to the
            // numerator, where n is the expected decimal amount of the result:
            // 220/5 = 44
            //
            // Normalized to the expected decimal amount of the result
            // 4.4
            const normalisedThis = new DecimalBigNumber(this.toString(), _decimals + valueAsDBN._decimals);
            const quotient = normalisedThis._value.div(valueAsDBN._value);
            // Return result with the expected output decimal amount
            return new DecimalBigNumber(quotient, _decimals);
        }
        abs() {
            if (this._value.lt(0)) {
                return new DecimalBigNumber(this._value.mul("-1"), this._decimals);
            }
            else {
                return this;
            }
        }
        //only works for positive exponents
        pow(n) {
            if (n == 0)
                return new DecimalBigNumber("1");
            else if (n == 1)
                return this;
            else if (this.eq("0") && n !== 0)
                return new DecimalBigNumber("0");
            else {
                var z = new DecimalBigNumber(this._value, this._decimals);
                //5300000
                //28090000000000
                //148877000000000000000
                for (let i = 1; i < n; i++) {
                    z = z.mul(this);
                }
                return z;
            }
        }
    }

    exports.DecimalBigNumber = DecimalBigNumber;

}));
//# sourceMappingURL=DecimalBigNumber.umd.js.map
