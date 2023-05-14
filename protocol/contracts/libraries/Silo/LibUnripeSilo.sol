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

    /**
     * @dev Deletes the legacy Bean storage reference for a given `account` and `id`.
     */
    function removeUnripeBeanDeposit(
        address account,
        uint32 id
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        delete s.a[account].bean.deposits[id];
    }

    function isUnripeBean(address token) internal pure returns (bool b) {
        b = token == C.UNRIPE_BEAN;
    }

    /**
     * @dev Returns the whole Unripe Bean Deposit for a given `account` and `season`.
     * Includes non-legacy balance.
     */
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

    /**
     * @dev Deletes all legacy LP storage references for a given `account` and `id`.
     */
    function removeUnripeLPDeposit(
        address account,
        uint32 id
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        delete s.a[account].lp.depositSeeds[id];
        delete s.a[account].lp.deposits[id];
        delete s.a[account].deposits[C.unripeLPPool1()][id];
        delete s.a[account].deposits[C.unripeLPPool2()][id];
    }

    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == C.UNRIPE_LP;
    }

    /**
     * @dev Returns the whole Unripe LP Deposit for a given `account` and `season`.
     * Includes non-legacy balance.
     */
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
