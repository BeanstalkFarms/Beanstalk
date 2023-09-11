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

    function addFertilizerOwner(
        uint128 id,
        uint128 wethAmountIn,
        uint256 minLPOut
    ) external payable {
        LibDiamond.enforceIsContractOwner();
        IERC20(C.WETH).transferFrom(
            msg.sender,
            C.BEAN_ETH_WELL,
            uint256(wethAmountIn)
        );

        uint256 fertilizerAmount = getMintFertilizerOut(wethAmountIn);

        LibFertilizer.addFertilizer(id, fertilizerAmount, minLPOut);
    }

    function setPenaltyParams(uint256 recapitalized, uint256 fertilized) external {
        s.recapitalized = recapitalized;
        s.fertilizedIndex = fertilized;
    }

    function setFertilizerE(bool fertilizing, uint256 unfertilized) external {
        s.season.fertilizing = fertilizing;
        s.unfertilizedIndex = unfertilized;
    }
}