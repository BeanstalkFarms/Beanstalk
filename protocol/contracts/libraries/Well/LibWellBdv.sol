/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IInstantaneousPump} from "contracts/interfaces/basin/pumps/IInstantaneousPump.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {IWellFunction} from "contracts/interfaces/basin/IWellFunction.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";

/**
 * @title Well Bdv Library contains a function to calulate
 * the BDV of a given Well LP Token
 **/

library LibWellBdv {
    using SafeMath for uint256;

    uint constant private BEAN_UNIT = 1e6;

    // A constant representing a bytes variable with a length of 0.
    bytes constant BYTES_ZERO = new bytes(0);

    /**
     * @dev Calculates the `_bdv` of a given Well LP Token given a relevant
     * `well` and `amount` value by computing the delta LP token supply given a small change in the Bean reserve balance.
     */
    function bdv(
        address well,
        uint amount
    ) internal view returns (uint _bdv) {
        uint beanIndex = LibWell.getBeanIndexFromWell(well);

        // For now, assume all Wells use the default Beanstalk Pump. This should be changed if/when a new Beanstalk Pump is deployed.
        uint[] memory reserves = IInstantaneousPump(LibWell.BEANSTALK_PUMP).readInstantaneousReserves(well, BYTES_ZERO);
        Call memory wellFunction = IWell(well).wellFunction();
        uint lpTokenSupplyBefore = IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data);
        reserves[beanIndex] = reserves[beanIndex].sub(BEAN_UNIT); // remove one Bean
        uint deltaLPTokenSupply = lpTokenSupplyBefore.sub(
            IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data)
        );
        _bdv = amount.mul(BEAN_UNIT).div(deltaLPTokenSupply);
    }
}
