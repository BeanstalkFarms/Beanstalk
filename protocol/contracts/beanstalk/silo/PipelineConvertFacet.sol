/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {AdvancedFarmCall} from "../../libraries/LibFarm.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibPipelineConvert} from "contracts/libraries/Convert/LibPipelineConvert.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";

/**
 * @author Publius, Brean, DeadManWalking, pizzaman1337, funderberker
 * @title PipelineConvertFacet handles converting Deposited assets within the Silo,
 * using pipeline.
 * @dev `pipelineConvert` uses a series of pipeline calls to convert assets.
 **/
contract PipelineConvertFacet is Invariable, ReentrancyGuard {
    using LibRedundantMathSigned256 for int256;
    using SafeCast for uint256;
    using LibConvertData for bytes;
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;
    using LibRedundantMath32 for uint32;

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

    /**
     * @notice Pipeline convert allows any type of convert using a series of
     * pipeline calls. A stalk penalty may be applied if the convert crosses deltaB.
     *
     * @param inputToken The token to convert from.
     * @param stems The stems of the deposits to convert from.
     * @param amounts The amounts of the deposits to convert from.
     * @param outputToken The token to convert to.
     * @param advancedFarmCalls The farm calls to execute.
     * @return toStem the new stems of the converted deposit
     * @return fromAmount the amount of tokens converted from
     * @return toAmount the amount of tokens converted to
     * @return fromBdv the bdv of the deposits converted from
     * @return toBdv the bdv of the deposit converted to
     */
    function pipelineConvert(
        address inputToken,
        int96[] calldata stems,
        uint256[] calldata amounts,
        address outputToken,
        AdvancedFarmCall[] calldata advancedFarmCalls
    )
        external
        payable
        fundsSafu
        nonReentrant
        returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {
        // require that input and output tokens be wells (Unripe not supported)
        require(
            LibWell.isWell(inputToken) || inputToken == C.BEAN,
            "Convert: Input token must be Bean or a well"
        );
        require(
            LibWell.isWell(outputToken) || outputToken == C.BEAN,
            "Convert: Output token must be Bean or a well"
        );

        // mow input and output tokens:
        LibSilo._mow(LibTractor._user(), inputToken);
        LibSilo._mow(LibTractor._user(), outputToken);

        // Calculate the maximum amount of tokens to withdraw
        for (uint256 i = 0; i < stems.length; i++) {
            fromAmount = fromAmount.add(amounts[i]);
        }

        // withdraw tokens from deposits and calculate the total grown stalk and bdv.
        uint256 grownStalk;
        (grownStalk, fromBdv) = LibConvert._withdrawTokens(inputToken, stems, amounts, fromAmount);

        (toAmount, grownStalk, toBdv) = LibPipelineConvert.executePipelineConvert(
            inputToken,
            outputToken,
            fromAmount,
            fromBdv,
            grownStalk,
            advancedFarmCalls
        );

        toStem = LibConvert._depositTokensForConvert(outputToken, toAmount, toBdv, grownStalk);

        emit Convert(LibTractor._user(), inputToken, outputToken, fromAmount, toAmount);
    }
}
