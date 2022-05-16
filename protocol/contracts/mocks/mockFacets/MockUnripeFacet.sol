/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/UnripeFacet.sol";
import "../../libraries/LibAppStorage.sol";

/**
 * @author Publius
 * @title Mock Unripe Facet
**/
contract MockUnripeFacet is UnripeFacet {

    function setMerkleRootE(address unripeToken, bytes32 root) external {
        s.u[unripeToken].merkleRoot = root;
    }
}
