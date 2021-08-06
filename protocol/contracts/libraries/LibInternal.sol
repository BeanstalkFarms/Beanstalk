/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Internal Library handles gas efficient function calls between facets.
**/
library LibInternal {

    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    struct FacetAddressAndPosition {
        address facetAddress;
        uint16 functionSelectorPosition; // position in facetFunctionSelectors.functionSelectors array
    }

    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint16 facetAddressPosition; // position of facetAddress in facetAddresses array
    }

    struct DiamondStorage {
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        address[] facetAddresses;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    struct Claim {
        uint32[] beanWithdrawals;
        uint32[] lpWithdrawals;
        uint256[] plots;
        bool claimEth;
        bool convertLP;
        uint256 minBeanAmount;
        uint256 minEthAmount;
    }

    function updateSilo(address account) internal {
        DiamondStorage storage ds = diamondStorage();
        bytes4 functionSelector = bytes4(keccak256("updateSilo(address)"));
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(functionSelector, account);
        (bool success,) = address(facet).delegatecall(myFunctionCall);
        require(success, "Silo: updateSilo failed.");
    }

    function updateBip(uint32 bip) internal {
        DiamondStorage storage ds = diamondStorage();
        bytes4 functionSelector = bytes4(keccak256("updateBip(uint32)"));
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(functionSelector, bip);
        (bool success,) = address(facet).delegatecall(myFunctionCall);
        require(success, "Silo: updateBip failed.");
    }

    function stalkFor(uint32 bip) internal returns (uint256) {
        DiamondStorage storage ds = diamondStorage();
        bytes4 functionSelector = bytes4(keccak256("stalkFor(uint32)"));
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(functionSelector, bip);
        (bool success, bytes memory data) = address(facet).delegatecall(myFunctionCall);
        require(success, "Governance: stalkFor failed.");
        uint stalk;
        assembly { stalk := mload(add(data, add(0x20, 0))) }
        return stalk;
    }

    function claim(Claim calldata c) internal {
        DiamondStorage storage ds = diamondStorage();
        bytes4 functionSelector = bytes4(keccak256("claim((uint32[],uint32[],uint256[],bool,bool,uint256,uint256))"));
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(functionSelector, c);
        (bool success,) = address(facet).delegatecall(myFunctionCall);
        require(success, "Claim: claim failed.");
    }

}
