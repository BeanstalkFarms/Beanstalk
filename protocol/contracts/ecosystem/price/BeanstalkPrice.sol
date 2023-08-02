//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./CurvePrice.sol";
import {WellPrice, C, SafeMath} from "./WellPrice.sol";

contract BeanstalkPrice is CurvePrice, WellPrice {
    using SafeMath for uint256;

    struct Prices {
        uint256 price;
        uint256 liquidity;
        int deltaB;
        P.Pool[] ps;
    }

    function price() external view returns (Prices memory p) {
        p.ps = new P.Pool[](2);
        p.ps[0] = getCurve();
        p.ps[1] = getConstantProductWell(C.BEAN_ETH_WELL);

        // assumes that liquidity and prices on all pools uses the same precision.
        for (uint256 i = 0; i < p.ps.length; i++) {
            p.price += p.ps[i].price.mul(p.ps[i].liquidity);
            p.liquidity += p.ps[i].liquidity;
            p.deltaB += p.ps[i].deltaB;
        }
        p.price =  p.price.div(p.liquidity);
    }
}