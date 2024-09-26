// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {GerminationSide} from "contracts/beanstalk/storage/System.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {BeanstalkERC20} from "contracts/tokens/ERC20/BeanstalkERC20.sol";

/**
 * @author funderbrker
 * @title Invariable
 * @notice Implements modifiers that maintain protocol wide invariants.
 * @dev Every external writing function should use as many non-redundant invariant modifiers as possible.
 * @dev https://www.nascent.xyz/idea/youre-writing-require-statements-wrong
 **/
abstract contract Invariable {
    using LibRedundantMath256 for uint256;
    using LibRedundantMathSigned256 for int256;
    using SafeCast for uint256;

    /**
     * @notice Ensures all user asset entitlements are coverable by contract balances.
     * @dev Should be used on every function that can write. Excepting Diamond functions.
     */
    modifier fundsSafu() {
        _;
        address[] memory tokens = getTokensOfInterest();
        (
            uint256[] memory entitlements,
            uint256[] memory balances
        ) = getTokenEntitlementsAndBalances(tokens);
        for (uint256 i; i < tokens.length; i++) {
            require(balances[i] >= entitlements[i], "INV: Insufficient token balance");
        }
    }

    /**
     * @notice Watched token balances do not change and Stalk does not decrease.
     * @dev Applicable to the majority of functions, excepting functions that explicitly move assets.
     * @dev Roughly akin to a view only check where only routine modifications are allowed (ie mowing).
     */
    modifier noNetFlow() {
        uint256 initialStalk = LibAppStorage.diamondStorage().sys.silo.stalk;
        address[] memory tokens = getTokensOfInterest();
        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);
        _;
        uint256[] memory finalProtocolTokenBalances = getTokenBalances(tokens);

        require(
            LibAppStorage.diamondStorage().sys.silo.stalk >= initialStalk,
            "INV: noNetFlow Stalk decreased"
        );
        for (uint256 i; i < tokens.length; i++) {
            require(
                initialProtocolTokenBalances[i] == finalProtocolTokenBalances[i],
                "INV: noNetFlow Token balance changed"
            );
        }
    }

    /**
     * @notice Watched token balances do not decrease and Stalk does not decrease.
     * @dev Favor noNetFlow where applicable.
     */
    modifier noOutFlow() {
        uint256 initialStalk = LibAppStorage.diamondStorage().sys.silo.stalk;
        address[] memory tokens = getTokensOfInterest();
        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);
        _;
        uint256[] memory finalProtocolTokenBalances = getTokenBalances(tokens);

        require(
            LibAppStorage.diamondStorage().sys.silo.stalk >= initialStalk,
            "INV: noOutFlow Stalk decreased"
        );
        for (uint256 i; i < tokens.length; i++) {
            require(
                initialProtocolTokenBalances[i] <= finalProtocolTokenBalances[i],
                "INV: noOutFlow Token balance decreased"
            );
        }
    }

    /**
     * @notice All except one watched token balances do not decrease.
     * @dev Favor noNetFlow or noOutFlow where applicable.
     */
    modifier oneOutFlow(address outboundToken) {
        address[] memory tokens = getTokensOfInterest();
        uint256[] memory initialProtocolTokenBalances = getTokenBalances(tokens);
        _;
        uint256[] memory finalProtocolTokenBalances = getTokenBalances(tokens);

        for (uint256 i; i < tokens.length; i++) {
            if (tokens[i] == outboundToken) {
                continue;
            }
            require(
                initialProtocolTokenBalances[i] <= finalProtocolTokenBalances[i],
                "INV: oneOutFlow multiple token balances decreased"
            );
        }
    }

    /**
     * @notice Does not change the supply of Beans. No minting, no burning.
     * @dev Applies to all but a very few functions tht explicitly change supply.
     */
    modifier noSupplyChange() {
        // Storage is not defined due to stack too deep errors.
        uint256 initialSupply = BeanstalkERC20(LibAppStorage.diamondStorage().sys.tokens.bean)
            .totalSupply();
        _;
        require(
            BeanstalkERC20(LibAppStorage.diamondStorage().sys.tokens.bean).totalSupply() ==
                initialSupply,
            "INV: Supply changed"
        );
    }

    /**
     * @notice Supply of Beans does not increase. No minting.
     * @dev Prefer noSupplyChange where applicable.
     */
    modifier noSupplyIncrease() {
        uint256 initialSupply = BeanstalkERC20(LibAppStorage.diamondStorage().sys.tokens.bean)
            .totalSupply();
        _;
        require(
            BeanstalkERC20(LibAppStorage.diamondStorage().sys.tokens.bean).totalSupply() <=
                initialSupply,
            "INV: Supply increased"
        );
    }

    /**
     * @notice Which tokens to monitor in the invariants.
     */
    function getTokensOfInterest() internal view returns (address[] memory tokens) {
        address[] memory whitelistedTokens = LibWhitelistedTokens.getWhitelistedTokens();
        address[] memory sopTokens = LibWhitelistedTokens.getSopTokens();
        uint256 totalLength = whitelistedTokens.length + sopTokens.length;
        tokens = new address[](totalLength);

        for (uint256 i = 0; i < whitelistedTokens.length; i++) {
            tokens[i] = whitelistedTokens[i];
        }

        for (uint256 i = 0; i < sopTokens.length; i++) {
            tokens[whitelistedTokens.length + i] = sopTokens[i];
        }
    }

    /**
     * @notice Get the Beanstalk balance of an ERC20 token.
     */
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
                s.sys.silo.balances[tokens[i]].deposited +
                s.sys.silo.germinating[GerminationSide.ODD][tokens[i]].amount +
                s.sys.silo.germinating[GerminationSide.EVEN][tokens[i]].amount +
                s.sys.internalTokenBalanceTotal[IERC20(tokens[i])];
            if (tokens[i] == s.sys.tokens.bean) {
                entitlements[i] +=
                    (s.sys.fert.fertilizedIndex -
                        s.sys.fert.fertilizedPaidIndex +
                        s.sys.fert.leftoverBeans) + // unrinsed rinsable beans
                    s.sys.silo.unripeSettings[s.sys.tokens.urBean].balanceOfUnderlying + // unchopped underlying beans
                    s.sys.orderLockedBeans;
                for (uint256 j; j < s.sys.fieldCount; j++) {
                    entitlements[i] += (s.sys.fields[j].harvestable - s.sys.fields[j].harvested); // unharvested harvestable beans
                }
            } else if (tokens[i] == LibUnripe._getUnderlyingToken(s.sys.tokens.urLp)) {
                entitlements[i] += s.sys.silo.unripeSettings[s.sys.tokens.urLp].balanceOfUnderlying;
            }
            entitlements[i] += s.sys.sop.plentyPerSopToken[tokens[i]];
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
        return (entitlements, balances);
    }
}
