/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/ClaimFacet.sol";
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
        LibUserBalance.allocatedBeans(beansAllocated);
    }

    function incrementBalanceOfWrappedE(address account, uint256 amount)
        public
        payable
    {
        s.internalTokenBalance[account][IBean(s.c.bean)] += amount;
        MockToken(s.c.bean).mint(address(this), amount);
    }

    function legacyClaim(address account) public view returns (uint256) {
	return s.a[account].wrappedBeans;
    }
}
