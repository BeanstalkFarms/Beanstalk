// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/******************************************************************************\
* Authors: Nick Mudge (https://twitter.com/mudgen)
*
* Implementation of a diamond.
/******************************************************************************/

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {DiamondCutFacet} from "./diamond/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "./diamond/DiamondLoupeFacet.sol";
import {OwnershipFacet} from "./diamond/OwnershipFacet.sol";
import {AppStorage} from "./AppStorage.sol";
import {IERC165} from "../interfaces/IERC165.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";

contract Diamond {
    AppStorage internal s;

    receive() external payable {}

    constructor(address _contractOwner) {
        LibDiamond.setContractOwner(_contractOwner);
        LibDiamond.addDiamondFunctions(
            address(new DiamondCutFacet()),
            address(new DiamondLoupeFacet())
        );
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }
}
