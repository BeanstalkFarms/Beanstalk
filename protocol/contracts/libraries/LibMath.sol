/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Lib Math
**/
library LibMath {

    function sqrt(uint x) internal pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function nthRoot(uint _a, uint _n) internal pure returns(uint) {
        assert (_n > 1);
        // The scale factor is a crude way to turn everything into integer calcs.
        // Actually do (a * (10 ^ n)) ^ (1/n)
        uint a0 = 10 ** _n * _a;

        uint xNew = 10;
        uint x;
        while (xNew != x) {
            x = xNew;
            uint t0 = x ** (_n - 1);
            if (x * t0 > a0) {
                xNew = x - (x - a0 / t0) / _n;
            } else {
                xNew = x + (a0 / t0 - x) / _n;
            }
        }

        return (xNew + 5) / 10;
    }

    function getLastHourstamp() internal view returns (uint32 lastHourstamp, bool even) {
        lastHourstamp = uint32(block.timestamp)/3600-1;
        even = lastHourstamp%2 == 0;
        lastHourstamp = lastHourstamp*3600;
    }
}