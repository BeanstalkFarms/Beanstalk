/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
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

    function updateSilo(address account) internal {
        DiamondStorage storage ds = diamondStorage();
        bytes4 functionSelector = bytes4(keccak256("updateSilo(address)"));
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(functionSelector, account);
        (bool success,) = address(facet).delegatecall(myFunctionCall);
        require(success, "Silo: updateSilo failed.");
    }
}
