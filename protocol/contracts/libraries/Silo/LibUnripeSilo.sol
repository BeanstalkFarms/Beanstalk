// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage, LibAppStorage, Account} from "../LibAppStorage.sol";
import {LibSafeMath128} from "../LibSafeMath128.sol";
import {C} from "~/C.sol";

/**
 * @title LibUnripeSilo
 * @author Publius
 */
library LibUnripeSilo {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    uint256 private constant AMOUNT_TO_BDV_BEAN_ETH = 119894802186829;
    uint256 private constant AMOUNT_TO_BDV_BEAN_3CRV = 992035;
    uint256 private constant AMOUNT_TO_BDV_BEAN_LUSD = 983108;

    function removeUnripeBeanDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) internal returns (uint256 bdv) {
        _removeUnripeBeanDeposit(account, id, amount);
        bdv = amount.mul(C.initialRecap()).div(1e18);
    }

    function _removeUnripeBeanDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].bean.deposits[id] = s.a[account].bean.deposits[id].sub(
            amount,
            "Silo: Crate balance too low."
        );
    }

    function isUnripeBean(address token) internal pure returns (bool b) {
        b = token == C.UNRIPE_BEAN;
    }

    function unripeBeanDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].bean.deposits[season];
        amount = uint256(
            s.a[account].deposits[C.UNRIPE_BEAN][season].amount
        ).add(legacyAmount);
        bdv = uint256(s.a[account].deposits[C.UNRIPE_BEAN][season].bdv)
            .add(legacyAmount.mul(C.initialRecap()).div(1e18));
    }

    function removeUnripeLPDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) internal returns (uint256 bdv) {
        bdv = _removeUnripeLPDeposit(account, id, amount);
        bdv = bdv.mul(C.initialRecap()).div(1e18);
    }

    function _removeUnripeLPDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) private returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (uint256 amount1, uint256 bdv1) = getBeanEthUnripeLP(account, id);
        if (amount1 >= amount) {
            uint256 removed = amount.mul(s.a[account].lp.deposits[id]).div(
                amount1
            );
            s.a[account].lp.deposits[id] = s.a[account].lp.deposits[id].sub(
                removed
            );
            removed = amount.mul(bdv1).div(amount1);
            s.a[account].lp.depositSeeds[id] = s
                .a[account]
                .lp
                .depositSeeds[id]
                .sub(removed.mul(4));
            return removed;
        }
        amount -= amount1;
        bdv = bdv1;
        delete s.a[account].lp.depositSeeds[id];
        delete s.a[account].lp.deposits[id];

        (amount1, bdv1) = getBean3CrvUnripeLP(account, id);
        if (amount1 >= amount) {
            Account.Deposit storage d = s.a[account].deposits[
                C.unripeLPPool1()
            ][id];
            uint128 removed = uint128(amount.mul(d.amount).div(amount1));
            s.a[account].deposits[C.unripeLPPool1()][id].amount = d.amount.sub(
                removed
            );
            removed = uint128(amount.mul(d.bdv).div(amount1));
            s.a[account].deposits[C.unripeLPPool1()][id].bdv = d.bdv.sub(
                removed
            );
            return bdv.add(removed);
        }
        amount -= amount1;
        bdv = bdv.add(bdv1);
        delete s.a[account].deposits[C.unripeLPPool1()][id];

        (amount1, bdv1) = getBeanLusdUnripeLP(account, id);
        if (amount1 >= amount) {
            Account.Deposit storage d = s.a[account].deposits[
                C.unripeLPPool2()
            ][id];
            uint128 removed = uint128(amount.mul(d.amount).div(amount1));
            s.a[account].deposits[C.unripeLPPool2()][id].amount = d.amount.sub(
                removed
            );
            removed = uint128(amount.mul(d.bdv).div(amount1));
            s.a[account].deposits[C.unripeLPPool2()][id].bdv = d.bdv.sub(
                removed
            );
            return bdv.add(removed);
        }
        revert("Silo: Crate balance too low.");
    }

    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == C.UNRIPE_LP;
    }

    function unripeLPDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (amount, bdv) = getBeanEthUnripeLP(account, season);
        (uint256 amount1, uint256 bdv1) = getBean3CrvUnripeLP(account, season);
        (uint256 amount2, uint256 bdv2) = getBeanLusdUnripeLP(account, season);

        amount = uint256(
            s.a[account].deposits[C.UNRIPE_LP][season].amount
        ).add(amount.add(amount1).add(amount2));

        uint256 legBdv = bdv.add(bdv1).add(bdv2).mul(C.initialRecap()).div(
            C.precision()
        );
        bdv = uint256(s.a[account].deposits[C.UNRIPE_LP][season].bdv)
            .add(legBdv);
    }

    function getBeanEthUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = s.a[account].lp.depositSeeds[season].div(4);
        amount = s
            .a[account]
            .lp
            .deposits[season]
            .mul(AMOUNT_TO_BDV_BEAN_ETH)
            .div(1e18);
    }

    function getBeanLusdUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool2()][season].bdv);
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool2()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_LUSD).div(C.precision());
    }

    function getBean3CrvUnripeLP(address account, uint32 season)
        private
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bdv = uint256(s.a[account].deposits[C.unripeLPPool1()][season].bdv);
        amount = uint256(
            s.a[account].deposits[C.unripeLPPool1()][season].amount
        ).mul(AMOUNT_TO_BDV_BEAN_3CRV).div(C.precision());
    }
}
