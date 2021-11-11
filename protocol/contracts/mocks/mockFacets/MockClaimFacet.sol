/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/ClaimFacet.sol";
import "../../libraries/LibMarket.sol";

/**
 * @author Publius
 * @title Mock Claim Facet
**/
contract MockClaimFacet is ClaimFacet {

    function claimWithAllocationE(
        LibClaim.Claim calldata c,
        uint256 beansAllocated
    ) 
        public
        payable
    {
        LibMarket.transferAllocatedBeans(LibClaim.claim(c, true), beansAllocated);
    }

}
