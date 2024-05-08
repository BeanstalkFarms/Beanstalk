//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {WellPrice, P, C} from "./WellPrice.sol";

interface IWhitelistFacet {
    function getWhitelistedWellLpTokens() external view returns (address[] memory tokens);
}

contract BeanstalkPrice is WellPrice {
    using LibRedundantMath256 for uint256;

    address immutable _beanstalk;

    constructor(address beanstalk) {
        _beanstalk = beanstalk;
    }

    struct Prices {
        uint256 price;
        uint256 liquidity;
        int deltaB;
        P.Pool[] ps;
    }

    /**
     * @notice Returns the non-manipulation resistant on-chain liquidiy, deltaB and price data for
     * Bean in the following liquidity pools.
     * - Constant Product Bean:Eth Well
     * - Constant Product Bean:Wsteth Well
     * NOTE: Assumes all whitelisted Wells are CP2 wells. Needs to be updated if this changes.
     * @dev No protocol should use this function to calculate manipulation resistant Bean price data.
     **/
    function price() external view returns (Prices memory p) {
        address[] memory wells = IWhitelistFacet(_beanstalk).getWhitelistedWellLpTokens();
        p.ps = new P.Pool[](wells.length);
        for (uint256 i = 0; i < wells.length; i++) {
            // Assume all Wells are CP2 wells.
            p.ps[i] = getConstantProductWell(wells[i]);
        }

        // assumes that liquidity and prices on all pools uses the same precision.
        for (uint256 i = 0; i < p.ps.length; i++) {
            p.price += p.ps[i].price.mul(p.ps[i].liquidity);
            p.liquidity += p.ps[i].liquidity;
            p.deltaB += p.ps[i].deltaB;
        }
        p.price = p.price.div(p.liquidity);
    }
}
