/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/NonceFacet.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
 **/

contract MockNonceFacet is NonceFacet {
    function useNonce() external {
        _useNonce(msg.sender);
    }
}
