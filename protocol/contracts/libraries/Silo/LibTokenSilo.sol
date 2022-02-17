/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../LibAppStorage.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Lib Token Silo
**/
library LibTokenSilo {

    using SafeMath for uint256;

    event Deposit(address indexed account, address indexed token, uint256 season, uint256 amount, uint256 bdv);

    /*
     * Deposit
     */

    function deposit(address account, address token, uint32 _s, uint256 amount) internal returns (uint256, uint256) {
        uint256 bdv = beanDenominatedValue(token, amount);
        return depositWithBDV(account, token, _s, amount, bdv);
    }

    function depositWithBDV(address account, address token, uint32 _s, uint256 amount, uint256 bdv) internal returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bdv > 0, "Silo: No Beans under Token.");
        incrementDepositedToken(token, amount);
        addDeposit(account, token, _s, amount, bdv);
        return (bdv.mul(s.ss[token].seeds), bdv.mul(s.ss[token].stalk));
    }

    function incrementDepositedToken(address token, uint256 amount) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.add(amount);
    }

    function addDeposit(address account, address token, uint32 _s, uint256 amount, uint256 bdv) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].deposits[token][_s].amount += uint128(amount);
        s.a[account].deposits[token][_s].bdv += uint128(bdv);
        emit Deposit(account, token, _s, amount, bdv);
    }

    function decrementDepositedToken(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.sub(amount);
    }

    /*
     * Remove
     */

    function removeDeposit(address account, address token, uint32 id, uint256 amount)
        internal
        returns (uint256, uint256) 
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint256 crateAmount, uint256 crateBase) = tokenDeposit(account, token, id);
        require(crateAmount >= amount, "Silo: Crate balance too low.");
        if (amount < crateAmount) {
            uint256 base = amount.mul(crateBase).div(crateAmount);
            uint256 newBase = uint256(s.a[account].deposits[token][id].bdv).sub(base);
            uint256 newAmount = uint256(s.a[account].deposits[token][id].amount).sub(amount);
            require(newBase <= uint128(-1) && newAmount <= uint128(-1), 'Silo: uint128 overflow.');
            s.a[account].deposits[token][id].amount = uint128(newAmount);
            s.a[account].deposits[token][id].bdv = uint128(newBase);
            return (amount, base);
        } else {
            delete s.a[account].deposits[token][id];
            return (crateAmount, crateBase);
        }
    }

    /*
     * Getters
     */

    function tokenDeposit(address account, address token, uint32 id) internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (s.a[account].deposits[token][id].amount, s.a[account].deposits[token][id].bdv);
    }

    function beanDenominatedValue(address token, uint256 amount) private returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bytes memory myFunctionCall = abi.encodeWithSelector(s.ss[token].selector, amount);
        (bool success, bytes memory data) = address(this).delegatecall(myFunctionCall);
        require(success, "Silo: Bean denominated value failed.");
        assembly { bdv := mload(add(data, add(0x20, 0))) }
    }

    function tokenWithdrawal(address account, address token, uint32 id) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].withdrawals[token][id];
    }
}