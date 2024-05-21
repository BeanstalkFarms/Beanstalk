/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma abicoder v2;

import {AppStorage, System} from "contracts/beanstalk/AppStorage.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {C} from "contracts/C.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";

/**
 * @title Silo
 * @author Publius, Pizzaman1337, Brean
 * @notice Provides utility functions for claiming Silo rewards, including:
 *
 * - Grown Stalk (see "Mow")
 * - Earned Beans, Earned Stalk (see "Plant")
 * - Tokens earned during a Flood (see "Flood")
 *
 * For backwards compatibility, a Flood is sometimes referred to by its old name
 * "Season of Plenty".
 */

contract Silo is ReentrancyGuard {
    using LibRedundantMath256 for uint256;
    using SafeERC20 for IERC20;
    using LibRedundantMath128 for uint128;

    //////////////////////// EVENTS ////////////////////////

    /**
     * @notice Emitted when the deposit associated with the Earned Beans of
     * `account` are Planted.
     * @param account Owns the Earned Beans
     * @param beans The amount of Earned Beans claimed by `account`.
     */
    event Plant(address indexed account, uint256 beans);

    /**
     * @notice Emitted when Token paid to `account` during a Flood is Claimed.
     * @param account Owns and receives the assets paid during a Flood.
     * @param plenty The amount of Token claimed by `account`. This is the amount
     * that `account` has been paid since their last {ClaimPlenty}.
     *
     * @dev Flood was previously called a "Season of Plenty". For backwards
     * compatibility, the event has not been changed. For more information on
     * Flood, see: {Weather.sop}.
     */
    event ClaimPlenty(address indexed account, address token, uint256 plenty);

    /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots The change in Roots.
     *
     * @dev {StalkBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred AND
     * anytime an account Mows Grown Stalk.
     * @dev BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);

    //////////////////////// INTERNAL: MOW ////////////////////////

    /**
     * @dev Claims the Grown Stalk for user. Requires token address to mow.
     */
    modifier mowSender(address token) {
        LibSilo._mow(LibTractor._user(), token);
        _;
    }

    //////////////////////// INTERNAL: PLANT ////////////////////////

    /**
     * @dev Plants the Plantable BDV of `account` associated with its Earned
     * Beans.
     *
     * For more info on Planting, see: {SiloFacet-plant}
     */

    function _plant(address account) internal returns (uint256 beans, int96 stemTip) {
        // Need to Mow for `account` before we calculate the balance of
        // Earned Beans.

        LibSilo._mow(account, C.BEAN);
        uint256 accountStalk = s.accounts[account].silo.stalk;

        // Calculate balance of Earned Beans.
        beans = LibSilo._balanceOfEarnedBeans(accountStalk, s.accounts[account].roots);
        stemTip = LibTokenSilo.stemTipForToken(C.BEAN);
        if (beans == 0) return (0, stemTip);

        // Reduce the Silo's supply of Earned Beans.
        // SafeCast unnecessary because beans is <= s.earnedBeans.
        s.earnedBeans = s.earnedBeans.sub(uint128(beans));

        // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.
        LibTokenSilo.addDepositToAccount(
            account,
            C.BEAN,
            stemTip,
            beans, // amount
            beans, // bdv
            LibTokenSilo.Transfer.emitTransferSingle
        );

        // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).
        // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.
        // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.
        // The following lines allocate Earned Stalk that has already been minted to `account`.
        // Constant is used here rather than s.siloSettings[BEAN].stalkIssuedPerBdv
        // for gas savings.
        uint256 stalk = beans.mul(C.STALK_PER_BEAN);
        s.accounts[account].silo.stalk = accountStalk.add(stalk);

        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }

    //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

    /**
     * @dev Gas optimization: An account can call `{SiloFacet:claimPlenty}` even
     * if `s.accounts[account].sop.plenty == 0`. This would emit a ClaimPlenty event
     * with an amount of 0.
     */
    function _claimPlenty(address account) internal {
        // Plenty is earned in the form of the non-Bean token in the SOP Well.
        uint256 plenty = s.accounts[account].sop.plenty;
        IERC20 sopToken = LibSilo.getSopToken();
        sopToken.safeTransfer(account, plenty);
        delete s.accounts[account].sop.plenty;
        s.plenty -= plenty;

        emit ClaimPlenty(account, address(sopToken), plenty);
    }
}
