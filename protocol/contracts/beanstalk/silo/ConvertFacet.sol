/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";

/**
 * @author Publius, Brean, DeadManWalking
 * @title ConvertFacet handles converting Deposited assets within the Silo.
 **/
contract ConvertFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;

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

        LibSilo._mow(msg.sender, fromToken);
        LibSilo._mow(msg.sender, toToken);

        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            stems,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toStem = _depositTokensForConvert(toToken, toAmount, toBdv, grownStalk);

        emit Convert(msg.sender, fromToken, toToken, fromAmount, toAmount);
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

            // get germinating stem and stemTip for the token
            LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);

            while ((i < stems.length) && (a.tokensRemoved < maxTokens)) {
                // skip any stems that are germinating.
                if (germStem.germinatingStem <= stems[i]) {
                    i++;
                    continue;
                }

                if (a.tokensRemoved.add(amounts[i]) >= maxTokens) amounts[i] = maxTokens.sub(a.tokensRemoved);
                depositBDV = LibTokenSilo.removeDepositFromAccount(
                        msg.sender,
                        token,
                        stems[i],
                        amounts[i],
                        LibGerminate.Germinate.NOT_GERMINATING
                    );
                bdvsRemoved[i] = depositBDV;
                a.stalkRemoved = a.stalkRemoved.add(
                    LibSilo.stalkReward(
                        stems[i],
                        germStem.stemTip,
                        depositBDV.toUint128()
                    )
                );
                
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
                msg.sender,
                token,
                stems,
                amounts,
                a.tokensRemoved,
                bdvsRemoved
            );

            emit LibSilo.TransferBatch(
                msg.sender, 
                msg.sender,
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

        // all deposits converted are not germinating.
        LibSilo.burnStalk(
            msg.sender,
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv)),
            LibGerminate.Germinate.NOT_GERMINATING
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

        // TODO: add increment TotalGerminating logic
        // 1: check whether the stem is a germinating stem. If so,
        // increment the total germinating amount.
        
        LibGerminate.Germinate germ;
        (grownStalk, stem, germ) = LibTokenSilo.calculateGrownStalkAndStem(token, grownStalk, bdv);
        
        LibSilo.mintStalk(
            msg.sender, 
            bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk),
            germ
        );
        
        // if the new stem is germinating, increment total germinating.
        // else increment total deposited.
        if (germ == LibGerminate.Germinate.NOT_GERMINATING) {
            LibTokenSilo.incrementTotalDeposited(token, amount, bdv);
        } else {
            LibTokenSilo.incrementTotalGerminating(token, amount, bdv, germ);
        }
        LibTokenSilo.addDepositToAccount(
            msg.sender, 
            token, 
            stem, 
            amount,
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle,
            germ
        );
    }
}
