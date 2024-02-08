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
        uint128 tokenAmountIn,
        uint256 minLPOut
    ) external payable {
        LibDiamond.enforceIsContractOwner();
        // Transfer the WSTETH directly to the Well for gas efficiency purposes. The WSTETH is later synced in {LibFertilizer.addUnderlying}.
        IERC20(C.BARN_RAISE_TOKEN).transferFrom(
            msg.sender,
            C.BARN_RAISE_WELL,
            uint256(tokenAmountIn)
        );

        uint256 fertilizerAmount = getMintFertilizerOut(tokenAmountIn);

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