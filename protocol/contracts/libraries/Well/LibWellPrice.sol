/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IInstantaneousPump} from "@wells/interfaces/pumps/IInstantaneousPump.sol";
import {Call, IWell} from "@wells/interfaces/IWell.sol";
import {IWellFunction} from "@wells/interfaces/IWellFunction.sol";

/**=
 * @title LibWellPrice handles fetching the price of ERC-20 tokens in a Well.
 **/

library LibWellPrice {
    using SafeMath for uint256;

    uint constant private BEAN_UNIT = 1e6;

    function bdv(
        address well,
        uint beanIndex,
        uint pumpIndex,
        uint amount
    ) internal view returns (uint _bdv) {
        Call memory pump = IWell(well).pumps()[pumpIndex];
        uint[] memory reserves = IInstantaneousPump(pump.target).readInstantaneousReserves(well, pump.data);
        Call memory wellFunction = IWell(well).wellFunction();
        uint lpTokenSupplyBefore = IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data);
        reserves[beanIndex] = reserves[beanIndex].sub(BEAN_UNIT); // remove one bean
        uint deltaLPTokenSupply = lpTokenSupplyBefore.sub(
            IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data)
        );
        _bdv = amount.mul(BEAN_UNIT).div(deltaLPTokenSupply);
    }
}
