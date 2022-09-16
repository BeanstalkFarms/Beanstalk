/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Type/LibWellType.sol";
import "./Balance/LibWellBalance.sol";

/**
 * @author Publius
 * @title Lib Well Oracle
 **/
library LibWellOracle {

    function getInstantLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) internal view returns (uint256 value) {
        value = LibWellType.getdXdD(
            LibWellStorage.wellInfo(wellId).data,
            amount,
            tokenI,
            LibWellBalance.getBalancesFromId(wellId)
        );
    }

    function getLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) internal view returns (uint256 value) {
        value = LibWellType.getdXdD(
            LibWellStorage.wellInfo(wellId).data,
            amount,
            tokenI,
            LibWellBalance.getBalancesFromId(wellId) // TODO: Switch to EMA
        );
    }
}
