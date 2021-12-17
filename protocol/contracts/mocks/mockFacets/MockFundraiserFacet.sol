/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/FundraiserFacet.sol";

/**
 * @author Publius
 * @title Mock Fundraiser Facet
**/

interface IBS {
    function createFundraiser(address fundraiser, address token, uint256 amount) external;
}

contract MockFundraiserFacet is FundraiserFacet {

    function createFundraiserE(address fundraiser, address token, uint256 amount) external {
        IBS(address(this)).createFundraiser(fundraiser, token, amount);
    }

    function deleteFundraiser(uint32 id) external {
        delete s.fundraisers[id];
    }
}
