/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "./SiloFacet/Silo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibInternal.sol";
import "../ReentrancyGuard.sol";
import "~/libraries/LibBytes.sol";


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

        (grownStalk, fromBdv) = _withdrawTokens(
            fromToken,
            stems,
            amounts,
            fromAmount
        );

        uint256 newBdv = LibTokenSilo.beanDenominatedValue(toToken, toAmount);
        toBdv = newBdv > fromBdv ? newBdv : fromBdv;

        toStem = _depositTokens(toToken, toAmount, toBdv, grownStalk);

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
     */
    function enrootDeposit(
        address token,
        int96 stem,
        uint256 amount
    ) external nonReentrant mowSender(token) {
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

        LibTokenSilo.addDepositToAccount(msg.sender, token, stem, amount, newBDV); // emits AddDeposit event

        // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
        uint256 deltaBDV = newBDV.sub(ogBDV);

        // Mint Stalk associated with the new BDV.
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(stem,
                                LibTokenSilo.stemTipForToken(IERC20(token)),
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
    ) external nonReentrant mowSender(token) {
        // First, remove Deposits because every deposit is in a different season,
        // we need to get the total Stalk, not just BDV.
        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(msg.sender, token, stems, amounts);

        // Get new BDV
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, ar.tokensRemoved);
        uint256 newStalk;

        //pulled these vars out because of "CompilerError: Stack too deep, try removing local variables."
        int96 _lastStem = LibTokenSilo.stemTipForToken(IERC20(token)); //need for present season
        uint32 _stalkPerBdv = s.ss[token].stalkIssuedPerBdv;

        // Iterate through all stems, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < stems.length; ++i) {
            uint256 bdv = amounts[i].mul(newBDV).div(ar.tokensRemoved); // Cheaper than calling the BDV function multiple times.
            LibTokenSilo.addDepositToAccount(
                msg.sender,
                token,
                stems[i],
                amounts[i],
                bdv
            );
            newStalk = newStalk.add(
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
            newStalk.sub(ar.stalkRemoved)
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
                        LibTokenSilo.stemTipForToken(IERC20(token)),
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
                        LibTokenSilo.stemTipForToken(IERC20(token)),
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
        // we emit 2 events for ERC1155 compatibility:
        // event 1: "Burn" ERC1155 deposit that was being converted from
        // event 2: "Mint" ERC1155 deposit being converted into: 
        // event 1 is emmitted here, the 2nd event is emitted in libtokensilo.addDepositToAccount
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

    function _depositTokens(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk //stalk grown previously by this deposit
    ) internal returns (int96 _cumulativeGrownStalk) {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

        //calculate stem index we need to deposit at from grownStalk and bdv
        //if we attempt to deposit at a half-season (a grown stalk index that would fall between seasons)
        //then in affect we lose that partial season's worth of stalk when we deposit
        //so here we need to update grownStalk to be the amount you'd have with the above deposit
        
        /// @dev the two functions were combined into one function to save gas.
        // _cumulativeGrownStalk = LibTokenSilo.grownStalkAndBdvToStem(IERC20(token), grownStalk, bdv);
        // grownStalk = uint256(LibTokenSilo.calculateStalkFromStemAndBdv(IERC20(token), _cumulativeGrownStalk, bdv));
        // TODO: better name for this function?
        (grownStalk, _cumulativeGrownStalk) = LibTokenSilo.calculateTotalGrownStalkandGrownStalk(IERC20(token), grownStalk, bdv);

        LibSilo.mintStalk(msg.sender, bdv.mul(LibTokenSilo.stalkIssuedPerBdv(token)).add(grownStalk));

        LibTokenSilo.incrementTotalDeposited(token, amount);
        LibTokenSilo.addDepositToAccount(msg.sender, token, _cumulativeGrownStalk, amount, bdv);
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
