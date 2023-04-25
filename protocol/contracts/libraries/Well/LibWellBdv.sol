/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IInstantaneousPump} from "@wells/interfaces/pumps/IInstantaneousPump.sol";
import {Call, IWell} from "@wells/interfaces/IWell.sol";
import {IWellFunction} from "@wells/interfaces/IWellFunction.sol";
import {LibWell} from "~/libraries/Well/LibWell.sol";

/**
 * @title LibWellBdv handles fetching the bdv of a Well's Well Tokens.
 **/

library LibWellBdv {
    using SafeMath for uint256;

    uint constant private BEAN_UNIT = 1e6;
    bytes constant BYTES_ZERO = new bytes(0);

    function bdv(
        address well,
        uint amount
    ) internal view returns (uint _bdv) {
        uint beanIndex = LibWell.getBeanIndexFromWell(well);

        // For now, assume all Wells use the default Beanstalk Pump. This should be changed if/when a new Beanstalk Pump is deployed.
        uint[] memory reserves = IInstantaneousPump(LibWell.BEANSTALK_PUMP).readInstantaneousReserves(well, BYTES_ZERO);
        Call memory wellFunction = IWell(well).wellFunction();
        uint lpTokenSupplyBefore = IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data);
        reserves[beanIndex] = reserves[beanIndex].sub(BEAN_UNIT); // remove one bean
        uint deltaLPTokenSupply = lpTokenSupplyBefore.sub(
            IWellFunction(wellFunction.target).calcLpTokenSupply(reserves, wellFunction.data)
        );
        _bdv = amount.mul(BEAN_UNIT).div(deltaLPTokenSupply);
    }
}
