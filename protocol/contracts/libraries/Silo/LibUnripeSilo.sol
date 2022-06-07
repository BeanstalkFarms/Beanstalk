/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Lib Unripe Silo
 **/
library LibUnripeSilo {
    using SafeMath for uint256;

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
        b = token == C.unripeBeanAddress();
    }

    function unripeBeanDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].bean.deposits[season];
        amount = uint256(s.a[account].deposits[C.unripeBeanAddress()][season].amount).add(
                legacyAmount
            );
        bdv = uint256(s.a[account].deposits[C.unripeBeanAddress()][season].bdv).add(
            legacyAmount.mul(C.initialRecap()).div(1e18)
        );
    }

    function removeUnripeLPDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) internal returns (uint256 bdv) {
        _removeUnripeLPDeposit(account, id, amount);
        bdv = amount.mul(C.initialRecap()).div(1e18);
    }

    function _removeUnripeLPDeposit(
        address account,
        uint32 id,
        uint256 amount
    ) private {
        uint256 crateBDV;
        AppStorage storage s = LibAppStorage.diamondStorage();
        crateBDV = s.a[account].lp.depositSeeds[id].div(4);
        if (crateBDV >= amount) {
            // Safe math not necessary
            s.a[account].lp.depositSeeds[id] -= amount.mul(4);
            return;
        }
        amount -= crateBDV;
        delete s.a[account].lp.depositSeeds[id];

        crateBDV = s.a[account].deposits[C.unripeLPPool1()][id].bdv;
        if (crateBDV >= amount) {
            // Safe math not necessary
            s.a[account].deposits[C.unripeLPPool1()][id].bdv -= uint128(
                amount
            );
            return;
        }
        amount -= crateBDV;
        delete s.a[account].deposits[C.unripeLPPool1()][id].bdv;

        crateBDV = s.a[account].deposits[C.unripeLPPool2()][id].bdv;
        if (crateBDV >= amount) {
            // Safe math not necessary
            s.a[account].deposits[C.unripeLPPool2()][id].bdv -= uint128(amount);
            return;
        }
        revert("Silo: Crate balance too low.");
    }

    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == C.unripeLPAddress();
    }

    function unripeLPDeposit(address account, uint32 season)
        internal
        view
        returns (uint256 amount, uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].lp.depositSeeds[season].div(4).add(
            uint256(s.a[account].deposits[C.unripeLPPool1()][season].bdv).add(
                uint256(s.a[account].deposits[C.unripeLPPool2()][season].bdv)
            )
        );
        amount = uint256(s.a[account].deposits[C.unripeLPAddress()][season].amount).add(
            legacyAmount
        );
        bdv = uint256(s.a[account].deposits[C.unripeLPAddress()][season].bdv).add(
            legacyAmount.mul(C.initialRecap()).div(1e18)
        );
    }
}
