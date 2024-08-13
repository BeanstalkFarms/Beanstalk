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
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibPipelineConvert} from "contracts/libraries/Convert/LibPipelineConvert.sol";
import "hardhat/console.sol";

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

    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
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
        nonReentrant
        returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)
    {
        // if the convert is a well <> bean convert, cache the state to validate convert.
        LibPipelineConvert.PipelineConvertData memory pipeData = LibPipelineConvert.getConvertState(
            convertData
        );

        LibConvert.ConvertParams memory cp = LibConvert.convert(convertData);

        console.log(
            "Data: decreaseBDV: %s, account: %s caller: %s",
            cp.decreaseBDV,
            cp.account,
            msg.sender
        );

        // if the account is 0, set it to `LibTractor._user()`
        // cp.account is only set upon a anti-lambda-lambda convert.
        if (cp.account == address(0)) {
            cp.account = LibTractor._user();
        }

        if (cp.decreaseBDV) {
            require(
                stems.length == 1 && amounts.length == 1,
                "Convert: DecreaseBDV only supports updating one deposit."
            );
        }

        require(cp.fromAmount > 0, "Convert: From amount is 0.");

        LibSilo._mow(cp.account, cp.fromToken);

        // If the fromToken and toToken are different, mow the toToken as well.
        if (cp.fromToken != cp.toToken) LibSilo._mow(cp.account, cp.toToken);

        // Withdraw the tokens from the deposit.
        (pipeData.grownStalk, fromBdv) = LibConvert._withdrawTokens(
            cp.fromToken,
            stems,
            amounts,
            cp.fromAmount,
            cp.account
        );

        // check for potential penalty
        LibPipelineConvert.checkForValidConvertAndUpdateConvertCapacity(
            pipeData,
            convertData,
            cp.fromToken,
            cp.toToken,
            fromBdv
        );

        // Calculate the bdv of the new deposit.
        uint256 newBdv = LibTokenSilo.beanDenominatedValue(cp.toToken, cp.toAmount);

        // If `decreaseBDV` flag is not enabled, set toBDV to the max of the two bdvs.
        toBdv = (newBdv > fromBdv || cp.decreaseBDV) ? newBdv : fromBdv;

        toStem = LibConvert._depositTokensForConvert(
            cp.toToken,
            cp.toAmount,
            toBdv,
            pipeData.grownStalk,
            cp.account
        );

        fromAmount = cp.fromAmount;
        toAmount = cp.toAmount;

        emit Convert(cp.account, cp.fromToken, cp.toToken, cp.fromAmount, cp.toAmount);
    }
}
