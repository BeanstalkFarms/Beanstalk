// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibConvert} from "./LibConvert.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibWell} from "../Well/LibWell.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {IPipeline, PipeCall} from "contracts/interfaces/IPipeline.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";

/**
 * @title LibPipelineConvert
 * @author pizzaman1337, Brean
 */
library LibPipelineConvert {
    using LibConvertData for bytes;
    /**
     * @notice contains data for a convert that uses Pipeline.
     */
    struct PipelineConvertData {
        uint256 grownStalk;
        LibConvert.DeltaBStorage deltaB;
        uint256 inputAmount;
        uint256 overallConvertCapacity;
        uint256 stalkPenaltyBdv;
        address user;
        uint256 newBdv;
        uint256[] initialLpSupply;
    }

    function executePipelineConvert(
        address inputToken,
        address outputToken,
        uint256 fromAmount,
        uint256 fromBdv,
        uint256 initialGrownStalk,
        AdvancedFarmCall[] calldata advancedFarmCalls
    ) external returns (uint256 toAmount, uint256 newGrownStalk, uint256 newBdv) {
        PipelineConvertData memory pipeData = LibPipelineConvert.populatePipelineConvertData(
            inputToken,
            outputToken
        );

        // Store the capped overall deltaB, this limits the overall convert power for the block
        pipeData.overallConvertCapacity = LibConvert.abs(LibDeltaB.overallCappedDeltaB());

        IERC20(inputToken).transfer(C.PIPELINE, fromAmount);
        executeAdvancedFarmCalls(advancedFarmCalls);

        // user MUST leave final assets in pipeline, allowing us to verify that the farm has been called successfully.
        // this also let's us know how many assets to attempt to pull out of the final type
        toAmount = transferTokensFromPipeline(outputToken);

        // Calculate stalk penalty using start/finish deltaB of pools, and the capped deltaB is
        // passed in to setup max convert power.
        pipeData.stalkPenaltyBdv = prepareStalkPenaltyCalculation(
            inputToken,
            outputToken,
            pipeData.deltaB,
            pipeData.overallConvertCapacity,
            fromBdv,
            pipeData.initialLpSupply
        );

        // Update grownStalk amount with penalty applied
        newGrownStalk = (initialGrownStalk * (fromBdv - pipeData.stalkPenaltyBdv)) / fromBdv;

        newBdv = LibTokenSilo.beanDenominatedValue(outputToken, toAmount);
    }

    /**
     * @notice Calculates the stalk penalty for a convert. Updates convert capacity used.
     */
    function prepareStalkPenaltyCalculation(
        address inputToken,
        address outputToken,
        LibConvert.DeltaBStorage memory dbs,
        uint256 overallConvertCapacity,
        uint256 fromBdv,
        uint256[] memory initialLpSupply
    ) public returns (uint256) {
        dbs.afterOverallDeltaB = LibDeltaB.scaledOverallCurrentDeltaB(initialLpSupply);

        // modify afterInputTokenDeltaB and afterOutputTokenDeltaB to scale using before/after LP amounts
        if (LibWell.isWell(inputToken)) {
            uint256 i = LibWhitelistedTokens.getIndexFromWhitelistedWellLpTokens(inputToken);
            dbs.afterInputTokenDeltaB = LibDeltaB.scaledDeltaB(
                initialLpSupply[i],
                IERC20(inputToken).totalSupply(),
                LibDeltaB.getCurrentDeltaB(inputToken)
            );
        }

        if (LibWell.isWell(outputToken)) {
            uint256 i = LibWhitelistedTokens.getIndexFromWhitelistedWellLpTokens(outputToken);
            dbs.afterOutputTokenDeltaB = LibDeltaB.scaledDeltaB(
                initialLpSupply[i],
                IERC20(outputToken).totalSupply(),
                LibDeltaB.getCurrentDeltaB(outputToken)
            );
        }

        return
            LibConvert.applyStalkPenalty(
                dbs,
                fromBdv,
                overallConvertCapacity,
                inputToken,
                outputToken
            );
    }

    /**
     * @param calls The advanced farm calls to execute.
     */
    function executeAdvancedFarmCalls(AdvancedFarmCall[] calldata calls) internal {
        bytes[] memory results;
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Convert: empty AdvancedFarmCall");
            results[i] = LibFarm._advancedFarm(calls[i], results);
        }
    }

    /**
     * @notice Determines input token amount left in pipeline and returns to Beanstalk
     * @param tokenOut The token to pull out of pipeline
     */
    function transferTokensFromPipeline(address tokenOut) internal returns (uint256 amountOut) {
        amountOut = IERC20(tokenOut).balanceOf(C.PIPELINE);
        require(amountOut > 0, "Convert: No output tokens left in pipeline");

        PipeCall memory p;
        p.target = address(tokenOut);
        p.data = abi.encodeWithSelector(IERC20.transfer.selector, address(this), amountOut);
        IPipeline(C.PIPELINE).pipe(p);
    }

    function populatePipelineConvertData(
        address fromToken,
        address toToken
    ) internal view returns (PipelineConvertData memory pipeData) {
        pipeData.deltaB.beforeOverallDeltaB = LibDeltaB.overallCurrentDeltaB();
        pipeData.deltaB.beforeInputTokenDeltaB = LibDeltaB.getCurrentDeltaB(fromToken);
        pipeData.deltaB.beforeOutputTokenDeltaB = LibDeltaB.getCurrentDeltaB(toToken);
        pipeData.initialLpSupply = LibDeltaB.getLpSupply();
    }

    /**
     * @notice Determines the convert state and populates pipeline data if necessary
     */
    function getConvertState(
        bytes calldata convertData
    ) public view returns (PipelineConvertData memory pipeData) {
        LibConvertData.ConvertKind kind = convertData.convertKind();
        address toToken;
        address fromToken;
        if (
            kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP ||
            kind == LibConvertData.ConvertKind.WELL_LP_TO_BEANS
        ) {
            if (kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP) {
                (, , toToken) = convertData.convertWithAddress();
                fromToken = C.BEAN;
                require(LibWell.isWell(toToken), "Convert: Invalid Well");
            } else {
                (, , fromToken) = convertData.convertWithAddress();
                toToken = C.BEAN;
                require(LibWell.isWell(fromToken), "Convert: Invalid Well");
            }

            pipeData = populatePipelineConvertData(fromToken, toToken);
        }
    }

    /**
     * @notice reverts if the convert would be penalized.
     * @dev used in {ConvertFacet.convert}
     */
    function checkForValidConvertAndUpdateConvertCapacity(
        PipelineConvertData memory pipeData,
        bytes calldata convertData,
        address fromToken,
        address toToken,
        uint256 fromBdv
    ) public {
        LibConvertData.ConvertKind kind = convertData.convertKind();
        if (
            kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP ||
            kind == LibConvertData.ConvertKind.WELL_LP_TO_BEANS
        ) {
            pipeData.overallConvertCapacity = LibConvert.abs(LibDeltaB.overallCappedDeltaB());

            pipeData.stalkPenaltyBdv = prepareStalkPenaltyCalculation(
                fromToken,
                toToken,
                pipeData.deltaB,
                pipeData.overallConvertCapacity,
                fromBdv,
                pipeData.initialLpSupply
            );

            require(
                pipeData.stalkPenaltyBdv == 0,
                "Convert: Penalty would be applied to this convert, use pipeline convert"
            );
        }
    }
}
