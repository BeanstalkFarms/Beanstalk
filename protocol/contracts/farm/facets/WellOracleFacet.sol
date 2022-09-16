// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Well/LibWellOracle.sol";

/**
 * @author Publius
 * @title Well Oracle Facet
 **/
contract WellOracleFacet {

    function getLPValue(
        address wellId,
        uint256 amount,
        uint256 tokenI
    ) external view returns (uint256 value) {
        value = LibWellOracle.getLPValue(
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
        value = LibWellOracle.getInstantLPValue(
            wellId,
            amount,
            tokenI
        );
    }

    function powu(uint256 x, uint256 y) external pure returns (uint256) {
        return LibPRBMath.powu(x, y);
    }
}
