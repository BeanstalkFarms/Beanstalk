/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma abicoder v2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
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
import "contracts/libraries/Token/LibTransfer.sol";

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
}
