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
        {
            //// PRE CHECK IS FOR TESTING PURPOSES ONLY
            address[] memory tokens = LibWhitelistedTokens.getSiloTokens();
            (
                uint256[] memory entitlements,
                uint256[] memory balances
            ) = getTokenEntitlementsAndBalances(tokens);
            for (uint256 i; i < tokens.length; i++) {
                require(balances[i] >= entitlements[i], "INV: PRECHECK Insufficient token balance");
            }
        }
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

    /**
     * @notice Does not change the supply of Beans. No minting, no burning.
     * @dev Applies to all but a very few functions. Sunrise, sow, raise.
     */
    modifier noSupplyChange() {
        uint256 initialSupply = C.bean().totalSupply();
        _;
        require(C.bean().totalSupply() == initialSupply, "INV: Supply changed");
    }

    // Stalk does not decrease and and whitelisted token balances (including Bean) do not change.
    // Many operations will increase Stalk.
    // There are a relatively small number of external functions that will cause a change in token balances of contract.
    // Roughly akin to a view only check where only routine modifications are allowed (ie mowing).
    // modifier upOnlyWithHaste() {
    modifier noNetFlow() {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 initialStalk = s.s.stalk;
        address[] memory tokens = LibWhitelistedTokens.getSiloTokens();
        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);
        _;
        uint256[] memory finalProtocolTokenBalances = getTokenBalances(tokens);

        require(s.s.stalk >= initialStalk, "INV: Stalk decreased");
        for (uint256 i; i < tokens.length; i++) {
            require(
                initialProtocolTokenBalances[i] == finalProtocolTokenBalances[i],
                "INV: Token balance changed"
            );
        }
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
        console.log("Balance of underlying Bean: %s", s.u[C.UNRIPE_BEAN].balanceOfUnderlying);
        console.log("fertilized index: %s", s.fertilizedIndex);
        for (uint256 i; i < tokens.length; i++) {
            entitlements[i] =
                s.siloBalances[tokens[i]].deposited +
                s.siloBalances[tokens[i]].withdrawn +
                s.internalTokenBalanceTotal[IERC20(tokens[i])];
            if (tokens[i] == C.BEAN) {
                // total of Bean in Silo + total earned Beans + unharvested harvestable Beans + user internal balances of Beans.
                entitlements[i] +=
                    s.earnedBeans + // unmowed earned beans
                    s.f.harvestable.sub(s.f.harvested) + // unharvestable harvestable beans
                    s.fertilizedIndex.sub(s.fertilizedPaidIndex) + // unrinsed rinsable beans
                    s.u[C.UNRIPE_BEAN].balanceOfUnderlying; // unchopped underlying beans
            }
            // TODO: BUG: Bean entitlement too high (not even yet accounting for internal balance)

            // TODO: BUG: Some Asset entitlements too low (well LP, unripe Bean, unripe LP) (curve LP ok)
            // ^^ This is likely due to a lack of accounting for internal balances
            // Farm balances, according to subgraph 4/11/24
            // 0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449 - 9001888 - 9.001888
            // 0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d - 12672419462 - 12672.419462
            // 0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab - 408471693908 - 408471.693908
            // 0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49 - 9238364833184139286 - 9.238364833184139286
            // 
            /*

            Token: 0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab, Entitlement: 25892305957831, Balance: 25791876588501
            Excess: 115792089237316195423570985008687907853269984665640564039457584007812700270606
            Deposited: 2749101805317, Withdrawn: 10859391082, Internal: 0
            Token: 0xbea0e11282e2bb5893bece110cf199501e872bad, Entitlement: 9845022928568702674655, Balance: 276659959868747681489302
            Excess: 266814936940178978814647
            Deposited: 9845022928568702674655, Withdrawn: 0, Internal: 0
            Token: 0xc9c32cd16bf7efb85ff14e0c8603cc90f6f2ee49, Entitlement: 171538352193698918465170, Balance: 171547590558532102604456
            Excess: 9238364833184139286
            Deposited: 168502095858553402384583, Withdrawn: 3036256335145516080587, Internal: 0
            Token: 0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449, Entitlement: 85149896356334, Balance: 98418008509698
            Excess: 13268112153364
            Deposited: 84670872604140, Withdrawn: 479023752194, Internal: 0
            Token: 0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d, Entitlement: 93036285535468, Balance: 95620212845500
            Excess: 2583927310032
            Deposited: 92199302958735, Withdrawn: 836982576733, Internal: 0

            */
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
            console.log("Token: %s, Entitlement: %s, Balance: %s", tokens[i], entitlements[i], balances[i]);
            console.log("Excess: %s", balances[i] - entitlements[i]);
            console.log("Deposited: %s, Withdrawn: %s, Internal: %s", s.siloBalances[tokens[i]].deposited, s.siloBalances[tokens[i]].withdrawn, s.internalTokenBalanceTotal[IERC20(tokens[i])]);
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
