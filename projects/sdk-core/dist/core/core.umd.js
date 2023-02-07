(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ethers'), require('ethers/lib/utils')) :
    typeof define === 'function' && define.amd ? define(['exports', 'ethers', 'ethers/lib/utils'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.SDKCore = {}, global.ethers, global.utils));
})(this, (function (exports, ethers, utils) { 'use strict';

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

    const blocker = {};
    class TokenValue {
        constructor(_blocker, _bigNumber, decimals) {
            if (_blocker !== blocker)
                throw new Error("Do not create an instance via the constructor. Use the .from...() methods");
            this.decimals = decimals;
            this.value = new DecimalBigNumber(_bigNumber, decimals);
            this.humanString = this.toHuman();
            this.blockchainString = this.toBlockchain();
            // make values immutable
            Object.defineProperty(this, "decimals", { configurable: false, writable: false });
            Object.defineProperty(this, "value", { configurable: false, writable: false });
        }
        /**
         * Create a TokenValue from string, number, or BigNumber values that represent a **human** readable form.
         * For example: "3" ETH, or "4.5" beans.
         * If your value is a blockchain value, for ex 3e18 or 4500000, use `fromBlockchain()` method instead.
         *
         * Example: `fromHuman('3.14', 6)` means 3.14 BEAN tokens, and would be represented as 3140000 on the blockchain
         *
         * Warning: Even thought we support supplying the value as a BigNumber, make sure you really mean to use it here.
         * If your input is a BigNumber, you most likely want to use `.fromBlockchain()`
         *
         * @param value The amount, as a human readable value, in string, number or BigNumber form.
         * @param decimals The number of decimals this TokenValue should be stored with. For ex, 6 for BEAN or 18 for ETH
         * @returns a TokenValue
         */
        static fromHuman(value, decimals) {
            if (typeof value === "string")
                return TokenValue.fromString(value, decimals);
            if (typeof value === "number")
                return TokenValue.fromString(value.toString(), decimals);
            if (value instanceof ethers.BigNumber) {
                // TODO: are we ok with this warning? should we add ability to ignore it?
                console.warn("WARNING: calling TokenValue.fromHuman(BigNumber). This may have unexpected results. Are you sure you didn't mean TokenValue.fromBlockchain(BigNumber)?");
                return TokenValue.fromString(value.toString(), decimals);
            }
            throw new Error("Invalid value parameter");
        }
        /**
         * Create a TokenValue from string, number, or BigNumber values that represent a **blockhain** value.
         * For example: 3e18 ETH, or 4500000 beans.
         * If your value is a human readable value, for ex 5 ETH  or 3.14 BEAN, use `fromHuman()` method instead.
         *
         * Example: `fromBlockchain('3140000', 6)` means 3.14 BEAN tokens, and would be represented as 3140000 on the blockchain
         * @param value The amount, as a human readable value, in string, number or BigNumber form.
         * @param decimals The number of decimals this TokenValue should be stored with. For ex, 6 for BEAN or 18 for ETH
         * @returns a TokenValue
         */
        static fromBlockchain(value, decimals) {
            if (typeof value === "string" || typeof value === "number") {
                const units = ethers.utils.formatUnits(value, decimals);
                return TokenValue.fromString(units, decimals);
            }
            if (value._isBigNumber)
                return TokenValue.fromBigNumber(value, decimals);
            throw new Error("Invalid value parameter");
        }
        /**
         * Create a TokenValue from another decimal-supporting object: DecimalBigNumber or TokenValue.
         *
         * @param value The amount
         * @returns a TokenValue
         */
        static from(value) {
            if (value instanceof DecimalBigNumber) {
                return new TokenValue(blocker, value.toBigNumber(), value.getDecimals());
            }
            if (value instanceof TokenValue)
                return value;
            throw new Error('Invalid "value" parameter');
        }
        static fromBigNumber(value, decimals) {
            return new TokenValue(blocker, value, decimals);
        }
        static fromString(value, decimals) {
            if (!value) {
                throw new Error("Must provide value to BigNumber.fromHuman(value,decimals)");
            }
            if (decimals == undefined || decimals == null) {
                throw new Error("Must provide decimals to BigNumber.fromHuman(value,decimals)");
            }
            let [int, safeDecimals] = value.split(".");
            if (safeDecimals && safeDecimals.length > decimals) {
                safeDecimals = safeDecimals.substring(0, decimals);
            }
            const safeValue = safeDecimals ? `${int}.${safeDecimals}` : int;
            const result = ethers.utils.parseUnits(safeValue, decimals);
            return TokenValue.fromBigNumber(result, decimals);
        }
        ////// Utility Functions //////
        toBigNumber() {
            return this.value.toBigNumber();
        }
        toBlockchain() {
            return this.value.toBigNumber().toString();
        }
        /**
         * @deprecated
         * Ambiguous function. This exists only as a safety, otherwise the .toString()
         * call would go to Object.toString().
         * @returns
         */
        toString() {
            return this.toBlockchain();
        }
        toHex() {
            return this.value.toBigNumber()._hex;
        }
        /**
         * Returns a human readable string, for example "3.14"
         * @returns string
         */
        toHuman() {
            return this.value.toString();
        }
        // Used mostly by the math functions to normalize the input
        toDBN(num) {
            if (num instanceof TokenValue) {
                return TokenValue.from(num).value;
            }
            else if (num instanceof ethers.BigNumber) {
                return TokenValue.fromBlockchain(num, 0).value;
            }
            else {
                const decimals = num.toString().split(".")[1]?.length || 0;
                return TokenValue.fromHuman(num, decimals).value;
            }
        }
        /**
         * Returns a new TokenValue with the number of decimals set to the new value
         * @param decimals
         */
        reDecimal(decimals) {
            return TokenValue.from(this.value.reDecimal(decimals));
        }
        ////// Math Functions //////
        add(num) {
            return TokenValue.from(this.value.add(this.toDBN(num)));
        }
        sub(num) {
            return TokenValue.from(this.value.sub(this.toDBN(num)));
        }
        mod(num) {
            // num needs to have the same number of decimals as THIS
            let n = this.toDBN(num).reDecimal(this.decimals);
            return TokenValue.from(this.value.mod(n));
        }
        mul(num) {
            return TokenValue.from(this.value.mul(this.toDBN(num)).reDecimal(this.decimals));
        }
        mulMod(num, denominator) {
            return TokenValue.from(this.value.mul(this.toDBN(num)).mod(this.toDBN(denominator).reDecimal(this.decimals)));
        }
        mulDiv(num, denominator, rounding) {
            return TokenValue.from(this.value.mulDiv(this.toDBN(num), this.toDBN(denominator), rounding).reDecimal(this.decimals));
        }
        div(num, decimals) {
            return TokenValue.from(this.value.div(this.toDBN(num), decimals));
        }
        eq(num) {
            return this.value.eq(this.toDBN(num));
        }
        gt(num) {
            return this.value.gt(this.toDBN(num));
        }
        gte(num) {
            return this.value.gte(this.toDBN(num));
        }
        lt(num) {
            return this.value.lt(this.toDBN(num));
        }
        lte(num) {
            return this.value.lte(this.toDBN(num));
        }
        static min(...values) {
            return values.reduce((acc, num) => (acc.lt(num) ? acc : num));
        }
        static max(...values) {
            return values.reduce((acc, num) => (acc.gt(num) ? acc : num));
        }
        abs() {
            return TokenValue.from(this.value.abs());
        }
        pow(num) {
            return TokenValue.from(this.value.pow(num));
        }
        pct(num) {
            const minDecimals = this.decimals < 2 ? 2 : this.decimals;
            if (num < 0)
                throw new Error("Percent value must be bigger than 0");
            return TokenValue.from(this.value.mul(num.toString()).div("100", minDecimals));
        }
        /**
         * Calculates value after substracting slippage.
         *
         * For ex, a value of 100, with slippage 3 would return 97
         *
         * @param slippage The percent to remove from the value. Slippage should be
         * a human readable percentage; 3 = 3%, 25=25%, .1 = 0.1%
         *
         * @return The original value minus slippage
         */
        subSlippage(slippage) {
            return this.pct(100 - slippage);
        }
        /**
         * Calculates value after adding slippage.
         *
         * For ex, a value of 100, with slippage 3 would return 103
         *
         * @param slippage The percent to remove from the value. Slippage should be
         * a human readable percentage; 3 = 3%, 25=25%, .1 = 0.1%
         *
         * @return The original value plus slippage
         */
        addSlippage(slippage) {
            return this.pct(100 + slippage);
        }
    }
    TokenValue.ZERO = TokenValue.fromHuman(0, 0);
    TokenValue.NEGATIVE_ONE = TokenValue.fromHuman(-1, 0);
    TokenValue.ONE = TokenValue.fromHuman(1, 0);
    TokenValue.MAX_UINT32 = TokenValue.fromHuman(4294967295, 0);
    TokenValue.MAX_UINT256 = TokenValue.fromBlockchain(ethers.constants.MaxUint256, 0);

    class Token {
        constructor(chainId, address, decimals, symbol, metadata, signerOrProvider) {
            /** The name of the currency, i.e. a descriptive textual non-unique identifier */
            this.name = "Unknown";
            /** The display name of the currency, i.e. a descriptive textual non-unique identifier */
            this.displayName = "Unknown Token";
            /** Whether or not this is a LP token representing a position in a Pool. */
            this.isLP = false;
            this.chainId = chainId;
            this.address = address?.toLowerCase() ?? "";
            this.decimals = decimals ?? 0;
            this.symbol = symbol ?? "UNKNOWN";
            // make this.provider not enumerable (ie, hide it from console.log output)
            Object.defineProperty(this, "providerOrSigner", {
                value: signerOrProvider,
                writable: true,
                configurable: false,
                enumerable: false
            });
            this.name = metadata?.name ?? "Unknown";
            this.displayName = metadata?.displayName ?? metadata?.name ?? "Unknown Token";
            this.displayDecimals = metadata?.displayDecimals ?? 2;
            this.logo = metadata?.logo;
            this.color = metadata?.color;
            this.isLP = metadata?.isLP || false;
        }
        setSignerOrProvider(provider) {
            this.providerOrSigner = provider;
            // Remove the cached contract when changing provider/signer
            // @ts-ignore - NativeToken does not have 'this.contract', but instead of implementing two copies of this
            // method, for NativeToken and ERC20, we just do it here once and ignore the ts warning
            delete this.contract;
        }
        getSignerOrProvider() {
            if (!this.providerOrSigner)
                throw new Error("Signer or Provider not set");
            return this.providerOrSigner;
        }
        /**
         * Returns whether this currency is functionally equivalent to the other currency
         * @param other the other currency
         */
        equals(other) {
            return this.address === other.address && this.chainId === other.chainId;
        }
        toString() {
            return this.name;
        }
        setMetadata(metadata) {
            if (metadata.logo)
                this.logo = metadata.logo;
            if (metadata.color)
                this.color = metadata.color;
        }
        /**
         * Converts from a blockchain amount to a TokenValue with this token's decimals set
         *
         * Ex: BEAN.fromBlockchain("3140000") => TokenValue holding value "3140000" and 6 decimals
         *
         * @param amount A string value in blockchain format
         * @returns TokenValue
         */
        fromBlockchain(amount) {
            return TokenValue.fromBlockchain(amount, this.decimals);
        }
        /**
         * Converts from a human amount to a TokenAmount with this token's decimals set
         *
         * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
         *
         * @param amount human readable amout, ex: "3.14" ether
         * @returns TokenValue
         */
        fromHuman(amount) {
            return TokenValue.fromHuman(amount, this.decimals);
        }
        /**
         * Alias to `.fromHuman()`
         *
         * Converts from a human amount to a TokenAmount with this token's decimals set
         *
         * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
         *
         * @param amount human readable amout, ex: "3.14" ether
         * @returns TokenValue
         */
        amount(amount) {
            return this.fromHuman(amount);
        }
        /**
         * Converts from a blockchain value to a human readable form
         *
         * Ex: BEAN.toHuman(BigNumber.from('3140000)) => "3.14"
         * @param value A BigNumber with a value of this token, for ex: 1000000 would be 1 BEAN
         * @returns string
         */
        toHuman(value) {
            return ethers.utils.formatUnits(value, this.decimals);
        }
        toTokenValue(value) {
            return TokenValue.fromBlockchain(value, this.decimals);
        }
        approve(spenderContract, amount) {
            // @ts-ignore
            return;
        }
    }

    /* Autogenerated file. Do not edit manually. */
    const _abi = [
        {
            anonymous: false,
            inputs: [
                {
                    indexed: true,
                    internalType: "address",
                    name: "owner",
                    type: "address",
                },
                {
                    indexed: true,
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
                {
                    indexed: false,
                    internalType: "uint256",
                    name: "value",
                    type: "uint256",
                },
            ],
            name: "Approval",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                {
                    indexed: true,
                    internalType: "address",
                    name: "from",
                    type: "address",
                },
                {
                    indexed: true,
                    internalType: "address",
                    name: "to",
                    type: "address",
                },
                {
                    indexed: false,
                    internalType: "uint256",
                    name: "value",
                    type: "uint256",
                },
            ],
            name: "Transfer",
            type: "event",
        },
        {
            inputs: [],
            name: "DOMAIN_SEPARATOR",
            outputs: [
                {
                    internalType: "bytes32",
                    name: "",
                    type: "bytes32",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "owner",
                    type: "address",
                },
                {
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
            ],
            name: "allowance",
            outputs: [
                {
                    internalType: "uint256",
                    name: "",
                    type: "uint256",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "amount",
                    type: "uint256",
                },
            ],
            name: "approve",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "account",
                    type: "address",
                },
            ],
            name: "balanceOf",
            outputs: [
                {
                    internalType: "uint256",
                    name: "",
                    type: "uint256",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [],
            name: "decimals",
            outputs: [
                {
                    internalType: "uint8",
                    name: "",
                    type: "uint8",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "subtractedValue",
                    type: "uint256",
                },
            ],
            name: "decreaseAllowance",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "addedValue",
                    type: "uint256",
                },
            ],
            name: "increaseAllowance",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [],
            name: "name",
            outputs: [
                {
                    internalType: "string",
                    name: "",
                    type: "string",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "owner",
                    type: "address",
                },
            ],
            name: "nonces",
            outputs: [
                {
                    internalType: "uint256",
                    name: "",
                    type: "uint256",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "owner",
                    type: "address",
                },
                {
                    internalType: "address",
                    name: "spender",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "value",
                    type: "uint256",
                },
                {
                    internalType: "uint256",
                    name: "deadline",
                    type: "uint256",
                },
                {
                    internalType: "uint8",
                    name: "v",
                    type: "uint8",
                },
                {
                    internalType: "bytes32",
                    name: "r",
                    type: "bytes32",
                },
                {
                    internalType: "bytes32",
                    name: "s",
                    type: "bytes32",
                },
            ],
            name: "permit",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [],
            name: "symbol",
            outputs: [
                {
                    internalType: "string",
                    name: "",
                    type: "string",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [],
            name: "totalSupply",
            outputs: [
                {
                    internalType: "uint256",
                    name: "",
                    type: "uint256",
                },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "recipient",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "amount",
                    type: "uint256",
                },
            ],
            name: "transfer",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                {
                    internalType: "address",
                    name: "sender",
                    type: "address",
                },
                {
                    internalType: "address",
                    name: "recipient",
                    type: "address",
                },
                {
                    internalType: "uint256",
                    name: "amount",
                    type: "uint256",
                },
            ],
            name: "transferFrom",
            outputs: [
                {
                    internalType: "bool",
                    name: "",
                    type: "bool",
                },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
    ];
    class ERC20Permit__factory {
        static createInterface() {
            return new ethers.utils.Interface(_abi);
        }
        static connect(address, signerOrProvider) {
            return new ethers.Contract(address, _abi, signerOrProvider);
        }
    }
    ERC20Permit__factory.abi = _abi;

    class ERC20Token extends Token {
        getContract() {
            if (!this.contract) {
                // Make this.contract "invisible" to console.log, and immutable
                Object.defineProperty(this, "contract", {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: ERC20Permit__factory.connect(this.address, this.getSignerOrProvider())
                });
            }
            return this.contract;
        }
        async getName() {
            if (this.name)
                return this.name;
            this.name = await this.getContract().name();
            return this.name;
        }
        async loadFromChain() {
            const contract = this.getContract();
            const name = await contract.name();
            this.decimals = await contract.decimals();
            this.symbol = await contract.symbol();
            if (name) {
                this.name = name;
                if (this.displayName === "Unknown Token")
                    this.displayName = name;
            }
        }
        getBalance(account) {
            return this.getContract()
                .balanceOf(account)
                .then((result) => TokenValue.fromBlockchain(result, this.decimals))
                .catch((err) => {
                console.error(`[ERC20Token] ${this.symbol} failed to call balanceOf(${account})`, err);
                throw err;
            });
        }
        getAllowance(account, spender) {
            return this.getContract()
                .allowance(account, spender)
                .then((result) => TokenValue.fromBlockchain(result, this.decimals));
        }
        async hasEnoughAllowance(account, spender, amount) {
            const allowance = await this.getAllowance(account, spender);
            return allowance.toBigNumber().gte(amount instanceof TokenValue ? amount.toBigNumber() : amount);
        }
        getTotalSupply() {
            return this.getContract()
                .totalSupply()
                .then((result) => TokenValue.fromBlockchain(result, this.decimals));
        }
        approve(spenderContract, amount) {
            if (!this.getContract().signer) {
                throw new Error(`A signer is required to call .approve() - ${this.symbol}`);
            }
            return this.getContract().approve(spenderContract, amount instanceof TokenValue ? amount.toBigNumber() : amount);
        }
    }

    class NativeToken extends Token {
        getContract() {
            return null;
        }
        getBalance(account) {
            return this.getSignerOrProvider()
                .getBalance(account)
                .then((result) => TokenValue.fromBlockchain(result, this.decimals));
        }
        getAllowance() {
            return Promise.resolve(TokenValue.MAX_UINT256);
        }
        hasEnoughAllowance() {
            return true;
        }
        getTotalSupply() {
            return undefined;
        }
        equals(other) {
            return this.chainId === other.chainId;
        }
    }

    /**
     * List of supported chains
     */
    exports.ChainId = void 0;
    (function (ChainId) {
        ChainId[ChainId["MAINNET"] = 1] = "MAINNET";
        ChainId[ChainId["LOCALHOST"] = 1337] = "LOCALHOST";
    })(exports.ChainId || (exports.ChainId = {}));
    /**
     * These chains are forks of mainnet,
     * therefore they use the same token addresses as mainnet.
     */
    const TESTNET_CHAINS = new Set([exports.ChainId.LOCALHOST]);

    class Address {
        constructor(addresses) {
            this.addresses = addresses;
            this.MAINNET = this.addresses[exports.ChainId.MAINNET];
            this.LOCALHOST = this.addresses[exports.ChainId.LOCALHOST];
        }
        static make(input) {
            const addresses = {};
            if (typeof input == "string") {
                addresses[exports.ChainId.MAINNET] = input;
            }
            else {
                Object.assign(addresses, input);
            }
            // Make address values lowercase
            const lowerCaseAddresses = {};
            for (const key in addresses) {
                lowerCaseAddresses[key] = addresses[key].toLowerCase();
            }
            return new Address(lowerCaseAddresses);
        }
        get(chainId) {
            // Default to MAINNET if no chain is specified
            if (!chainId) {
                return this.addresses[exports.ChainId.MAINNET];
            }
            // Throw if user wants a specific chain which we don't support
            if (!exports.ChainId[chainId]) {
                throw new Error(`Chain ID ${chainId} is not supported`);
            }
            // If user wants an address on a TESTNET chain
            // return mainnet one if it's not found
            if (TESTNET_CHAINS.has(chainId)) {
                return this.addresses[chainId] || this.addresses[exports.ChainId.MAINNET];
            }
            return this.addresses[chainId];
        }
        set(input) {
            const newAddress = Address.make(input);
            Object.assign(this, newAddress);
        }
    }

    exports.Address = Address;
    exports.DecimalBigNumber = DecimalBigNumber;
    exports.ERC20Token = ERC20Token;
    exports.NativeToken = NativeToken;
    exports.TESTNET_CHAINS = TESTNET_CHAINS;
    exports.Token = Token;
    exports.TokenValue = TokenValue;

}));
//# sourceMappingURL=core.umd.js.map
