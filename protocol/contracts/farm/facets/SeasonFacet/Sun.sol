/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Weather.sol";

/**
 * @author Publius
 * @title Sun
**/
contract Sun is Weather {

    using SafeMath for uint256;

    event SupplyIncrease(
        uint256 indexed season,
        uint256 newHarvestable,
        uint256 newSilo,
        int256 newSoil
    );
    event SupplyDecrease(uint256 indexed season, int256 newSoil);
    event SupplyNeutral(uint256 indexed season, int256 newSoil);

    /**
     * Internal
    **/

    // Sun

    function stepSun(int256 deltaB) internal {
        if (deltaB > 0) growSupply(uint256(deltaB));
        else if (deltaB < 0) shrinkSupply(uint256(-deltaB));
        else {
            int256 newSoil = setSoil(0);
            emit SupplyNeutral(season(), newSoil);
        }
        s.w.startSoil = s.f.soil;
    }

    function shrinkSupply(uint256 beans) private {
        int256 newSoil = setSoil(beans);
        emit SupplyDecrease(season(), newSoil);
    }

    function growSupply(uint256 beans) private returns (uint256) {
        (uint256 newHarvestable, uint256 newSilo) = increaseSupply(beans);
        int256 newSoil = setSoil(getMinSoil(newHarvestable));
        emit SupplyIncrease(season(), newHarvestable, newSilo, newSoil);
        return newSilo;
    }
}
