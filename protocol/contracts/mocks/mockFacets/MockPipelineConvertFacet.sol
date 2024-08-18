/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "../../beanstalk/silo/PipelineConvertFacet.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LibConvert} from "../../libraries/Convert/LibConvert.sol";
import {LibTractor} from "../../libraries/LibTractor.sol";
import {LibConvert} from "../../libraries/Convert/LibConvert.sol";

/**
 * @author pizzaman1337
 * @title Mock Pipeline Convert Facet
 **/
contract MockPipelineConvertFacet is PipelineConvertFacet {
    function calculateConvertCapacityPenaltyE(
        uint256 overallCappedDeltaB,
        uint256 overallAmountInDirectionOfPeg,
        address inputToken,
        uint256 inputTokenAmountInDirectionOfPeg,
        address outputToken,
        uint256 outputTokenAmountInDirectionOfPeg
    ) external view returns (uint256 cumulativePenalty, LibConvert.PenaltyData memory pdCapacity) {
        (cumulativePenalty, pdCapacity) = LibConvert.calculateConvertCapacityPenalty(
            overallCappedDeltaB,
            overallAmountInDirectionOfPeg,
            inputToken,
            inputTokenAmountInDirectionOfPeg,
            outputToken,
            outputTokenAmountInDirectionOfPeg
        );
    }

    function calculateDeltaBFromReservesE(
        address well,
        uint256[] memory reserves,
        uint256 lookback
    ) external view returns (int256) {
        return LibDeltaB.calculateDeltaBFromReserves(well, reserves, lookback);
    }
}
