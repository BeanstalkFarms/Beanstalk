/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibWellMinting} from "../../libraries/Minting/LibWellMinting.sol";
import {IPipeline, PipeCall} from "contracts/interfaces/IPipeline.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibFunction} from "contracts/libraries/LibFunction.sol";

import "forge-std/console.sol";

interface IBeanstalk {
    function bdv(address token, uint256 amount) external view returns (uint256);
    function poolDeltaB(address pool) external view returns (int256);
}
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";



/**
 * @author Publius, Brean, DeadManWalking, pizzaman1337, funderberker
 * @title ConvertFacet handles converting Deposited assets within the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;
    address internal constant PIPELINE = 0xb1bE0000C6B3C62749b5F0c92480146452D15423; //import this from C.sol?
    IBeanstalk private constant BEANSTALK = IBeanstalk(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);

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


    struct AssetsRemovedConvert {
        LibSilo.Removed active;
        uint256 tokensRemoved;
        // uint256 stalkRemoved;
        // uint256 bdvRemoved;
        uint256[] bdvsRemoved;
        uint256[] stalksRemoved;
        uint256[] depositIds;
    }

    struct MultiCrateDepositData {
        uint256 amountPerBdv;
        uint256 totalAmount;
        uint256 crateAmount;
        uint256 depositedBdv;
        int96 stem;
        LibGerminate.Germinate germ;
    }

    struct PipelineConvertData {
        uint256[] bdvsRemoved;
        uint256[] grownStalks;
        int256 startingDeltaB;
        uint256 amountOut;
        uint256 percentStalkPenalty; // 0 means no penalty, 1 means 100% penalty
        int256 cappedDeltaB;
        uint256 stalkPenaltyBdv;
    }

    // TODO: when we updated to Solidity 0.8, use the native abs function
    // the verson of OpenZeppelin we're on does not support abs
    function abs(int256 a) internal pure returns (uint256) {
        return a >= 0 ? uint256(a) : uint256(-a);
    }

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
        nonReentrant
        returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {
        LibTractor._setPublisher(msg.sender);

        address toToken; address fromToken; uint256 grownStalk;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(convertData);

        require(fromAmount > 0, "Convert: From amount is 0.");

        LibSilo._mow(LibTractor._getUser(), fromToken);
        LibSilo._mow(LibTractor._getUser(), toToken);

        (grownStalk, fromBdv, ,) = _withdrawTokens(
            fromToken,
            stems,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toStem = _depositTokensForConvert(toToken, toAmount, toBdv, grownStalk);

        emit Convert(LibTractor._getUser(), fromToken, toToken, fromAmount, toAmount);

        LibTractor._resetPublisher();
    }


    /**
     * @notice Pipeline convert allows any type of convert using a series of
     * pipeline calls. A stalk penalty may be applied if the convert crosses deltaB.
     * 
     * @param inputToken The token to convert from.
     * @param stems The stems of the deposits to convert from.
     * @param amounts The amounts of the deposits to convert from.
     * @param outputToken The token to convert to.
     * @param farmCalls The farm calls to execute.
     * @return outputStems The resulting stems of the converted deposits
     * @return outputAmounts The resulting amounts of the converted deposits
     */

    function pipelineConvert(
        address inputToken,
        int96[] calldata stems,
        uint256[] calldata amounts,
        address outputToken,
        AdvancedFarmCall[] calldata farmCalls
    )
        external
        payable
        nonReentrant
        returns (int96[] memory outputStems, uint256[] memory outputAmounts)
    {   
        // Setup Tractor publisher to support Tractor blueprints
        LibTractor._setPublisher(msg.sender);


        // mow input and output tokens: 
        LibSilo._mow(LibTractor._getUser(), inputToken);
        LibSilo._mow(LibTractor._getUser(), outputToken);
        
        // Calculate the maximum amount of tokens to withdraw
        uint256 maxTokens = 0;
        for (uint256 i = 0; i < stems.length; i++) {
            maxTokens = maxTokens.add(amounts[i]);
        }

        PipelineConvertData memory pipeData;

        ( , , pipeData.bdvsRemoved, pipeData.grownStalks) = _withdrawTokens(
            inputToken,
            stems,
            amounts,
            maxTokens
        );

        pipeData.startingDeltaB = getCombinedDeltaBForTokens(inputToken, outputToken);

        IERC20(inputToken).transfer(PIPELINE, maxTokens);
        pipeData.amountOut = executeAdvancedFarmCalls(farmCalls);

        console.log('amountOut after pipe calls: ', pipeData.amountOut);
        
        // user MUST leave final assets in pipeline, allowing us to verify that the farm has been called successfully.
        // this also let's us know how many assets to attempt to pull out of the final type
        transferTokensFromPipeline(outputToken, pipeData.amountOut);

        console.log('transfered tokens from pipeline');

        // We want the capped deltaB from all the wells, this is what sets up/limits the overall convert power for the block
        // Converts that either cross peg, OR occur when convert power has been exhausted, will be stalk penalized
        pipeData.cappedDeltaB = LibWellMinting.overallDeltaB();
        console.log('final cappedDeltaB: ');
        console.logInt(pipeData.cappedDeltaB);

        // Calculate stalk penalty using start/finish deltaB of pools, and the capped deltaB is
        // passed in the setup max convert power.
        pipeData.stalkPenaltyBdv = _calculateStalkPenalty(pipeData.startingDeltaB, getCombinedDeltaBForTokens(inputToken, outputToken), pipeData.bdvsRemoved, abs(pipeData.cappedDeltaB));
        console.log('stalkPenaltyBdv: ', pipeData.stalkPenaltyBdv);
        
        // Apply the calculated penalty to the grown stalks array
        pipeData.grownStalks = _applyPenaltyToGrownStalks(pipeData.stalkPenaltyBdv, pipeData.bdvsRemoved, pipeData.grownStalks);

        // Deposit new crates, Convert event emitted within this function
        (outputStems, outputAmounts) = _depositTokensForConvertMultiCrate(inputToken, outputToken, pipeData.amountOut, pipeData.bdvsRemoved, pipeData.grownStalks, amounts);

        // End of convert function, reset Tractor publisher
        LibTractor._resetPublisher();
    }

    function cappedReservesDeltaB(address well) public view 
        returns (int256 deltaB, uint256[] memory instReserves, uint256[] memory ratios) {
        (deltaB, instReserves, ratios) = LibWellMinting.cappedReservesDeltaB(well);
    }

    function applyPenaltyToGrownStalks(uint256 penaltyBdv, uint256[] memory bdvsRemoved, uint256[] memory grownStalks)
        external view returns (uint256[] memory) {
        return _applyPenaltyToGrownStalks(penaltyBdv, bdvsRemoved, grownStalks);
    }

    function _applyPenaltyToGrownStalks(uint256 stalkPenaltyBdv, uint256[] memory bdvsRemoved, uint256[] memory grownStalks)
        internal view returns (uint256[] memory) {

            console.log('_applyPenaltyToGrownStalks bdvsRemoved.length: ', bdvsRemoved.length);

        for (uint256 i = bdvsRemoved.length; i != 0; i--) { // this i!=0 feels weird to me somehow, but appears to be necessary
            console.log('_applyPenaltyToGrownStalks i: ', i-1);
            console.log('_applyPenaltyToGrownStalks bdvsRemoved[i]: ', bdvsRemoved[i-1]);

            uint256 bdvRemoved = bdvsRemoved[i-1];
            uint256 grownStalk = grownStalks[i-1];

            if (stalkPenaltyBdv >= bdvRemoved) {
                stalkPenaltyBdv -= bdvRemoved;
                grownStalks[i-1] = 0;
            } else {
                uint256 penaltyPercentage = stalkPenaltyBdv.mul(1e16).div(bdvRemoved);
                grownStalks[i-1] = grownStalk.sub(grownStalk.mul(penaltyPercentage).div(1e16));
                stalkPenaltyBdv = 0;
            }
            if (stalkPenaltyBdv == 0) {
                break;
            }
        }
        return grownStalks;
    }

    function calculateStalkPenalty(int256 beforeDeltaB, int256 afterDeltaB, uint256[] memory bdvsRemoved, uint256 cappedDeltaB)
        external returns (uint256) {
        return _calculateStalkPenalty(beforeDeltaB, afterDeltaB, bdvsRemoved, cappedDeltaB);
    }

    /**
     * @notice Calculates the percentStalkPenalty for a given convert.
     * @dev The percentStalkPenalty is the amount of Stalk that is lost as a result of converting against
     * or past peg.
     * @param beforeDeltaB The deltaB before the deposit.
     * @param afterDeltaB The deltaB after the deposit.
     * @param bdvsRemoved The amount of BDVs that were removed, will be summed in this function.
     * @param cappedDeltaB The absolute value of capped deltaB, used to setup per-block conversion limits.
     * @return percentStalkPenalty The percent of stalk that should be lost, 0 means no penalty, 1 means 100% penalty.
     */
    function _calculateStalkPenalty(int256 beforeDeltaB, int256 afterDeltaB, uint256[] memory bdvsRemoved, uint256 cappedDeltaB) internal returns (uint256) {

        uint256 bdvConverted;
        for (uint256 i = 0; i < bdvsRemoved.length; i++) {
            bdvConverted = bdvConverted.add(bdvsRemoved[i]);
        }

        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 crossoverAmount = 0;

        // console.log('beforeDeltaB: ');
        // console.logInt(beforeDeltaB);
        // console.log('afterDeltaB: ');
        // console.logInt(afterDeltaB);
        // console.log('bdvConverted: ', bdvConverted);

        uint256 amountAgainstPeg = abs(afterDeltaB.sub(beforeDeltaB));

        if (beforeDeltaB == 0 && afterDeltaB != 0) {
            //this means we converted away from peg, so amount against peg is penalty
            return amountAgainstPeg;
        }

        // Check if the signs of beforeDeltaB and afterDeltaB are different,
        // indicating that deltaB has crossed zero
        if ((beforeDeltaB > 0 && afterDeltaB < 0) || (beforeDeltaB < 0 && afterDeltaB > 0)) {
            // Calculate how far past peg we went - so actually this is just abs of new deltaB
            crossoverAmount = uint256(abs(int256(afterDeltaB)));

            console.log('crossoverAmount: ', crossoverAmount);

            // Check if the crossoverAmount is greater than or equal to bdvConverted
            // TODO: see if we can find cases where bdcConverted doesn't match the deltaB diff? should always in theory afaict
            if (crossoverAmount > bdvConverted) {
                // If the entire bdvConverted amount crossed over, something is fishy, bdv amounts wrong?
                revert("Convert: converted farther than bdv");
                // return 1e18; // 1e18 represents 100% as a fixed-point number with 18 decimal places
                // TODO: consider if this is a good amount of precision
            } else {
                // return amount crossed over
                return crossoverAmount;
            }
        } else if (beforeDeltaB <= 0 && afterDeltaB < beforeDeltaB) { 
            return amountAgainstPeg;
        } else if (beforeDeltaB >= 0 && afterDeltaB > beforeDeltaB) { 
            return amountAgainstPeg;
        }

        // at this point we are converting in direction of peg, but we may have gone past it
        // calculate how much closer

        // see if convert power for this block has been setup yet
        if (s.convertPowerThisBlock[block.number].hasConvertHappenedThisBlock == false) {
            // setup initial available convert power for this block at the current deltaB
            // use insta deltaB that's from previous block
            console.log('setting up convertPower to be: ', cappedDeltaB);
            s.convertPowerThisBlock[block.number].convertPower = cappedDeltaB;
            s.convertPowerThisBlock[block.number].hasConvertHappenedThisBlock = true;
        }

        // calculate how much deltaB convert is happening with this convert
        uint256 convertAmountInDirectionOfPeg = abs(beforeDeltaB - afterDeltaB);

        console.log('convertAmountInDirectionOfPeg: ', convertAmountInDirectionOfPeg);
        console.log('s.convertPowerThisBlock[block.number].convertPower: ', s.convertPowerThisBlock[block.number].convertPower);

        if (convertAmountInDirectionOfPeg <= s.convertPowerThisBlock[block.number].convertPower) {
            // all good, you're using less than the available convert power

            // subtract from convert power available for this block
            s.convertPowerThisBlock[block.number].convertPower -= convertAmountInDirectionOfPeg;

            return crossoverAmount;
        } else {
            // you're using more than the available convert power

            // penalty will be how far past peg you went
            uint256 penalty = convertAmountInDirectionOfPeg - s.convertPowerThisBlock[block.number].convertPower;

            // all convert power for this block is used up
            s.convertPowerThisBlock[block.number].convertPower = 0;

            return penalty+crossoverAmount; // should this be capped at bdvConverted?
        }
    }

    function getConvertPower() public view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.convertPowerThisBlock[block.number].hasConvertHappenedThisBlock == false) {
            // if convert power has not been initialized for this block, use the overall deltaB
            return abs(LibWellMinting.overallDeltaB());
        }
        return s.convertPowerThisBlock[block.number].convertPower;
    }

    //for finding the before/after deltaB difference, we need to use the min of
    //the inst and the twa deltaB

    //note we need a way to get insta version of this
    function getCombinedDeltaBForTokens(address inputToken, address outputToken) internal view
        returns (int256 combinedDeltaBinsta) {
        //get deltaB of input/output tokens for comparison later
        // combinedDeltaBtwa = getDeltaBIfNotBeanInsta(inputToken) + getDeltaBIfNotBeanInsta(outputToken);
        combinedDeltaBinsta = getDeltaBIfNotBeanInsta(inputToken).add(getDeltaBIfNotBeanInsta(outputToken));
        console.log('combinedDeltaBinsta:');
        console.logInt(combinedDeltaBinsta);
    }

    function getDeltaBIfNotBeanInsta(address token) internal view returns (int256 instDeltaB) {
        console.log('getDeltaBIfNotBean token: ', token);
        if (token == address(C.bean())) {
            return 0;
        }
        instDeltaB = LibWellMinting.instantaneousDeltaBForConvert(token);
        console.log('instDeltaB: ');
        console.logInt(instDeltaB);
        return instDeltaB;
    }

    function executeAdvancedFarmCalls(AdvancedFarmCall[] calldata calls)
        internal
        returns (
            uint256 amountOut
        )
    {
        bytes[] memory results;

        console.log('executeAdvancedFarmCalls calls.length: ', calls.length);
     
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Convert: empty AdvancedFarmCall");
            results[i] = LibFarm._advancedFarmMem(calls[i], results);
            console.log('executeAdvancedFarmCalls results[i] i value: ', i);
            console.log('executeAdvancedFarmCalls results[i]: ');
            console.logBytes(results[i]);
        }

        // assume last value is the amountOut
        // todo: for full functionality, we should instead have the user specify the index of the amountOut
        // in the farmCallResult.
        // amountOut = abi.decode(LibBytes.sliceFrom(results[results.length-1], 64), (uint256));

        // grab very last 32 bytes
        amountOut = abi.decode(LibBytes.sliceFrom(results[results.length-1], results[results.length-1].length-32), (uint256));
        console.log('executeAdvancedFarmCalls amountOut: ', amountOut);
    }


    function transferTokensFromPipeline(address tokenOut, uint256 userReturnedConvertValue) private {
        // todo investigate not using the entire interface but just using the function selector here
        PipeCall memory p;
        p.target = address(tokenOut); //contract that pipeline will call
        p.data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            address(this),
            userReturnedConvertValue
        );

        //todo: see if we can find a way to spit out a custom error saying it failed here, rather than a generic ERC20 revert
        // bool success;
        // bytes memory result;
        // (success, result) = p.target.staticcall(p.data);
        // if (!success) {
        //     revert("Failed to transfer tokens from pipeline");
        // }
        //I don't think calling checkReturn here is necessary if success is false?
        // LibFunction.checkReturn(success, result);

        IPipeline(PIPELINE).pipe(p);
    }

    /**
     * @notice removes the deposits from msg.sender and returns the
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
    ) internal returns (uint256, uint256, uint256[] memory bdvs, uint256[] memory stalksRemoved) {
        require(
            stems.length == amounts.length,
            "Convert: stems, amounts are diff lengths."
        );
        // LibSilo.AssetsRemoved memory a;
        AssetsRemovedConvert memory a;
        uint256 i = 0;

        // a bracket is included here to avoid the "stack too deep" error.
        {
            a.bdvsRemoved = new uint256[](stems.length);
            a.stalksRemoved = new uint256[](stems.length);
            a.depositIds = new uint256[](stems.length);

            // get germinating stem and stemTip for the token
            LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);

            while ((i < stems.length) && (a.active.tokens < maxTokens)) {

                console.log('_withdrawTokens i: ', i);
                console.log('_withdrawTokens amounts[i]', amounts[i]);

                // skip any stems that are germinating, due to the ability to 
                // circumvent the germination process.
                if (germStem.germinatingStem <= stems[i]) {
                    i++;
                    console.log('ERROR: this stuff was still germinating');
                    continue;
                }

                console.log('_withdrawTokens stems[i]: ');
                console.logInt(stems[i]);

                if (a.active.tokens.add(amounts[i]) >= maxTokens) amounts[i] = maxTokens.sub(a.active.tokens);

                console.log('doing remove deposit from account');
                
                a.bdvsRemoved[i] = LibTokenSilo.removeDepositFromAccount(
                        LibTractor._getUser(),
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
                
                console.log('a.active.stalk: ', a.active.stalk);
                a.active.tokens = a.active.tokens.add(amounts[i]);
                console.log('a.active.tokens: ', a.active.tokens);
                a.active.bdv = a.active.bdv.add(a.bdvsRemoved[i]);
                console.log('a.active.bdv: ', a.active.bdv);
                
                a.depositIds[i] = uint256(LibBytes.packAddressAndStem(
                    token,
                    stems[i]
                ));
                i++;
            }
            for (i; i < stems.length; ++i) amounts[i] = 0;
            
            emit RemoveDeposits(
                LibTractor._getUser(),
                token,
                stems,
                amounts,
                a.active.tokens,
                a.bdvsRemoved
            );

            emit LibSilo.TransferBatch(
                LibTractor._getUser(), 
                LibTractor._getUser(),
                address(0), 
                a.depositIds, 
                amounts
            );
        }

        console.log('maxTokens: ', maxTokens);
        console.log('a.active.tokens: ', a.active.tokens);
        console.log('a.active.stalk: ', a.active.stalk);
        console.log('stalk from issued: ', a.active.bdv.mul(s.ss[token].stalkIssuedPerBdv));
        console.log('total burn: ', a.active.stalk.add(a.active.bdv.mul(s.ss[token].stalkIssuedPerBdv)));

        require(
            a.active.tokens == maxTokens,
            "Convert: Not enough tokens removed."
        );
        LibTokenSilo.decrementTotalDeposited(token, a.active.tokens, a.active.bdv);

        console.log('burning active stalk');

        // all deposits converted are not germinating.
        LibSilo.burnActiveStalk(
            LibTractor._getUser(),
            a.active.stalk.add(a.active.bdv.mul(s.ss[token].stalkIssuedPerBdv))
        );
        return (a.active.stalk, a.active.bdv, a.bdvsRemoved, a.stalksRemoved);
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
                LibTractor._getUser(), 
                bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk)
            );
        } else {
            LibTokenSilo.incrementTotalGerminating(token, amount, bdv, germ);
            // safeCast not needed as stalk is <= max(uint128)
            LibSilo.mintGerminatingStalk(LibTractor._getUser(), uint128(bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token))), germ);   
            LibSilo.mintActiveStalk(LibTractor._getUser(), grownStalk);
        }
        LibTokenSilo.addDepositToAccount(
            LibTractor._getUser(),
            token, 
            stem, 
            amount,
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle
        );        
    }

    /**
     * @dev Add this amount of tokens to the silo, splitting the deposits by bdv into multiple crates.
     * @param inputToken The input token for the convert.
     * @param outputToken The output token for the convert.
     * @param amount The amount of tokens to deposit.
     * @param bdvs The bdvs to split the amounts into
     * @param grownStalks The amount of Stalk to deposit per crate
     * @param inputAmounts The amount of tokens to deposit per crate
     */
    function _depositTokensForConvertMultiCrate(
        address inputToken,
        address outputToken,
        uint256 amount,
        uint256[] memory bdvs,
        uint256[] memory grownStalks,
        uint256[] memory inputAmounts
    ) internal returns (int96[] memory outputStems, uint256[] memory outputAmounts) {

        MultiCrateDepositData memory mcdd;

        console.log('_depositTokensForConvertMultiCrate: ', amount);

        mcdd.amountPerBdv = amount.div(LibTokenSilo.beanDenominatedValue(outputToken, amount));
        mcdd.totalAmount = 0;

        // init outputStems and outputAmounts
        outputStems = new int96[](bdvs.length);
        outputAmounts = new uint256[](bdvs.length);

        for (uint256 i = 0; i < bdvs.length; i++) {
            console.log('_depositTokensForConvertMultiCrate i: ', i);
            // console.log('_depositTokensForConvertMultiCrate bdvs[i]: ', bdvs[i]);
            console.log('_depositTokensForConvertMultiCrate grownStalks[i]: ', grownStalks[i]);
            // console.log('_depositTokensForConvertMultiCrate amount: ', amount);
            // uint256 bdv = bdvs[i];
            require( bdvs[i] > 0 && amount > 0, "Convert: BDV or amount is 0.");
            mcdd.crateAmount = bdvs[i].mul(mcdd.amountPerBdv);
            mcdd.totalAmount = mcdd.totalAmount.add(mcdd.crateAmount);

            //if we're on the last crate, deposit the rest of the amount
            if (i == bdvs.length - 1 && bdvs.length > 1) {
                mcdd.crateAmount = amount.sub(mcdd.totalAmount);
            } else if (i == bdvs.length - 1) {
                mcdd.crateAmount = amount; //if there's only one crate, make sure to deposit the full amount
            }
            
            // console.log('_depositTokensForConvertMultiCrate final mcdd.crateAmount:  ', mcdd.crateAmount);

            // because we're calculating a new token amount, the bdv will not be exactly the same as what we withdrew,
            // so we need to make sure we calculate what the actual deposited BDV is.
            // TODO: investigate and see if we can just use the amountPerBdv variable instead of calculating it again.
            mcdd.depositedBdv = LibTokenSilo.beanDenominatedValue(outputToken, mcdd.crateAmount);
            

            // calculate the stem and germination state for the new deposit.
            (mcdd.stem, mcdd.germ) = LibTokenSilo.calculateStemForTokenFromGrownStalk(outputToken, grownStalks[i], mcdd.depositedBdv);

            console.log('i: ', i);
            console.log('mcdd.stem: ');
            console.logInt(mcdd.stem);
            console.log('crateAmount: ', mcdd.crateAmount);

            outputStems[i] = mcdd.stem;

            outputAmounts[i] = mcdd.crateAmount;
            
            // increment totals based on germination state, 
            // as well as issue stalk to the user.
            // if the deposit is germinating, only the inital stalk of the deposit is germinating. 
            // the rest is active stalk.
            if (mcdd.germ == LibGerminate.Germinate.NOT_GERMINATING) {
                LibTokenSilo.incrementTotalDeposited(outputToken, mcdd.crateAmount, mcdd.depositedBdv);
                console.log('minting active stalk, issued from bdv: ', mcdd.depositedBdv.mul(LibTokenSilo.stalkIssuedPerBdv(outputToken)));
                console.log('minting active stalk from grown: ', grownStalks[i]);
                LibSilo.mintActiveStalk(
                    LibTractor._getUser(), 
                    mcdd.depositedBdv.mul(LibTokenSilo.stalkIssuedPerBdv(outputToken)).add(grownStalks[i])
                );
            } else {
                LibTokenSilo.incrementTotalGerminating(outputToken, mcdd.crateAmount, mcdd.depositedBdv, mcdd.germ);
                // safeCast not needed as stalk is <= max(uint128)
                LibSilo.mintGerminatingStalk(LibTractor._getUser(), uint128(mcdd.depositedBdv.mul(LibTokenSilo.stalkIssuedPerBdv(outputToken))), mcdd.germ);   
                LibSilo.mintActiveStalk(LibTractor._getUser(), grownStalks[i]);
            }
            LibTokenSilo.addDepositToAccount(
                LibTractor._getUser(),
                outputToken, 
                mcdd.stem, 
                mcdd.crateAmount,
                mcdd.depositedBdv,
                LibTokenSilo.Transfer.emitTransferSingle
            );

            emit Convert(LibTractor._getUser(), inputToken, outputToken, inputAmounts[i], mcdd.crateAmount);
        }
    }
}
