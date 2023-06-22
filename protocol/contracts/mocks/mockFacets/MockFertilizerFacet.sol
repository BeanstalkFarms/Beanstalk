/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/beanstalk/barn/FertilizerFacet.sol";

/**
 * @author Publius
 * @title Mock Fertilizer Facet
**/

contract MockFertilizerFacet is FertilizerFacet {

    function setPenaltyParams(uint256 recapitalized, uint256 fertilized) external {
        s.recapitalized = recapitalized;
        s.fertilizedIndex = fertilized;
    }

    function setFertilizerE(bool fertilizing, uint256 unfertilized) external {
        s.season.fertilizing = fertilizing;
        s.unfertilizedIndex = unfertilized;
    }
}