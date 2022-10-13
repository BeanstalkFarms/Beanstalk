// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Well/LibWellPump.sol";

/**
 * @author Publius
 * @title Well Pump Facet
 **/
contract WellPumpFacet {

    function getLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) external view returns (uint256 value) {
        value = LibWellPump.getLPValue(
            wellId,
            amount,
            tokenI
        );
    }

    function getInstantLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) external view returns (uint256 value) {
        value = LibWellPump.getInstantLPValue(
            wellId,
            amount,
            tokenI
        );
    }

    function getSellXToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) external view returns (int256 deltaX) {
        deltaX = LibWellPump.getSellXToPeg(w, token, pegToken);
    }

    function getAddXToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) external view returns (int256 deltaX) {
        deltaX = LibWellPump.getAddXToPeg(w, token, pegToken);
    }

    function getRemoveDToPeg(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) external view returns (int256 deltaX) {
        deltaX = LibWellPump.getRemoveDToPeg(w, token, pegToken);
    }

    function getPegRatio(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        address pegToken
    ) external view returns (uint256[] memory ratios) {
        uint256 i = LibWellData.getI(w.tokens, token);
        ratios = LibWellPump.getPegRatio(w, i, pegToken);
    }

    function powu(uint256 x, uint256 y) external pure returns (uint256) {
        return LibPRBMath.powu(x, y);
    }

    function getXDAtRatio(
        uint128[] memory xs,
        uint256 i,
        uint256[] memory ratios
    ) external view returns (uint256 x) {
        return LibConstantProductWell.getXDAtRatio(xs, i, ratios);
    }
}
