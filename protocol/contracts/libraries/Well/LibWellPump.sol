/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Type/LibWellType.sol";
import "./Balance/LibWellBalance.sol";
import "../LibOracle.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib Well Pump
 **/
library LibWellPump {

    using SafeMath for uint256;

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

    function getSellXToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) internal view returns (int256 deltaX) {
        uint256 i = LibWellData.getI(w.tokens, token);
        uint256[] memory ratios = getPegRatio(w, i, pegToken);
        uint128[] memory balances = LibWellBalance.getBalances(w);
        uint256 pegBalance = LibWellType.getXAtRatio(w.data, balances, i, ratios);
        deltaX = int256(pegBalance) - int256(balances[i]);
    }

    function getAddXToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) internal view returns (int256 deltaX) {
        uint256 i = LibWellData.getI(w.tokens, token);
        uint256[] memory ratios = getPegRatio(w, i, pegToken);
        uint128[] memory balances = LibWellBalance.getBalances(w);
        uint128 pegBalance = LibWellType.getXDAtRatio(w.data, balances, i, ratios);
        deltaX = int256(pegBalance) - int256(balances[i]);
    }

    function getRemoveDToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) internal view returns (int256 deltaD) {
        uint256 i = LibWellData.getI(w.tokens, token);
        uint256[] memory ratios = getPegRatio(w, i, pegToken);
        uint128[] memory balances = LibWellBalance.getBalances(w);
        uint256 d1 = LibWellType.getD(w.data, balances);
        balances[i] = LibWellType.getXDAtRatio(w.data, balances, i, ratios);
        deltaD = int256(d1) - int256(LibWellType.getD(w.data, balances));
    }

    function getPegRatio(
        LibWellStorage.WellInfo calldata w,
        uint256 i,
        address pegToken
    ) internal view returns (uint256[] memory ratios) {
        uint256 n = w.tokens.length;
        ratios = new uint256[](2);

        uint8[] memory decimals = LibWellData.getDecimals(w.data);
        for (uint j; j < n; ++j) {
            if (j != i) {
                ratios[j] = LibOracle.getPrice(pegToken, address(w.tokens[j]));
                ratios[j] = ratios[j].mul(10**(decimals[j]));
            }
        }
        ratios[i] = 10**(18+decimals[i]);
    }
}
