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
import {IPipeline, PipeCall} from "contracts/interfaces/IPipeline.sol";
import {LibFunction} from "contracts/libraries/LibFunction.sol";
import "hardhat/console.sol";

interface IBeanstalk {
    function bdv(address token, uint256 amount) external view returns (uint256);
    function poolDeltaB(address pool) external view returns (int256);
}

/**
 * @author Publius, Brean, DeadManWalking, pizzaman1337, funderberker
 * @title ConvertFacet handles converting Deposited assets within the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
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
        address toToken; address fromToken; uint256 grownStalk;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(convertData);

        require(fromAmount > 0, "Convert: From amount is 0.");

        LibSilo._mow(LibTractor._getUser(), fromToken);
        LibSilo._mow(LibTractor._getUser(), toToken);

        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            stems,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toStem = _depositTokensForConvert(toToken, toAmount, toBdv, grownStalk);

        emit Convert(LibTractor._getUser(), fromToken, toToken, fromAmount, toAmount);
    }


    /**
     * A farm convert needs to be able to take in:
     * 1. A list of tokens, stems, and amounts for input
     * 2. An output token address
     * 3. A farm function that does a swap, somehow we have to pass all the input tokens and amounts to this function
     * 
     * I was considering adding an allowConvertPastPeg bool, which if false, would rever the txn.
     * This functionality can be achieve by baking it into the pipeline calls however.
     */

    function pipelineConvert(
        address inputToken, 
        int96[] calldata stems, //array of stems to convert
        uint256[] calldata amounts, //amount from each crate to convert
        uint256 totalAmountIn, //passed in rather than calculated to save gas (don't worry, will fail if it's wrong)
        address outputToken,
        bytes calldata farmData
    )
        external
        payable
        nonReentrant
        returns (
            uint256 amountOut, int96 toStem
        )
    {   
        LibTractor._setPublisher(msg.sender);
        
        // AppStorage storage s = LibAppStorage.diamondStorage();

        // require(s.ss[outputToken].milestoneSeason != 0, "Token not whitelisted");


        //pull out the deposits for each stem so we can get total amount
        //all the crates passed to this function will be combined into one,
        //so if a user wants to do special combining of crates, this function can be called multiple times

        
        // uint256 totalAmountIn = 0;
        // for (uint256 i = 0; i < stems.length; i++) {
        //     totalAmountIn = totalAmountIn.add(amounts[i]);
        // }

        //todo: actually withdraw crates
        uint256 grownStalk;
        // uint256 fromBdv;

        (grownStalk, ) = _withdrawTokens(
            inputToken,
            stems,
            amounts,
            totalAmountIn
        );

        // storePoolDeltaB(inputToken, outputToken);
        // int256 (combinedDeltaBtwa, combinedDeltaBinsta) = getCombinedDeltaBForTokens(inputToken, outputToken);


        IERC20(inputToken).transfer(PIPELINE, totalAmountIn);
        amountOut = executeAdvancedFarmCalls(farmData);

        
        //user MUST leave final assets in pipeline, allowing us to verify that the farm has been called successfully.
        //this also let's us know how many assets to attempt to pull out of the final type
        transferTokensFromPipeline(outputToken, amountOut);


        uint256 newBdv = LibTokenSilo.beanDenominatedValue(outputToken, amountOut);
        //note bdv could decrease here, by a lot, esp because you can deposit only a fraction
        //of what you withdrew


        //stalk bonus/penalty will be applied here

        // combinedDeltaB = combinedDeltaB + getCombinedDeltaBForTokens(inputToken, outputToken);
        // console.log('updatedCombinedDeltaB');
        // console.logInt(combinedDeltaB);

        //TODO: grownStalk should be lost as % of bdv decrease?
        //grownstalk recieved as a bonus should be deposited evenly across all deposits
        //use current bdv of in tokens or bdv at time of previous deposit?

        toStem = _depositTokensForConvert(outputToken, amountOut, newBdv, grownStalk);

        //emit convert event, but do we want a new event definition? the old one can't handle multiple input tokens nor the combining of stems/etc

        //there's nothing about total BDV in this event, but it can be derived from the AddDeposit events
        emit Convert(LibTractor._getUser(), inputToken, outputToken, totalAmountIn, amountOut);
        LibTractor._resetPublisher();
    }

    //for finding the before/after deltaB difference, we need to use the min of
    //the inst and the twa deltaB

    //note we need a way to get insta version of this
    // function getCombinedDeltaBForTokens(address inputToken, address outputToken) internal
    //     returns (int256 combinedDeltaBtwa, int256 combinedDeltaBinsta) {
    //     //get deltaB of input/output tokens for comparison later
    //     combinedDeltaBtwa = getDeltaBIfNotBean(inputToken) + getDeltaBIfNotBean(outputToken);
    //     console.log('getCombinedDeltaBForTokens');
    //     console.logInt(combinedDeltaB);

    //     combinedDeltaBinsta = getDeltaBIfNotBeanInsta(inputToken) + getDeltaBIfNotBeanInsta(outputToken);
    // }

    // function storePoolDeltaB(address inputToken, address outputToken) internal {
    //             //get deltaB of input/output tokens for comparison later
    //     int256 inputTokenDeltaB = getDeltaBIfNotBean(inputToken);
    //     int256 outputTokenDeltaB = getDeltaBIfNotBean(outputToken);

    //     console.log('inputTokenDeltaB: ');
    //     console.logInt(inputTokenDeltaB);
    //     console.log('outputTokenDeltaB: ');
    //     console.logInt(outputTokenDeltaB);
    // }

    //may not be best use of gas to have this as different function?
    function getDeltaBIfNotBeanTwa(address token) internal view returns (int256) {
        console.log('getDeltaBIfNotBean token: ', token);
        if (token == address(C.bean())) {
            return 0;
        }
        return BEANSTALK.poolDeltaB(token);
    }

    // function getDeltaBIfNotBeanInsta(address token) internal view returns (int256) {
    //     console.log('getDeltaBIfNotBean token: ', token);
    //     if (token == address(C.bean())) {
    //         return 0;
    //     }
    //     return LibWellMinting.instantaneousDeltaB(token);
    // }

    function logResultBySlot(bytes memory data) public view returns (bytes[] memory args) {
        // Extract the selector

        
        // assembly {
        //     selector := mload(add(data, 32))
        // }


        // selector = bytes4(uint32(uint256(data[0])));

        // console.log('init array');
        
        // Initialize an array to hold the arguments
        args = new bytes[]((data.length) / 32);

        // console.log('extract args');
        
        // Extract each argument
        for (uint i = 0; i < data.length; i += 32) {
            // console.log('here');
            bytes memory arg = new bytes(32);
            for (uint j = 0; j < 32; j++) {
                // console.log('here 2');
                // Check if we're within the bounds of the data array
                if (i + j < data.length) {
                    // console.log('good length');
                    arg[j] = data[i + j];
                } else {
                    console.log('bad length');
                    // If we're out of bounds, fill the rest of the argument with zeros
                    arg[j] = byte(0);
                    console.log('hm we went out of bounds uh oh');
                }
            }
            // console.log('here 3');
            
            uint index = i / 32;
            // Check if the index is within bounds
            if (index < args.length) {
                args[index] = arg;
            } else {
                console.log('index was out of bounds');
                console.log('index: ', index);
                console.log('args.length: ', args.length);
                // Handle the case where the index is out of bounds
                // This should not happen if the calculation is correct, but it's good to have a safeguard
                // revert("Index out of bounds");
            }
        }
        
        // Print the selector
        // console.log('extractData printing selector');
        // console.logBytes4(selector);

        console.log('print cargs');
        
        // Print each argument
        for (uint i = 0; i < args.length; i++) {
            console.log('logResultBySlot printing slot: ');
            console.logBytes(args[i]);
        }
    }

    function executeAdvancedFarmCalls(bytes calldata farmData)
        internal
        returns (
            uint256 amountOut
        )
    {
        // bytes memory lastBytes = results[results.length - 1];
        //at this point lastBytes is 3 slots long, we just need the last slot (first two slots contain 0x2 for some reason)
        bytes[] memory results;
        AdvancedFarmCall[] memory calls = abi.decode(
            LibBytes.sliceFrom(farmData, 4),
            (AdvancedFarmCall[])
        );

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Convert: empty AdvancedFarmCall");
            results[i] = LibFarm._advancedFarmMem(calls[i], results);

            //log result
            console.log('results[i]: ', i);
            console.logBytes(results[i]);
        }
        // assume last value is the amountOut
        // todo: for full functionality, we should instead have the user specify the index of the amountOut
        // in the farmCallResult.
        amountOut = abi.decode(LibBytes.sliceFrom(results[results.length-1], 64), (uint256));
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

    // todo: implement oracle
    function getOracleprice() internal returns (uint256) {
        return 1e6;
    }

    function _bdv(address token, uint256 amount) internal returns (uint256) {
        return LibTokenSilo.beanDenominatedValue(token, amount);
    }


    function _withdrawTokens(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256, uint256) {
        require(
            stems.length == amounts.length,
            "Convert: stems, amounts are diff lengths."
        );
        LibSilo.AssetsRemoved memory a;
        uint256 depositBDV;
        uint256 i = 0;
        // a bracket is included here to avoid the "stack too deep" error.
        {
            uint256[] memory bdvsRemoved = new uint256[](stems.length);
            uint256[] memory depositIds = new uint256[](stems.length);
            while ((i < stems.length) && (a.tokensRemoved < maxTokens)) {
                if (a.tokensRemoved.add(amounts[i]) < maxTokens) {
                    //keeping track of stalk removed must happen before we actually remove the deposit
                    //this is because LibTokenSilo.grownStalkForDeposit() uses the current deposit info
                    depositBDV = LibTokenSilo.removeDepositFromAccount(
                        LibTractor._getUser(),
                        token,
                        stems[i],
                        amounts[i]
                    );
                    bdvsRemoved[i] = depositBDV;
                    a.stalkRemoved = a.stalkRemoved.add(
                        LibSilo.stalkReward(
                            stems[i],
                            LibTokenSilo.stemTipForToken(token),
                            depositBDV.toUint128()
                        )
                    );
                    
                } else {
                    amounts[i] = maxTokens.sub(a.tokensRemoved);
                    depositBDV = LibTokenSilo.removeDepositFromAccount(
                        LibTractor._getUser(),
                        token,
                        stems[i],
                        amounts[i]
                    );

                    bdvsRemoved[i] = depositBDV;
                    a.stalkRemoved = a.stalkRemoved.add(
                        LibSilo.stalkReward(
                            stems[i],
                        LibTokenSilo.stemTipForToken(token),
                            depositBDV.toUint128()
                        )
                    );
                    
                }
                
                a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
                a.bdvRemoved = a.bdvRemoved.add(depositBDV);
                
                depositIds[i] = uint256(LibBytes.packAddressAndStem(
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
                a.tokensRemoved,
                bdvsRemoved
            );

            emit LibSilo.TransferBatch(
                LibTractor._getUser(), 
                LibTractor._getUser(),
                address(0), 
                depositIds, 
                amounts
            );
        }

        require(
            a.tokensRemoved == maxTokens,
            "Convert: Not enough tokens removed."
        );
        LibTokenSilo.decrementTotalDeposited(token, a.tokensRemoved, a.bdvRemoved);
        LibSilo.burnStalk(
            LibTractor._getUser(),
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv))
        );
        return (a.stalkRemoved, a.bdvRemoved);
    }

    //this is only used internal to the convert facet
    function _depositTokensForConvert(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk // stalk grown previously by this deposit
    ) internal returns (int96 stem) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        //calculate stem index we need to deposit at from grownStalk and bdv
        //if we attempt to deposit at a half-season (a grown stalk index that would fall between seasons)
        //then in affect we lose that partial season's worth of stalk when we deposit
        //so here we need to update grownStalk to be the amount you'd have with the above deposit
        
        /// @dev the two functions were combined into one function to save gas.
        // _stemTip = LibTokenSilo.grownStalkAndBdvToStem(IERC20(token), grownStalk, bdv);
        // grownStalk = uint256(LibTokenSilo.calculateStalkFromStemAndBdv(IERC20(token), _stemTip, bdv));

        (grownStalk, stem) = LibTokenSilo.calculateGrownStalkAndStem(token, grownStalk, bdv);

        LibSilo.mintStalk(LibTractor._getUser(), bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk));

        LibTokenSilo.incrementTotalDeposited(token, amount, bdv);
        LibTokenSilo.addDepositToAccount(
            LibTractor._getUser(), 
            token, 
            stem, 
            amount, 
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle
        );
    }
}
