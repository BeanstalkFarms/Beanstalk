/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {IWellFunction} from "contracts/interfaces/basin/IWellFunction.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {C} from "contracts/C.sol";

/**
 * @title Well Bdv Library
 * @notice contains a function to calulate the BDV of a given Well LP Token
 **/
library LibWellBdv {
    using LibRedundantMath256 for uint256;

    uint private constant BEAN_UNIT = 1e6;

    /**
     * @dev Calculates the `_bdv` of a given Well LP Token given a relevant
     * `well` and `amount` value by computing the delta LP token supply given a small change in the Bean reserve balance.
     */
    function bdv(address well, uint amount) internal view returns (uint _bdv) {
        uint beanIndex = LibWell.getBeanIndexFromWell(well);

        // For now, assume Beanstalk should always use the first pump and given that the Well has been whitelisted, it should be assumed
        // that the first Pump has been verified when the Well was whitelisted.
        Call[] memory pumps = IWell(well).pumps();
        uint[] memory reserves = IInstantaneousPump(pumps[0].target).readInstantaneousReserves(
            well,
            pumps[0].data
        );
        // If the Bean reserve is beneath the minimum balance, the oracle should be considered as off.
        require(
            reserves[beanIndex] >= C.WELL_MINIMUM_BEAN_BALANCE,
            "Silo: Well Bean balance below min"
        );
        Call memory wellFunction = IWell(well).wellFunction();
        uint lpTokenSupplyBefore = IWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );
        reserves[beanIndex] = reserves[beanIndex].sub(BEAN_UNIT); // remove one Bean
        uint deltaLPTokenSupply = lpTokenSupplyBefore.sub(
            IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data)
        );
        _bdv = amount.mul(BEAN_UNIT).div(deltaLPTokenSupply);
    }
}
