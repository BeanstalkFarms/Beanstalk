// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Well/LibWellBuilding.sol";
import "../../libraries/LibDiamond.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Well Building Facet
 **/

enum From {
    EXTERNAL,
    INTERNAL,
    EXTERNAL_INTERNAL,
    INTERNAL_TOLERANT
}
enum To {
    EXTERNAL,
    INTERNAL
}

interface IWell {
    function addLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256[] memory tokenAmounts,
        uint256 minLPAmountOut,
        From fromMode,
        To toMode
    ) external payable returns (uint256 lpAmountOut);
}

struct AddInitialLiquidity {
    uint256[] tokenAmounts;
    uint256 minLPAmountOut;
    From fromMode;
    To toMode;
}

contract WellBuildingFacet is ReentrancyGuard {

    /**
     * Management
    **/

    function buildWell(
        bytes calldata wellFunction,
        IERC20[] calldata tokens,
        string[] calldata symbols,
        uint8[] calldata decimals,
        bytes[] calldata pumps
    ) external payable returns (address wellId) {
        wellId = LibWellBuilding.buildWell(wellFunction, tokens, symbols, decimals, pumps).wellId;
    }

    function modifyWellFunction(
        LibWellStorage.WellInfo calldata p,
        bytes calldata newWellFunction
    ) external payable {
        LibDiamond.enforceIsContractOwner();
        LibWellBuilding.modifyWellFunction(p, newWellFunction);
    }

    function encodeWellDecimalData(
        uint8[] calldata decimals
    ) external pure returns (bytes memory data) {
        return LibWellTokens.encodeDecimalData(decimals);
    }
}