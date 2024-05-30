// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibUnripeConvert} from "./LibUnripeConvert.sol";
import {LibLambdaConvert} from "./LibLambdaConvert.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibWellConvert} from "./LibWellConvert.sol";
import {LibChopConvert} from "./LibChopConvert.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {C} from "contracts/C.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";
import {ConvertCapacity} from "contracts/beanstalk/storage/System.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {GerminationSide} from "contracts/beanstalk/storage/System.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title LibConvert
 * @author Publius
 */
library LibConvert {
    using LibRedundantMath256 for uint256;
    using LibConvertData for bytes;
    using LibWell for address;
    using LibRedundantMathSigned256 for int256;
    using SafeCast for uint256;

    struct AssetsRemovedConvert {
        LibSilo.Removed active;
        uint256[] bdvsRemoved;
        uint256[] stalksRemoved;
        uint256[] depositIds;
    }

    struct DeltaBStorage {
        int256 beforeInputTokenDeltaB;
        int256 afterInputTokenDeltaB;
        int256 beforeOutputTokenDeltaB;
        int256 afterOutputTokenDeltaB;
        int256 beforeOverallDeltaB;
        int256 afterOverallDeltaB;
    }

    struct PenaltyData {
        uint256 inputToken;
        uint256 outputToken;
        uint256 overall;
    }
    struct StalkPenaltyData {
        PenaltyData directionOfPeg;
        PenaltyData againstPeg;
        PenaltyData capacity;
        uint256 higherAmountAgainstPeg;
        uint256 convertCapacityPenalty;
    }

    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    /**
     * @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
     * a specified pool and returns the in and out convert amounts and token addresses and bdv
     * @param convertData Contains convert input parameters for a specified convert
     */
    function convert(
        bytes calldata convertData
    ) external returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        LibConvertData.ConvertKind kind = convertData.convertKind();

        if (kind == LibConvertData.ConvertKind.UNRIPE_BEANS_TO_UNRIPE_LP) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibUnripeConvert.convertBeansToLP(
                convertData
            );
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_LP_TO_UNRIPE_BEANS) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibUnripeConvert.convertLPToBeans(
                convertData
            );
        } else if (kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibLambdaConvert.convert(convertData);
        } else if (kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibWellConvert.convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.WELL_LP_TO_BEANS) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibWellConvert.convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_TO_RIPE) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibChopConvert.convertUnripeToRipe(
                convertData
            );
        } else {
            revert("Convert: Invalid payload");
        }
    }

    function getMaxAmountIn(address tokenIn, address tokenOut) internal view returns (uint256) {
        // Lambda -> Lambda
        if (tokenIn == tokenOut) return type(uint256).max;

        // Bean -> Well LP Token
        if (tokenIn == C.BEAN && tokenOut.isWell()) return LibWellConvert.beansToPeg(tokenOut);

        // Well LP Token -> Bean
        if (tokenIn.isWell() && tokenOut == C.BEAN) return LibWellConvert.lpToPeg(tokenIn);

        // urLP Convert
        if (tokenIn == C.UNRIPE_LP) {
            // UrBEANETH -> urBEAN
            if (tokenOut == C.UNRIPE_BEAN) return LibUnripeConvert.lpToPeg();
            // UrBEANETH -> BEANETH
            if (tokenOut == LibBarnRaise.getBarnRaiseWell()) return type(uint256).max;
        }

        // urBEAN Convert
        if (tokenIn == C.UNRIPE_BEAN) {
            // urBEAN -> urLP
            if (tokenOut == C.UNRIPE_LP) return LibUnripeConvert.beansToPeg();
            // UrBEAN -> BEAN
            if (tokenOut == C.BEAN) return type(uint256).max;
        }

        revert("Convert: Tokens not supported");
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        /// urLP -> urBEAN
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.UNRIPE_BEAN)
            return LibUnripeConvert.getBeanAmountOut(amountIn);

        /// urBEAN -> urLP
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.UNRIPE_LP)
            return LibUnripeConvert.getLPAmountOut(amountIn);

        // Lambda -> Lambda
        if (tokenIn == tokenOut) return amountIn;

        // Bean -> Well LP Token
        if (tokenIn == C.BEAN && tokenOut.isWell())
            return LibWellConvert.getLPAmountOut(tokenOut, amountIn);

        // Well LP Token -> Bean
        if (tokenIn.isWell() && tokenOut == C.BEAN)
            return LibWellConvert.getBeanAmountOut(tokenIn, amountIn);

        // UrBEAN -> Bean
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.BEAN)
            return LibChopConvert.getConvertedUnderlyingOut(tokenIn, amountIn);

        // UrBEANETH -> BEANETH
        if (tokenIn == C.UNRIPE_LP && tokenOut == LibBarnRaise.getBarnRaiseWell())
            return LibChopConvert.getConvertedUnderlyingOut(tokenIn, amountIn);

        revert("Convert: Tokens not supported");
    }

    /**
     * @notice applies the stalk penalty and updates convert capacity.
     */
    function applyStalkPenalty(
        DeltaBStorage memory dbs,
        uint256 bdvConverted,
        uint256 overallConvertCapacity,
        address inputToken,
        address outputToken
    ) internal returns (uint256 stalkPenaltyBdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 overallConvertCapacityUsed;
        uint256 inputTokenAmountUsed;
        uint256 outputTokenAmountUsed;

        (
            stalkPenaltyBdv,
            overallConvertCapacityUsed,
            inputTokenAmountUsed,
            outputTokenAmountUsed
        ) = calculateStalkPenalty(
            dbs,
            bdvConverted,
            overallConvertCapacity,
            inputToken,
            outputToken
        );

        // Update penalties in storage.
        ConvertCapacity storage convertCap = s.sys.convertCapacity[block.number];
        convertCap.overallConvertCapacityUsed = convertCap.overallConvertCapacityUsed.add(
            overallConvertCapacityUsed
        );
        convertCap.wellConvertCapacityUsed[inputToken] = convertCap
            .wellConvertCapacityUsed[inputToken]
            .add(inputTokenAmountUsed);
        convertCap.wellConvertCapacityUsed[outputToken] = convertCap
            .wellConvertCapacityUsed[outputToken]
            .add(outputTokenAmountUsed);
    }

    /**
     * @notice Calculates the percentStalkPenalty for a given convert.
     */
    function calculateStalkPenalty(
        DeltaBStorage memory dbs,
        uint256 bdvConverted,
        uint256 overallConvertCapacity,
        address inputToken,
        address outputToken
    )
        internal
        view
        returns (
            uint256 stalkPenaltyBdv,
            uint256 overallConvertCapacityUsed,
            uint256 inputTokenAmountUsed,
            uint256 outputTokenAmountUsed
        )
    {
        StalkPenaltyData memory spd;

        spd.directionOfPeg = calculateConvertedTowardsPeg(dbs);
        spd.againstPeg = calculateAmountAgainstPeg(dbs);

        spd.higherAmountAgainstPeg = max(
            spd.againstPeg.overall,
            spd.againstPeg.inputToken.add(spd.againstPeg.outputToken)
        );

        (spd.convertCapacityPenalty, spd.capacity) = calculateConvertCapacityPenalty(
            overallConvertCapacity,
            spd.directionOfPeg.overall,
            inputToken,
            spd.directionOfPeg.inputToken,
            outputToken,
            spd.directionOfPeg.outputToken
        );

        // Cap amount of bdv penalized at amount of bdv converted (no penalty should be over 100%)
        stalkPenaltyBdv = min(
            spd.higherAmountAgainstPeg.add(spd.convertCapacityPenalty),
            bdvConverted
        );

        return (
            stalkPenaltyBdv,
            spd.capacity.overall,
            spd.capacity.inputToken,
            spd.capacity.outputToken
        );
    }

    /**
     * @param overallCappedDeltaB The capped overall deltaB for all wells
     * @param overallAmountInDirectionOfPeg The amount deltaB was converted towards peg
     * @param inputToken Address of the input well
     * @param inputTokenAmountInDirectionOfPeg The amount deltaB was converted towards peg for the input well
     * @param outputToken Address of the output well
     * @param outputTokenAmountInDirectionOfPeg The amount deltaB was converted towards peg for the output well
     * @return cumulativePenalty The total Convert Capacity penalty, note it can return greater than the BDV converted
     */
    function calculateConvertCapacityPenalty(
        uint256 overallCappedDeltaB,
        uint256 overallAmountInDirectionOfPeg,
        address inputToken,
        uint256 inputTokenAmountInDirectionOfPeg,
        address outputToken,
        uint256 outputTokenAmountInDirectionOfPeg
    ) internal view returns (uint256 cumulativePenalty, PenaltyData memory pdCapacity) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        ConvertCapacity storage convertCap = s.sys.convertCapacity[block.number];

        // first check overall convert capacity, if none remaining then full penalty for amount in direction of peg
        if (convertCap.overallConvertCapacityUsed >= overallCappedDeltaB) {
            cumulativePenalty = overallAmountInDirectionOfPeg;
        } else if (
            overallAmountInDirectionOfPeg >
            overallCappedDeltaB.sub(convertCap.overallConvertCapacityUsed)
        ) {
            cumulativePenalty =
                overallAmountInDirectionOfPeg -
                overallCappedDeltaB.sub(convertCap.overallConvertCapacityUsed);
        }

        // update overall remaining convert capacity
        pdCapacity.overall = convertCap.overallConvertCapacityUsed.add(
            overallAmountInDirectionOfPeg
        );

        // update per-well convert capacity

        if (inputToken != C.BEAN && inputTokenAmountInDirectionOfPeg > 0) {
            (cumulativePenalty, pdCapacity.inputToken) = calculatePerWellCapacity(
                inputToken,
                inputTokenAmountInDirectionOfPeg,
                cumulativePenalty,
                convertCap,
                pdCapacity.inputToken
            );
        }

        if (outputToken != C.BEAN && outputTokenAmountInDirectionOfPeg > 0) {
            (cumulativePenalty, pdCapacity.outputToken) = calculatePerWellCapacity(
                outputToken,
                outputTokenAmountInDirectionOfPeg,
                cumulativePenalty,
                convertCap,
                pdCapacity.outputToken
            );
        }
    }

    function calculatePerWellCapacity(
        address wellToken,
        uint256 amountInDirectionOfPeg,
        uint256 cumulativePenalty,
        ConvertCapacity storage convertCap,
        uint256 pdCapacityToken
    ) internal view returns (uint256, uint256) {
        uint256 tokenWellCapacity = abs(LibDeltaB.cappedReservesDeltaB(wellToken));
        pdCapacityToken = convertCap.wellConvertCapacityUsed[wellToken].add(amountInDirectionOfPeg);
        if (pdCapacityToken > tokenWellCapacity) {
            cumulativePenalty = cumulativePenalty.add(pdCapacityToken.sub(tokenWellCapacity));
        }

        return (cumulativePenalty, pdCapacityToken);
    }

    /**
     * @notice Performs `calculateAgainstPeg` for the overall, input token, and output token deltaB's.
     */
    function calculateAmountAgainstPeg(
        DeltaBStorage memory dbs
    ) internal pure returns (PenaltyData memory pd) {
        pd.overall = calculateAgainstPeg(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);
        pd.inputToken = calculateAgainstPeg(dbs.beforeInputTokenDeltaB, dbs.afterInputTokenDeltaB);
        pd.outputToken = calculateAgainstPeg(
            dbs.beforeOutputTokenDeltaB,
            dbs.afterOutputTokenDeltaB
        );
    }

    /**
     * @notice Takes before/after deltaB's and calculates how much was converted against peg.
     */
    function calculateAgainstPeg(
        int256 beforeDeltaB,
        int256 afterDeltaB
    ) internal pure returns (uint256 amountAgainstPeg) {
        // Check if the signs of beforeDeltaB and afterDeltaB are different,
        // indicating that deltaB has crossed zero
        if ((beforeDeltaB > 0 && afterDeltaB < 0) || (beforeDeltaB < 0 && afterDeltaB > 0)) {
            amountAgainstPeg = abs(afterDeltaB);
        } else {
            if (
                (afterDeltaB <= 0 && beforeDeltaB <= 0) || (afterDeltaB >= 0 && beforeDeltaB >= 0)
            ) {
                if (abs(beforeDeltaB) < abs(afterDeltaB)) {
                    amountAgainstPeg = abs(afterDeltaB).sub(abs(beforeDeltaB));
                }
            }
        }
    }

    /**
     * @notice Performs `calculateTowardsPeg` for the overall, input token, and output token deltaB's.
     */
    function calculateConvertedTowardsPeg(
        DeltaBStorage memory dbs
    ) internal pure returns (PenaltyData memory pd) {
        pd.overall = calculateTowardsPeg(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);
        pd.inputToken = calculateTowardsPeg(dbs.beforeInputTokenDeltaB, dbs.afterInputTokenDeltaB);
        pd.outputToken = calculateTowardsPeg(
            dbs.beforeOutputTokenDeltaB,
            dbs.afterOutputTokenDeltaB
        );
    }

    /**
     * @notice Takes before/after deltaB's and calculates how much was converted towards, but not past, peg.
     */
    function calculateTowardsPeg(
        int256 beforeTokenDeltaB,
        int256 afterTokenDeltaB
    ) internal pure returns (uint256) {
        // Calculate absolute values of beforeInputTokenDeltaB and afterInputTokenDeltaB using the abs() function
        uint256 beforeDeltaAbs = abs(beforeTokenDeltaB);
        uint256 afterDeltaAbs = abs(afterTokenDeltaB);

        // Check if afterInputTokenDeltaB and beforeInputTokenDeltaB have the same sign
        if (
            (beforeTokenDeltaB >= 0 && afterTokenDeltaB >= 0) ||
            (beforeTokenDeltaB < 0 && afterTokenDeltaB < 0)
        ) {
            // If they have the same sign, compare the absolute values
            if (afterDeltaAbs < beforeDeltaAbs) {
                // Return the difference between beforeDeltaAbs and afterDeltaAbs
                return beforeDeltaAbs.sub(afterDeltaAbs);
            } else {
                // If afterInputTokenDeltaB is further from or equal to zero, return zero
                return 0;
            }
        } else {
            // This means it crossed peg, return how far it went towards peg, which is the abs of input token deltaB
            return beforeDeltaAbs;
        }
    }

    /**
     * @notice removes the deposits from user and returns the
     * grown stalk and bdv removed.
     *
     * @dev if a user inputs a stem of a deposit that is `germinating`,
     * the function will omit that deposit. This is due to the fact that
     * germinating deposits can be manipulated and skip the germination process.
     */
    function _withdrawTokens(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(stems.length == amounts.length, "Convert: stems, amounts are diff lengths.");

        AssetsRemovedConvert memory a;
        uint256 i = 0;
        address user = LibTractor._user();

        // a bracket is included here to avoid the "stack too deep" error.
        {
            a.bdvsRemoved = new uint256[](stems.length);
            a.stalksRemoved = new uint256[](stems.length);
            a.depositIds = new uint256[](stems.length);

            // get germinating stem and stemTip for the token
            LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);

            while ((i < stems.length) && (a.active.tokens < maxTokens)) {
                // skip any stems that are germinating, due to the ability to
                // circumvent the germination process.
                // TODO: expose a view function that let's you pass in stems/amounts and returns the non-germinating stems/amounts?
                if (germStem.germinatingStem <= stems[i]) {
                    i++;
                    continue;
                }

                if (a.active.tokens.add(amounts[i]) >= maxTokens)
                    amounts[i] = maxTokens.sub(a.active.tokens);

                a.bdvsRemoved[i] = LibTokenSilo.removeDepositFromAccount(
                    user,
                    token,
                    stems[i],
                    amounts[i]
                );

                a.stalksRemoved[i] = LibSilo.stalkReward(
                    stems[i],
                    germStem.stemTip,
                    a.bdvsRemoved[i].toUint128()
                );
                a.active.stalk = a.active.stalk.add(a.stalksRemoved[i]);

                a.active.tokens = a.active.tokens.add(amounts[i]);
                a.active.bdv = a.active.bdv.add(a.bdvsRemoved[i]);

                a.depositIds[i] = uint256(LibBytes.packAddressAndStem(token, stems[i]));
                i++;
            }
            for (i; i < stems.length; ++i) amounts[i] = 0;

            emit RemoveDeposits(user, token, stems, amounts, a.active.tokens, a.bdvsRemoved);

            emit LibSilo.TransferBatch(user, user, address(0), a.depositIds, amounts);
        }

        require(a.active.tokens == maxTokens, "Convert: Not enough tokens removed.");
        LibTokenSilo.decrementTotalDeposited(token, a.active.tokens, a.active.bdv);

        // all deposits converted are not germinating.
        LibSilo.burnActiveStalk(
            user,
            a.active.stalk.add(a.active.bdv.mul(s.sys.silo.assetSettings[token].stalkIssuedPerBdv))
        );
        return (a.active.stalk, a.active.bdv);
    }

    function _depositTokensForConvert(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk
    ) internal returns (int96 stem) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        GerminationSide side;

        // calculate the stem and germination state for the new deposit.
        (stem, side) = LibTokenSilo.calculateStemForTokenFromGrownStalk(token, grownStalk, bdv);

        // increment totals based on germination state,
        // as well as issue stalk to the user.
        // if the deposit is germinating, only the initial stalk of the deposit is germinating.
        // the rest is active stalk.
        if (side == GerminationSide.NOT_GERMINATING) {
            LibTokenSilo.incrementTotalDeposited(token, amount, bdv);
            LibSilo.mintActiveStalk(
                LibTractor._user(),
                bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk)
            );
        } else {
            LibTokenSilo.incrementTotalGerminating(token, amount, bdv, side);
            // safeCast not needed as stalk is <= max(uint128)
            LibSilo.mintGerminatingStalk(
                LibTractor._user(),
                uint128(bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token))),
                side
            );
            LibSilo.mintActiveStalk(LibTractor._user(), grownStalk);
        }
        LibTokenSilo.addDepositToAccount(
            LibTractor._user(),
            token,
            stem,
            amount,
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle
        );
    }

    function abs(int256 a) internal pure returns (uint256) {
        return a >= 0 ? uint256(a) : uint256(-a);
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
