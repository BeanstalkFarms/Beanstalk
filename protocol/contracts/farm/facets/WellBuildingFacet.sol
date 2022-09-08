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
contract WellBuildingFacet is ReentrancyGuard {

    /**
     * Management
    **/

    function buildWell(
        IERC20[] calldata tokens,
        LibWellType.WellType wellType,
        bytes calldata typeData,
        string[] calldata symbols
    ) external returns (address wellId) {
        wellId = LibWellBuilding.buildWell(tokens, wellType, typeData, symbols);
    }

    function modifyWell(
         LibWellStorage.WellInfo calldata p,
         LibWellType.WellType newWellType,
        bytes calldata newTypeData
    ) external {
        LibDiamond.enforceIsContractOwner();
        LibWellBuilding.modifyWell(p, newWellType, newTypeData);
    }

    function getWellTypeSignature(
        LibWellType.WellType wellType
    ) external pure returns (string[] memory signature) {
        signature = LibWellType.getSignature(wellType);
    }

    function isWellTypeRegistered(
        LibWellType.WellType wellType
    ) external view returns (bool registered) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage(); 
        registered = s.registered[wellType];
    }
}