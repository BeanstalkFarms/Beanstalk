/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Lib Unripe Silo
**/
library LibUnripeSilo {

    using SafeMath for uint256;

    address constant UNRIPE_BEAN = address(0);
    address constant UNRIPE_LP = address(0);

    uint256 constant UNRIPE_BEAN_BDV = 1e18;
    uint256 constant UNRIPE_LP_BDV = 1e18;

    address constant BEAN_3CURVE_ADDRESS = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
    address constant BEAN_LUSD_ADDRESS = address(0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA);

    function removeUnripeBeanDeposit(address account, uint32 id, uint256 amount) internal returns (uint256 bdv) {
        _removeUnripeBeanDeposit(account, id, amount);
        bdv = amount.mul(UNRIPE_BEAN_BDV).div(1e18);
    }

    function _removeUnripeBeanDeposit(address account, uint32 id, uint256 amount)
        private
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 crateBDV = s.a[account].bean.deposits[id];
        if (crateBDV >= amount) {
            s.a[account].bean.deposits[id] -= amount;
            return;
        }
        require(amount == crateBDV, "Unripe: Crate empty");
        delete s.a[account].bean.deposits[id];
    }

    function isUnripeBean(address token) internal pure returns (bool b) {
        b = token == UNRIPE_BEAN;
    }
    
    function unripeBeanDeposit(address account, uint32 season) internal view returns (uint256 amount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].bean.deposits[season];
        amount = uint256(s.a[account].deposits[UNRIPE_BEAN][season].amount).add(legacyAmount);
        bdv =  uint256(s.a[account].deposits[UNRIPE_BEAN][season].bdv).add(amount.mul(UNRIPE_BEAN_BDV).div(1e18));
    }

    function removeUnripeLPDeposit(address account, uint32 id, uint256 amount) internal returns (uint256 bdv) {
        _removeUnripeLPDeposit(account, id, amount);
        bdv = amount.mul(UNRIPE_LP_BDV).div(1e18);
    }

    function _removeUnripeLPDeposit(address account, uint32 id, uint256 amount)
        private
    {
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

        crateBDV = s.a[account].deposits[BEAN_3CURVE_ADDRESS][id].bdv;
        if (crateBDV >= amount) {
            // Safe math not necessary
            s.a[account].deposits[BEAN_3CURVE_ADDRESS][id].bdv -= uint128(amount);
            return;
        }
        amount -= crateBDV;
        delete s.a[account].deposits[BEAN_3CURVE_ADDRESS][id].bdv;

        crateBDV = s.a[account].deposits[BEAN_LUSD_ADDRESS][id].bdv;
        if (crateBDV >= amount) {
            // Safe math not necessary
             s.a[account].deposits[BEAN_LUSD_ADDRESS][id].bdv -= uint128(amount);
            return;
        }
        require(amount == crateBDV, "Unripe: Crate empty");
        amount -= crateBDV;
        delete s.a[account].deposits[BEAN_LUSD_ADDRESS][id].bdv;
    }
    
    function isUnripeLP(address token) internal pure returns (bool b) {
        b = token == UNRIPE_LP;
    }

    function unripeLPDeposit(address account, uint32 season) internal view returns (uint256 amount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 legacyAmount = s.a[account].lp.depositSeeds[season].div(4).add(
            uint256(s.a[account].deposits[BEAN_3CURVE_ADDRESS][season].bdv).add(
            uint256(s.a[account].deposits[BEAN_LUSD_ADDRESS][season].bdv)
        ));
        amount = uint256(s.a[account].deposits[UNRIPE_LP][season].amount).add(legacyAmount);
        bdv =  uint256(s.a[account].deposits[UNRIPE_LP][season].bdv).add(amount.mul(UNRIPE_LP_BDV).div(1e18));
    }

    function isUnripe(address token) internal pure returns (bool b) {
        b = token == UNRIPE_LP;
    }
}