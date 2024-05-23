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
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {AdvancedFarmCall} from "../../libraries/LibFarm.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibPipelineConvert} from "contracts/libraries/Convert/LibPipelineConvert.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";

/**
 * @author Publius, Brean, DeadManWalking, pizzaman1337, funderberker
 * @title ConvertFacet handles converting Deposited assets within the Silo.
 **/
contract ConvertFacet is Invariable, ReentrancyGuard {
    using LibRedundantMathSigned256 for int256;
    using SafeCast for uint256;
    using LibConvertData for bytes;
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;
    using LibRedundantMath32 for uint32;

    struct AssetsRemovedConvert {
        LibSilo.Removed active;
        uint256[] bdvsRemoved;
        uint256[] stalksRemoved;
        uint256[] depositIds;
    }

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );

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
     * @notice convert allows a user to convert a deposit to another deposit,
     * given that the conversion is supported by the ConvertFacet.
     * For example, a user can convert LP into Bean, only when beanstalk is below peg,
     * or convert beans into LP, only when beanstalk is above peg.
     * @param convertData  input parameters to determine the conversion type.
     * @param stems the stems of the deposits to convert
     * @param amounts the amounts within each deposit to convert
     * @return toStem the new stems of the converted deposit
     * @return fromAmount the amount of tokens converted from
     * @return toAmount the amount of tokens converted to
     * @return fromBdv the bdv of the deposits converted from
     * @return toBdv the bdv of the deposit converted to
     */
    function convert(
        bytes calldata convertData,
        int96[] memory stems,
        uint256[] memory amounts
    )
        external
        payable
        fundsSafu
        noSupplyChange
        // TODO: add oneOutFlow(tokenIn) when pipelineConvert merges.
        nonReentrant
        returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {
        address toToken;
        address fromToken;

        // if the convert is a well <> bean convert, cache the state to validate convert.
        LibPipelineConvert.PipelineConvertData memory pipeData = LibPipelineConvert.getConvertState(
            convertData
        );

        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(convertData);

        require(fromAmount > 0, "Convert: From amount is 0.");

        LibSilo._mow(LibTractor._user(), fromToken);
        LibSilo._mow(LibTractor._user(), toToken);

        (pipeData.grownStalk, fromBdv) = _withdrawTokens(fromToken, stems, amounts, fromAmount);

        // check for potential penalty
        LibPipelineConvert.checkForValidConvertAndUpdateConvertCapacity(
            pipeData,
            convertData,
            fromToken,
            toToken,
            fromBdv
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toStem = _depositTokensForConvert(toToken, toAmount, toBdv, pipeData.grownStalk);

        emit Convert(LibTractor._user(), fromToken, toToken, fromAmount, toAmount);
    }

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

        LibPipelineConvert.PipelineConvertData memory pipeData = LibPipelineConvert
            .populatePipelineConvertData(inputToken, outputToken);

        pipeData.user = LibTractor._user();

        // mow input and output tokens:
        LibSilo._mow(pipeData.user, inputToken);
        LibSilo._mow(pipeData.user, outputToken);

        // Calculate the maximum amount of tokens to withdraw
        for (uint256 i = 0; i < stems.length; i++) {
            fromAmount = fromAmount.add(amounts[i]);
        }

        // withdraw tokens from deposits and calculate the total grown stalk and bdv.
        (pipeData.grownStalk, fromBdv) = _withdrawTokens(inputToken, stems, amounts, fromAmount);

        // Store the capped overall deltaB, this limits the overall convert power for the block
        pipeData.overallConvertCapacity = LibConvert.abs(LibDeltaB.overallCappedDeltaB());

        IERC20(inputToken).transfer(C.PIPELINE, fromAmount);
        LibPipelineConvert.executeAdvancedFarmCalls(advancedFarmCalls);

        // user MUST leave final assets in pipeline, allowing us to verify that the farm has been called successfully.
        // this also let's us know how many assets to attempt to pull out of the final type
        toAmount = LibPipelineConvert.transferTokensFromPipeline(outputToken);

        // Calculate stalk penalty using start/finish deltaB of pools, and the capped deltaB is
        // passed in to setup max convert power.
        pipeData.stalkPenaltyBdv = LibPipelineConvert.prepareStalkPenaltyCalculation(
            inputToken,
            outputToken,
            pipeData.deltaB,
            pipeData.overallConvertCapacity,
            fromBdv,
            pipeData.initialLpSupply
        );

        // Update grownStalk amount with penalty applied
        pipeData.grownStalk =
            (pipeData.grownStalk * (fromBdv - pipeData.stalkPenaltyBdv)) /
            fromBdv;

        pipeData.newBdv = LibTokenSilo.beanDenominatedValue(outputToken, toAmount);

        toStem = _depositTokensForConvert(
            outputToken,
            toAmount,
            pipeData.newBdv,
            pipeData.grownStalk
        );
        toBdv = pipeData.newBdv;

        emit Convert(pipeData.user, inputToken, outputToken, fromAmount, toAmount);
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
            a.active.stalk.add(a.active.bdv.mul(s.ss[token].stalkIssuedPerBdv))
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

        LibGerminate.Germinate germ;

        // calculate the stem and germination state for the new deposit.
        (stem, germ) = LibTokenSilo.calculateStemForTokenFromGrownStalk(token, grownStalk, bdv);

        // increment totals based on germination state,
        // as well as issue stalk to the user.
        // if the deposit is germinating, only the inital stalk of the deposit is germinating.
        // the rest is active stalk.
        if (germ == LibGerminate.Germinate.NOT_GERMINATING) {
            LibTokenSilo.incrementTotalDeposited(token, amount, bdv);
            LibSilo.mintActiveStalk(
                LibTractor._user(),
                bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk)
            );
        } else {
            LibTokenSilo.incrementTotalGerminating(token, amount, bdv, germ);
            // safeCast not needed as stalk is <= max(uint128)
            LibSilo.mintGerminatingStalk(
                LibTractor._user(),
                uint128(bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token))),
                germ
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
}
