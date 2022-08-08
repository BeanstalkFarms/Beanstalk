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
 * @author Publius
 * @title Lib Token Silo
 **/
library LibTokenSilo {
    using SafeMath for uint256;

    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    );

    /*
     * Deposit
     */

    function deposit(
        address account,
        address token,
        uint32 _s,
        uint256 amount
    ) internal returns (uint256, uint256) {
        uint256 bdv = beanDenominatedValue(token, amount);
        return depositWithBDV(account, token, _s, amount, bdv);
    }

    function depositWithBDV(
        address account,
        address token,
        uint32 _s,
        uint256 amount,
        uint256 bdv
    ) internal returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bdv > 0, "Silo: No Beans under Token.");
        incrementDepositedToken(token, amount);
        addDeposit(account, token, _s, amount, bdv);
        return (bdv.mul(s.ss[token].seeds), bdv.mul(s.ss[token].stalk));
    }

    function incrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.add(
            amount
        );
    }

    function addDeposit(
        address account,
        address token,
        uint32 _s,
        uint256 amount,
        uint256 bdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].deposits[token][_s].amount += uint128(amount);
        s.a[account].deposits[token][_s].bdv += uint128(bdv);
        emit AddDeposit(account, token, _s, amount, bdv);
    }

    function decrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.sub(
            amount
        );
    }

    /*
     * Remove
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

    /*
     * Getters
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

    function beanDenominatedValue(address token, uint256 amount)
        internal
        returns (uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
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

    function tokenWithdrawal(
        address account,
        address token,
        uint32 id
    ) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].withdrawals[token][id];
    }

    function seeds(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].seeds);
    }

    function stalk(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalk);
    }
}
