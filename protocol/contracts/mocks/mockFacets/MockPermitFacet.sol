/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/PermitFacet.sol";
import "../../libraries/LibPermit.sol";

/**
 * @title Mock Silo Facet
 * @author 0xm00neth
 **/

contract MockPermitFacet is PermitFacet {
    function useNonce(bytes4 selector) external {
        LibPermit.useNonce(selector, msg.sender);
    }
}
