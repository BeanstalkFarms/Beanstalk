/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/PermitFacet.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
 **/

contract MockPermitFacet is PermitFacet {
    function useNonce() external {
        _useNonce(msg.sender);
    }
}
