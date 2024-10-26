// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {IBean} from "../interfaces/IBean.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {C} from "../C.sol";
import {LibWell} from "./Well/LibWell.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {IWellFunction} from "contracts/interfaces/basin/IWellFunction.sol";
import {LibLockedUnderlying} from "./LibLockedUnderlying.sol";
import {LibFertilizer} from "./LibFertilizer.sol";

/**
 * @title LibUnripe
 * @author Publius
 * @notice Library for handling functionality related to Unripe Tokens and their Ripe Tokens.
 */
library LibUnripe {
    using LibRedundantMath256 for uint256;

    event ChangeUnderlying(address indexed token, int256 underlying);
    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);

    uint256 constant DECIMALS = 1e6;

    /**
     * @notice Returns the percentage that Unripe Beans have been recapitalized.
     */
    function percentBeansRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            s.sys.silo.unripeSettings[s.sys.tokens.urBean].balanceOfUnderlying.mul(DECIMALS).div(
                IERC20(s.sys.tokens.urBean).totalSupply()
            );
    }

    /**
     * @notice Returns the percentage that Unripe LP have been recapitalized.
     */
    function percentLPRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            C.unripeLPPerDollar().mul(s.sys.fert.recapitalized).div(
                IERC20(s.sys.tokens.urLp).totalSupply()
            );
    }

    /**
     * @notice Increments the underlying balance of an Unripe Token.
     * @param token The address of the unripe token.
     * @param amount The amount of the of the unripe token to be added to the storage reserves
     */
    function incrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.silo.unripeSettings[token].balanceOfUnderlying = s
            .sys
            .silo
            .unripeSettings[token]
            .balanceOfUnderlying
            .add(amount);
        emit ChangeUnderlying(token, int256(amount));
    }

    /**
     * @notice Decrements the underlying balance of an Unripe Token.
     * @param token The address of the Unripe Token.
     * @param amount The amount of the of the Unripe Token to be removed from storage reserves
     */
    function decrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.silo.unripeSettings[token].balanceOfUnderlying = s
            .sys
            .silo
            .unripeSettings[token]
            .balanceOfUnderlying
            .sub(amount);
        emit ChangeUnderlying(token, -int256(amount));
    }

    /**
     * @notice Calculates the amount of Ripe Tokens that underly a given amount of Unripe Tokens.
     * @param unripeToken The address of the Unripe Token
     * @param unripe The amount of Unripe Tokens.
     * @return underlying The amount of Ripe Tokens that underly the Unripe Tokens.
     */
    function unripeToUnderlying(
        address unripeToken,
        uint256 unripe,
        uint256 supply
    ) internal view returns (uint256 underlying) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        underlying = s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying.mul(unripe).div(
            supply
        );
    }

    /**
     * @notice Calculates the amount of Unripe Tokens that are underlaid by a given amount of Ripe Tokens.
     * @param unripeToken The address of the Unripe Tokens.
     * @param underlying The amount of Ripe Tokens.
     * @return unripe The amount of the of the Unripe Tokens that are underlaid by the Ripe Tokens.
     */
    function underlyingToUnripe(
        address unripeToken,
        uint256 underlying
    ) internal view returns (uint256 unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = IBean(unripeToken).totalSupply().mul(underlying).div(
            s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying
        );
    }

    /**
     * @notice Adds Ripe Tokens to an Unripe Token. Also, increments the recapitalized
     * amount proportionally if the Unripe Token is Unripe LP.
     * @param token The address of the Unripe Token to add Ripe Tokens to.
     * @param underlying The amount of the of the underlying token to be taken as input.
     */
    function addUnderlying(address token, uint256 underlying) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (token == s.sys.tokens.urLp) {
            uint256 recapped = underlying.mul(s.sys.fert.recapitalized).div(
                s.sys.silo.unripeSettings[s.sys.tokens.urLp].balanceOfUnderlying
            );
            s.sys.fert.recapitalized = s.sys.fert.recapitalized.add(recapped);
        }
        incrementUnderlying(token, underlying);
    }

    /**
     * @notice Removes Ripe Tokens from an Unripe Token. Also, decrements the recapitalized
     * amount proportionally if the Unripe Token is Unripe LP.
     * @param token The address of the unripe token to be removed.
     * @param underlying The amount of the of the underlying token to be removed.
     */
    function removeUnderlying(address token, uint256 underlying) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (token == s.sys.tokens.urLp) {
            uint256 recapped = underlying.mul(s.sys.fert.recapitalized).div(
                s.sys.silo.unripeSettings[s.sys.tokens.urLp].balanceOfUnderlying
            );
            s.sys.fert.recapitalized = s.sys.fert.recapitalized.sub(recapped);
        }
        decrementUnderlying(token, underlying);
    }

    /**
     * @dev Switches the underlying token of an unripe token.
     * Should only be called if `s.silo.unripeSettings[unripeToken].balanceOfUnderlying == 0`.
     */
    function switchUnderlyingToken(address unripeToken, address newUnderlyingToken) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.sys.silo.unripeSettings[unripeToken].underlyingToken = newUnderlyingToken;
        emit SwitchUnderlyingToken(unripeToken, newUnderlyingToken);
    }

    /**
     * @notice Calculates the the penalized amount of Ripe Tokens corresponding to
     * the amount of Unripe Tokens that are Chopped according to the current Chop Rate.
     * The new chop rate is %Recapitalized^2.
     */
    function getPenalizedUnderlying(
        address unripeToken,
        uint256 amount,
        uint256 supply
    ) internal view returns (uint256 redeem) {
        require(isUnripe(unripeToken), "not vesting");
        AppStorage storage s = LibAppStorage.diamondStorage();
        // getTotalRecapDollarsNeeded() queries for the total urLP supply which is burned upon a chop
        // If the token being chopped is unripeLP, getting the current supply here is inaccurate due to the burn
        // Instead, we use the supply passed in as an argument to getTotalRecapDollarsNeeded since the supply variable
        // here is the total urToken supply queried before burnning the unripe token
        uint256 totalUsdNeeded = unripeToken == s.sys.tokens.urLp
            ? LibFertilizer.getTotalRecapDollarsNeeded(supply)
            : LibFertilizer.getTotalRecapDollarsNeeded();
        // chop rate = total redeemable * (%DollarRecapitalized)^2 * share of unripe tokens
        // redeem = totalRipeUnderlying * (usdValueRaised/totalUsdNeeded)^2 * UnripeAmountIn/UnripeSupply;
        // But totalRipeUnderlying = CurrentUnderlying * totalUsdNeeded/usdValueRaised to get the total underlying
        // redeem = currentRipeUnderlying * (usdValueRaised/totalUsdNeeded) * UnripeAmountIn/UnripeSupply
        uint256 underlyingAmount = s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying;
        if (totalUsdNeeded == 0) {
            // when totalUsdNeeded == 0, the barnraise has been fully recapitalized.
            redeem = underlyingAmount.mul(amount).div(supply);
        } else {
            redeem = underlyingAmount
                .mul(s.sys.fert.recapitalized)
                .div(totalUsdNeeded)
                .mul(amount)
                .div(supply);
        }

        // cap `redeem to `balanceOfUnderlying in the case that `s.recapitalized` exceeds `totalUsdNeeded`.
        // this can occur due to unripe LP chops.
        if (redeem > underlyingAmount) redeem = underlyingAmount;
    }

    /**
     * @notice returns the total percentage that beanstalk has recapitalized.
     * @dev this is calculated by the ratio of s.recapitalized and the total dollars the barnraise needs to raise.
     * returns the same precision as `getRecapPaidPercentAmount` (100% recapitalized = 1e6).
     */
    function getTotalRecapitalizedPercent() internal view returns (uint256 recapitalizedPercent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalUsdNeeded = LibFertilizer.getTotalRecapDollarsNeeded();
        if (totalUsdNeeded == 0) {
            return 1e6; // if zero usd needed, full recap has happened
        }
        return s.sys.fert.recapitalized.mul(DECIMALS).div(totalUsdNeeded);
    }

    /**
     * @notice Returns the amount of beans that are locked in the unripe token.
     * @dev Locked beans are the beans that are forfeited if the unripe token is chopped.
     * @param reserves the reserves of the LP that underly the unripe token.
     * @dev reserves are used as a parameter for gas effiency purposes (see LibEvaluate.calcLPToSupplyRatio}.
     */
    function getLockedBeans(
        uint256[] memory reserves
    ) internal view returns (uint256 lockedAmount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        lockedAmount = LibLockedUnderlying
            .getLockedUnderlying(s.sys.tokens.urBean, getTotalRecapitalizedPercent())
            .add(getLockedBeansFromLP(reserves));
    }

    /**
     * @notice Returns the amount of beans that are locked in the unripeLP token.
     * @param reserves the reserves of the LP that underly the unripe token.
     */
    function getLockedBeansFromLP(
        uint256[] memory reserves
    ) internal view returns (uint256 lockedBeanAmount) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // if reserves return 0, then skip calculations.
        if (reserves[0] == 0) return 0;
        uint256 lockedLpAmount = LibLockedUnderlying.getLockedUnderlying(
            s.sys.tokens.urLp,
            getTotalRecapitalizedPercent()
        );
        address underlying = s.sys.silo.unripeSettings[s.sys.tokens.urLp].underlyingToken;
        uint256 beanIndex = LibWell.getBeanIndexFromWell(underlying);

        // lpTokenSupply is calculated rather than calling totalSupply(),
        // because the Well's lpTokenSupply is not MEV resistant.
        Call memory wellFunction = IWell(underlying).wellFunction();
        uint lpTokenSupply = IWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );
        lockedBeanAmount = lockedLpAmount.mul(reserves[beanIndex]).div(lpTokenSupply);
    }

    /**
     * @notice Calculates the penalized amount based the amount of Sprouts that are Rinsable
     * or Rinsed (Fertilized).
     * @param amount The amount of the Unripe Tokens.
     * @return penalizedAmount The penalized amount of the Ripe Tokens received from Chopping.
     */
    function getRecapPaidPercentAmount(
        uint256 amount
    ) internal view returns (uint256 penalizedAmount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.sys.fert.fertilizedIndex.mul(amount).div(s.sys.fert.unfertilizedIndex);
    }

    /**
     * @notice Returns true if the token is unripe.
     */
    function isUnripe(address unripeToken) internal view returns (bool unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = s.sys.silo.unripeSettings[unripeToken].underlyingToken != address(0);
    }

    /**
     * @notice Returns the underlying token amount of the unripe token.
     */
    function _getUnderlying(
        address unripeToken,
        uint256 amount,
        uint256 supply
    ) internal view returns (uint256 redeem) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        redeem = s.sys.silo.unripeSettings[unripeToken].balanceOfUnderlying.mul(amount).div(supply);
    }

    function _getUnderlyingToken(
        address unripeToken
    ) internal view returns (address underlyingToken) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.sys.silo.unripeSettings[unripeToken].underlyingToken;
    }

    function getTotalRecapDollarsNeeded() internal view returns (uint256 totalUsdNeeded) {
        return LibFertilizer.getTotalRecapDollarsNeeded();
    }
}
