// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibConvert} from "./LibConvert.sol";
import {LibWellMinting} from "../Minting/LibWellMinting.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibWell} from "../Well/LibWell.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {IPipeline, PipeCall} from "contracts/interfaces/IPipeline.sol";

/**
 * @title LibPipelineConvert
 * @author pizzaman1337, Brean
 */
library LibPipelineConvert {
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
    ) internal returns (uint256) {
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
}
