/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../AppStorage.sol';
import '../../../interfaces/IWETH.sol';
import '../../../libraries/LibUserBalance.sol';

import 'hardhat/console.sol';

/**
 * @author Beasley
 * @title Users call any function in Beanstalk
**/

contract FarmFacet {

    /*
     * Diamond Position
    */

    AppStorage internal s;

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

    /* 
     * Farm Function
    */


   // We distinguish payable and non-payable delegatecalls because a delegatecall with msg.value cannot be performed with a non-payable function
    function farm(bytes calldata data) public payable {
	DiamondStorage storage ds = diamondStorage();
	bytes4 functionSelector;
	assembly {
		functionSelector := calldataload(data.offset)
	}
	address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
	(bool success,) = address(facet).delegatecall(data);
	require(success, "FarmFacet: Function call failed!");
    }

    function chainFarm(bytes[] calldata data) public payable {
	for(uint256 i = 0; i < data.length; i++) {
		farm(data[i]);
	}
    }
}
