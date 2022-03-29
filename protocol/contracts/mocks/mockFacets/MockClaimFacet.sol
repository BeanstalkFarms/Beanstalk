/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/ClaimFacet.sol";
import "../../libraries/LibMarket.sol";
import "../../libraries/LibAppStorage.sol";
import "../MockToken.sol";

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
        LibClaim.claim(c);
        LibMarket.allocateBeans(beansAllocated);
        LibMarket.claimRefund(c);
    }

    function incrementBalanceOfWrappedE(address account, uint256 amount)
        public
        payable
    {
        s.a[account].wrappedBeans += amount;
        MockToken(s.c.bean).mint(address(this), amount);
    }
}
