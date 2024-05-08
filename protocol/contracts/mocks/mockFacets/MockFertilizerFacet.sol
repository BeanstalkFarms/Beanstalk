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
        uint256 minLpOut
    ) external payable {
        LibDiamond.enforceIsContractOwner();
        addFertilizer(id, tokenAmountIn, minLpOut);
    }

    function setPenaltyParams(uint256 recapitalized, uint256 fertilized) external {
        s.recapitalized = recapitalized;
        s.fertilizedIndex = fertilized;
        s.fertilizedPaidIndex = fertilized;
    }

    function setFertilizerE(bool fertilizing, uint256 unfertilized) external {
        s.season.fertilizing = fertilizing;
        s.unfertilizedIndex = unfertilized;
    }

    function setBarnRaiseWell(address well) external {
        s.u[C.UNRIPE_LP].underlyingToken = well;
    }

    function addFertilizer(
        uint128 seasonAdded,
        uint128 tokenAmountIn,
        uint256 minLpOut
    ) public payable {
        uint256 fertilizerAmount = _getMintFertilizerOut(
            tokenAmountIn,
            LibBarnRaise.getBarnRaiseToken()
        );
        LibFertilizer.addFertilizer(seasonAdded, tokenAmountIn, fertilizerAmount, minLpOut);
    }
}
