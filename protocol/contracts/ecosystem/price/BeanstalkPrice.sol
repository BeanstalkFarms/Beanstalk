//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./CurvePrice.sol";

contract BeanstalkPrice is CurvePrice {

    struct Prices {
        uint256 price;
        uint256 liquidity;
        int deltaB;
        P.Pool[] ps;
    }

    function price() external view returns (Prices memory p) {
        p.ps = new P.Pool[](1);
        p.ps[0] = getCurve();


        for (uint256 i = 0; i < p.ps.length; i++) {
            p.price += p.ps[i].price * p.ps[i].liquidity;
            p.liquidity += p.ps[i].liquidity;
            p.deltaB += p.ps[i].deltaB;
        }
        p.price /= p.liquidity;
    }
}