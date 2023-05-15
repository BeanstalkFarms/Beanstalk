/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "~/C.sol";
import {LibSilo} from "~/libraries/Silo/LibSilo.sol";
import {LibTokenSilo} from "~/libraries/Silo/LibTokenSilo.sol";
import {Silo} from "./SiloFacet/Silo.sol";
import {LibSafeMath32} from "~/libraries/LibSafeMath32.sol";
import {LibConvert} from "~/libraries/Convert/LibConvert.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {LibBytes} from "~/libraries/LibBytes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
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
        int128 stem,
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

    event TransferBatch(
        address indexed operator, 
        address indexed from, 
        address indexed to, 
        uint256[] ids, 
        uint256[] values
    );

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
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
        address toToken; address fromToken; uint256 grownStalk;
        (toToken, fromToken, toAmount, fromAmount) = LibConvert.convert(
            convertData
        );

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

    //////////////////////// UPDATE UNRIPE DEPOSITS ////////////////////////

    /**
     * @notice Update the BDV of an Unripe Deposit. Allows the user to claim
     * Stalk as the BDV of Unripe tokens increases during the Barn
     * Raise. This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     * 
     * {LibTokenSilo-removeDepositFromAccount} should revert if there isn't
     * enough balance of `token` to remove.
     * Because the amount and the stem of an Deposit does not change, 
     * an ERC1155 event does not need to be emitted.
     */
    function enrootDeposit(
        address token,
        int96 stem,
        uint256 amount
    ) external payable nonReentrant mowSender(token) {
        require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");
        // First, remove Deposit and Redeposit with new BDV
        uint256 ogBDV = LibTokenSilo.removeDepositFromAccount(
            msg.sender,
            token,
            stem,
            amount
        );
        emit RemoveDeposit(msg.sender, token, stem, amount, ogBDV); // Remove Deposit does not emit an event, while Add Deposit does.

        // Calculate the current BDV for `amount` of `token` and add a Deposit.
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);

        LibTokenSilo.addDepositToAccount(
            msg.sender, 
            token, 
            stem, 
            amount, 
            newBDV,
            LibTokenSilo.Transfer.noEmitTransferSingle
        ); // emits AddDeposit event

        // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
        uint256 deltaBDV = newBDV.sub(ogBDV);

        // Mint Stalk associated with the new BDV.
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(stem,
                                LibTokenSilo.stemTipForToken(token),
                                uint128(deltaBDV))
        );

        LibSilo.mintStalk(msg.sender, deltaStalk);
    }

    modifier mowSender(address token) {
       LibSilo._mow(msg.sender, token);
        _;
    }

    /** 
     * @notice Update the BDV of Unripe Deposits. Allows the user to claim Stalk
     * as the BDV of Unripe tokens increases during the Barn Raise.
     * This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     * {removeDepositsFromAccount} should revert if there isn't enough balance of `token`
     * to remove.
     */
    function enrootDeposits(
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) external payable nonReentrant mowSender(token) {
        require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");
        // First, remove Deposits because every deposit is in a different season,
        // we need to get the total Stalk, not just BDV.
        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(msg.sender, token, stems, amounts);
        LibSilo.AssetsAdded memory aa;

        // Get new BDV
        aa.bdvAdded = LibTokenSilo.beanDenominatedValue(token, ar.tokensRemoved);

        //pulled these vars out because of "CompilerError: Stack too deep, try removing local variables."
        int96 _lastStem = LibTokenSilo.stemTipForToken(token); //need for present season
        uint32 _stalkPerBdv = s.ss[token].stalkIssuedPerBdv;

        // Iterate through all stems, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < stems.length; ++i) {
            uint256 bdv = amounts[i].mul(aa.bdvAdded).div(ar.tokensRemoved); // Cheaper than calling the BDV function multiple times.
            LibTokenSilo.addDepositToAccount(
                msg.sender,
                token,
                stems[i],
                amounts[i],
                bdv,
                LibTokenSilo.Transfer.noEmitTransferSingle
            );
            
            aa.stalkAdded = aa.stalkAdded.add(
                bdv.mul(_stalkPerBdv).add(
                    LibSilo.stalkReward(
                        stems[i],
                        _lastStem,
                        uint128(bdv)
                    )
                )
            );
        }

        // Mint Stalk associated with the delta BDV.
        LibSilo.mintStalk(
            msg.sender,
            aa.stalkAdded.sub(ar.stalkRemoved)
        );
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
                        msg.sender,
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
                        msg.sender,
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
                msg.sender,
                token,
                stems,
                amounts,
                a.tokensRemoved,
                bdvsRemoved
            );

            emit TransferBatch(
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
        LibTokenSilo.decrementTotalDeposited(token, a.tokensRemoved);
        LibSilo.burnStalk(
            msg.sender,
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

        (grownStalk, stem) = LibTokenSilo.calculateGrownStalkAndStem(IERC20(token), grownStalk, bdv);

        LibSilo.mintStalk(msg.sender, bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk));

        LibTokenSilo.incrementTotalDeposited(token, amount);
        LibTokenSilo.addDepositToAccount(
            msg.sender, 
            token, 
            stem, 
            amount, 
            bdv,
            LibTokenSilo.Transfer.emitTransferSingle
        );
    }

    function getMaxAmountIn(address tokenIn, address tokenOut)
        external
        view
        returns (uint256 amountIn)
    {
        return LibConvert.getMaxAmountIn(tokenIn, tokenOut);
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return LibConvert.getAmountOut(tokenIn, tokenOut, amountIn);
    }
}
