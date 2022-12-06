/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../../C.sol";
import "./LibUnripeSilo.sol";

/**
 * @title LibTokenSilo
 * @author Publius
 * @notice This library contains functions for depositing, withdrawing and claiming whitelisted Silo tokens.
 */
library LibTokenSilo {
    using SafeMath for uint256;

    /**
     * @dev IMPORTANT: mirror of {TokenSilo.AddDeposit}
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    );

    //////////////////////// ACCOUNTING ////////////////////////
    
    /**
     * @dev Increment the total amount of `token` deposited in the Silo.
     */
    function incrementDepositedTokenSupply(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.add(
            amount
        );
    }

    /**
     * @dev Decrement the total amount of `token` deposited in the Silo.
     */
    function decrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.sub(
            amount
        );
    }

    //////////////////////// ADD DEPOSIT ////////////////////////

    /**
     * @return seeds The amount of Seeds received for this Deposit.
     * @return stalk The amount of Stalk received for this Deposit.
     * 
     * @dev:
     * 
     * Calculate the current BDV for `amount` of `token`.
     * Then perform deposit accounting with known BDV.
     */
    function deposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256, uint256) {
        uint256 bdv = beanDenominatedValue(token, amount);
        return depositWithBDV(account, token, season, amount, bdv);
    }

    /**
     * @dev Once the current BDV for `amount` of `token` is known, perform deposit accounting.
     * 
     * Note that the conventional ordering used elsewhere in the Beanstalk
     * ecosystem is (stalk, seeds), but this function returns `(uint256 seeds, uint256 stalk)`.
     *
     * `s.ss[token].seeds` stores the number of Seeds per BDV.
     * `s.ss[token].stalk` stores the number of Stalk per BDV.
     */
    function depositWithBDV(
        address account,
        address token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    ) internal returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bdv > 0, "Silo: No Beans under Token.");

        incrementDepositedTokenSupply(token, amount); // Total
        addDeposit(account, token, season, amount, bdv); // Account

        return (
            bdv.mul(s.ss[token].seeds), // Seeds
            bdv.mul(s.ss[token].stalk)  // Stalk
        );
    }

    /**
     * @dev Add `amount` of `token` to the user's Deposit for `season`.
     *
     * If a Deposit doesn't yet exist, one is created. Otherwise, the existing Deposit is updated.
     * 
     * FIXME(doc) why the casting to uint128?
     */
    function addDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.a[account].deposits[token][season].amount += uint128(amount);
        s.a[account].deposits[token][season].bdv += uint128(bdv);

        emit AddDeposit(account, token, season, amount, bdv);
    }

    //////////////////////// REMOVE DEPOSIT ////////////////////////

    /**
     * FIXME(doc)
     */
    function removeDeposit(
        address account,
        address token,
        uint32 id,
        uint256 amount
    ) internal returns (uint256 crateBDV) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        uint256 crateAmount;
        (crateAmount, crateBDV) = (
            s.a[account].deposits[token][id].amount,
            s.a[account].deposits[token][id].bdv
        );

        if (amount < crateAmount) {
            uint256 base = amount.mul(crateBDV).div(crateAmount);
            uint256 newBase = uint256(s.a[account].deposits[token][id].bdv).sub(
                base
            );
            uint256 newAmount = uint256(s.a[account].deposits[token][id].amount)
                .sub(amount);
            require(
                newBase <= uint128(-1) && newAmount <= uint128(-1),
                "Silo: uint128 overflow."
            );
            s.a[account].deposits[token][id].amount = uint128(newAmount);
            s.a[account].deposits[token][id].bdv = uint128(newBase);
            return base;
        }

        if (crateAmount > 0) delete s.a[account].deposits[token][id];

        if (amount > crateAmount) {
            amount -= crateAmount;
            if (LibUnripeSilo.isUnripeBean(token))
                return
                    crateBDV.add(
                        LibUnripeSilo.removeUnripeBeanDeposit(
                            account,
                            id,
                            amount
                        )
                    );
            else if (LibUnripeSilo.isUnripeLP(token))
                return
                    crateBDV.add(
                        LibUnripeSilo.removeUnripeLPDeposit(account, id, amount)
                    );
            revert("Silo: Crate balance too low.");
        }
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice Locate the `amount` and `bdv` for a deposit in storage.
     * 
     * @dev: 
     * 
     * Unripe BEAN and Unripe LP are handled independently so that data
     * stored in the legacy Silo V1 format and the new Silo V2 format can
     * be appropriately merged.
     * 
     * Refer to {FIXME(doc)} for more information.
     * 
     * FIXME(naming): rename `id` to `season`
     */
    function tokenDeposit(
        address account,
        address token,
        uint32 id
    ) internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (LibUnripeSilo.isUnripeBean(token))
            return LibUnripeSilo.unripeBeanDeposit(account, id);

        if (LibUnripeSilo.isUnripeLP(token))
            return LibUnripeSilo.unripeLPDeposit(account, id);

        return (
            s.a[account].deposits[token][id].amount,
            s.a[account].deposits[token][id].bdv
        );
    }

    /**
     * @dev Calculate the BDV ("Bean Denominated Value") for `amount` of `token`.
     * 
     * Makes a call to a BDV function defined in the SiloSettings for this token.
     * 
     * See {AppStorage.sol:Storage.SiloSettings} for more information.
     *
     * FIXME(naming): rename myFunctionCall -> callData
     */
    function beanDenominatedValue(address token, uint256 amount)
        internal
        returns (uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // BDV functions accept one argument: `uint256 amount`
        bytes memory myFunctionCall = abi.encodeWithSelector(
            s.ss[token].selector,
            amount
        );

        (bool success, bytes memory data) = address(this).call(
            myFunctionCall
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }

        assembly {
            bdv := mload(add(data, add(0x20, 0)))
        }
    }

    /**
     * @dev Withdrawals are stored as a mapping of token => season => amount.
     * 
     * FIXME(naming): rename `id` to `season`
     */
    function tokenWithdrawal(
        address account,
        address token,
        uint32 id
    ) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].withdrawals[token][id];
    }

    /**
     * @dev Get the number of Seeds per BDV for a whitelisted token `token`.
     */
    function seeds(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].seeds);
    }

    /**
     * @dev Get the number of Stalk per BDV for a whitelisted token `token`.
     */
    function stalk(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalk);
    }
}
