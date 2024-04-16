// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

import {console} from "hardhat/console.sol";

/**
 * @author Beanstalk Farms
 * @title Invariable
 * @notice Implements modifiers to maintain protocol wide invariants.
 * @dev Every external function should use as many invariant modifiers as possible.
 * @dev https://www.nascent.xyz/idea/youre-writing-require-statements-wrong
 **/
abstract contract Invariable {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeCast for uint256;

    /**
     * @notice Ensures all user asset entitlements are coverable by contract balances.
     * @dev Should be used on every function that can write.
     * @dev Does not include tokens that may be held in internal balances but not Silo whitelisted.
     */
    modifier fundsSafu() {
        _;
        address[] memory tokens = LibWhitelistedTokens.getSiloTokens();
        (
            uint256[] memory entitlements,
            uint256[] memory balances
        ) = getTokenEntitlementsAndBalances(tokens);
        for (uint256 i; i < tokens.length; i++) {
            require(balances[i] >= entitlements[i], "INV: Insufficient token balance");
        }
    }

    // Stalk does not decrease and and whitelisted token balances (including Bean) do not change.
    // Many operations will increase Stalk.
    // There are a relatively small number of external functions that will cause a change in token balances of contract.
    // Roughly akin to a view only check where only routine modifications are allowed (ie mowing).
    /// @dev Attempt to minimize effect on stack depth.
    modifier noNetFlow() {
        uint256 initialStalk = LibAppStorage.diamondStorage().s.stalk;
        address[] memory tokens = LibWhitelistedTokens.getSiloTokens();
        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);

        _;

        uint256[] memory finalProtocolTokenBalances = getTokenBalances(tokens);
        require(LibAppStorage.diamondStorage().s.stalk >= initialStalk, "INV: Stalk decreased");
        for (uint256 i; i < tokens.length; i++) {
            require(
                initialProtocolTokenBalances[i] == finalProtocolTokenBalances[i],
                "INV: Token balance changed"
            );
        }
    }

    /**
     * @notice Does not change the supply of Beans. No minting, no burning.
     * @dev Applies to all but a very few functions. Sunrise, sow, raise.
     */
    modifier noSupplyChange() {
        uint256 initialSupply = C.bean().totalSupply();
        _;
        require(C.bean().totalSupply() == initialSupply, "INV: Supply changed");
    }

    function getTokenBalances(
        address[] memory tokens
    ) internal view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
        return balances;
    }

    /**
     * @notice Get protocol level entitlements and balances for all tokens.
     */
    function getTokenEntitlementsAndBalances(
        address[] memory tokens
    ) internal view returns (uint256[] memory entitlements, uint256[] memory balances) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        entitlements = new uint256[](tokens.length);
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            entitlements[i] =
                s.siloBalances[tokens[i]].deposited +
                s.siloBalances[tokens[i]].withdrawn +
                s.internalTokenBalanceTotal[IERC20(tokens[i])];
            if (tokens[i] == C.BEAN) {
                // total of Bean in Silo + total earned Beans + unharvested harvestable Beans + user internal balances of Beans.
                entitlements[i] +=
                    // s.earnedBeans + // unmowed earned beans // NOTE: This is a double count with deposited balance
                    s.f.harvestable.sub(s.f.harvested) + // unharvestable harvestable beans
                    s.fertilizedIndex.sub(s.fertilizedPaidIndex) + // unrinsed rinsable beans
                    s.u[C.UNRIPE_BEAN].balanceOfUnderlying; // unchopped underlying beans
            }
            // NOTE: Asset entitlements too low due to a lack of accounting for internal balances. Balances need init.
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
        return (entitlements, balances);
    }
}

//////////////////// Scratch pad  ///////////////////////
/*
    // NOTE may be incompatible with SOP.
    // NOTE difficult/intensive, since pods are not iterable by user.
    //
    // @notice Ensure protocol balances change in tandem with user balances.
    // @dev Should be used on every function that can write and does not use noNetFlow modifier.
    //
    modifier reasonableFlow() {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory tokens = LibWhitelistedTokens.getSiloTokens();

        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);
        uint256[] memory initialUserTokenEntitlements = getUserTokenEntitlements(tokens, msg.sender);
        _;
        uint256[] memory finalProtocolTokenBalances = getTokenBalances();
        uint256[] memory finalUserTokenEntitlements = getUserTokenEntitlements(msg.sender);
        uint256 finalProtocolBeanBalance = C.bean().balanceOf(address(this));
        uint256 finalUserBeanEntitlement = getUserBeanEntitlement(msg.sender);

        for (uint256 i; i < tokens.length; i++) {
            if(tokens[i] == C.bean()) {
                continue;
            }
            int256 userTokenDelta = finalUserTokenEntitlements[i].toInt256().sub(initialUserTokenEntitlements[i].toInt256());
            int256 protocolTokenDelta = finalProtocolTokenBalances[i].toInt256().sub(initialProtocolTokenBalances[i].toInt256());
            // NOTE off by one errors when rounding?
            require(
                userTokenDelta == protocolTokenDelta, "INV: flow imbalance"
            );
        }
        int256 userBeanEntitlementDelta = finalUserBeanEntitlement.toInt256().sub(initialUserBeanEntitlement.toInt256());
        int256 protocolBeanDelta = finalProtocolBeanBalance.toInt256().sub(initialProtocolBeanBalance.toInt256());
        if (userBeanDelta >= 0) {
            require 
        require(
            finalUserBeanEntitlement.toInt256().sub(initialUserBeanEntitlement.toInt256()) ==
                C.bean().balanceOf(address(this)).sub(s.s.stalk),
            "INV: Bean flow imbalance"
        );
    }
    }

    function getUserTokenEntitlements(address[] memory tokens, address user) internal view returns (uint256[] memory entitlements) {
        entitlements = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            entitlements[i] = s.siloBalances[tokens[i]].deposited[user] + s.siloBalances[tokens[i]].withdrawn[user] + s.internalTokenBalance[user][tokens[i]];
            if (tokens[i] == C.bean()) {
                // total of Bean in Silo + total earned Beans + unharvested harvestable Beans + user internal balances of Beans.
                // NOTE difficult/intensive, since pods are not iterable by user.
                entitlements[i] += s.earnedBeans + s.f.harvestable.sub(s.f.harvested);
            }
        }
        return entitlements;
    }
*/
