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

/**
 * @author Publius, Brean, deadmanwalking
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
        address toToken; address fromToken; uint256 grownStalk; address account; bool decreaseBDV;

        /** @dev account and decreaseBDV are initialized at the start of LibConvert.convert()
        * as address(0) and false respectively and remain that way if a convert is not anti-lambda-lambda
        * If it is anti-lambda, account is the address of the account to update the deposit
        * and decreaseBDV is true */
        (toToken, fromToken, toAmount, fromAmount, account, decreaseBDV) = LibConvert.convert(convertData);

        require(fromAmount > 0, "Convert: From amount is 0.");

        // replace account with msg.sender if no account is specified
        if(account == address(0)) account = msg.sender;

        LibSilo._mow(account, fromToken);
        LibSilo._mow(account, toToken);

        // withdraw the tokens from the deposit 
        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            stems,
            amounts,
            fromAmount,
            account
        );

        // calculate the bdv of the new deposit
        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);

        // if we have used the anti-lambda-lamda convert, 
        // we need to update the bdv of the new deposit
        if(decreaseBDV) {
	        toBdv = newBdv;
        } else {
        // else keep the max of the two bdvs
	        toBdv = newBdv > fromBdv ? newBdv : fromBdv;
        }

        toStem = _depositTokensForConvert(toToken, toAmount, toBdv, grownStalk, account);

        emit Convert(account, fromToken, toToken, fromAmount, toAmount);
    }

    function _withdrawTokens(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens,
        address account
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
                        account,
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
                        account,
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
                account,
                token,
                stems,
                amounts,
                a.tokensRemoved,
                bdvsRemoved
            );

            emit LibSilo.TransferBatch(
                account, 
                account,
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
            account,
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv))
        );
        return (a.stalkRemoved, a.bdvRemoved);
    }

    //this is only used internal to the convert facet
    function _depositTokensForConvert(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk, // stalk grown previously by this deposit
        address account // account to update the deposit (used in bdv decrease)
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

        LibSilo.mintStalk(account, bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk));

        LibTokenSilo.incrementTotalDeposited(token, amount, bdv);
        LibTokenSilo.addDepositToAccount(
            account, 
            token, 
            stem, 
            amount, 
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle
        );
    }
}
