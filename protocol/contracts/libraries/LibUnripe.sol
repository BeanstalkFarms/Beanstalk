// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IBean} from "../interfaces/IBean.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {C} from "../C.sol";
import {LibWell} from "./Well/LibWell.sol";
import {IInstantaneousPump} from "../interfaces/basin/pumps/IInstantaneousPump.sol";



/**
 * @title LibUnripe
 * @author Publius
 * @notice Provides utility functions for handling unripe assets including:
 * adding ,removing , estimating conversions
 * and evalutating recapitalization percentages.
 */
library LibUnripe {
    using SafeMath for uint256;

    event ChangeUnderlying(address indexed token, int256 underlying);
    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);

    uint256 constant DECIMALS = 1e6;

    /**
     * @notice Gets the percentage of beans recapitalized after the exploit.
     * @return percent The percentage of beans recapitalized.
     */
    function percentBeansRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            s.u[C.UNRIPE_BEAN].balanceOfUnderlying.mul(DECIMALS).div(
                C.unripeBean().totalSupply()
            );
    }

    /**
     * @notice Gets the percentage of LP recapitalized after the exploit.
     * @return percent The percentage of LP recapitalized.
     */ 
    function percentLPRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            C.unripeLPPerDollar().mul(s.recapitalized).div(
                C.unripeLP().totalSupply()
            );
    }

    /**
     * @notice Increments the balance of an underlying asset in storage.
     * @param token The address of the unripe token.
     * @param amount The amount of the of the unripe token to be added to the storage reserves
     */
    function incrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.u[token].balanceOfUnderlying = s.u[token].balanceOfUnderlying.add(
            amount
        );
        emit ChangeUnderlying(token, int256(amount));
    }

    /**
     * @notice Decrements the balance of an underlying asset in storage.
     * @param token The address of the unripe token.
     * @param amount The amount of the of the unripe token to be removed from storage reserves
     */
    function decrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.u[token].balanceOfUnderlying = s.u[token].balanceOfUnderlying.sub(
            amount
        );
        emit ChangeUnderlying(token, -int256(amount));
    }

    /**
     * @notice Calculates the amount of ripe assets received from converting or chopping an unripe asset.
     * @param unripeToken The address of the unripe token.
     * @param unripe The amount of the of the unripe token to be taken as input.
     * @return underlying The amount of the of the ripe token to be credited from its unripe counterpart.
     */
    function unripeToUnderlying(address unripeToken, uint256 unripe, uint256 supply)
        internal
        view
        returns (uint256 underlying)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        underlying = s.u[unripeToken].balanceOfUnderlying.mul(unripe).div(
            supply
        );
    }

    /**
     * @notice Calculates the amount of unripe that correspond to the underlying.
     * @param unripeToken The address of the unripe token.
     * @param underlying The amount of the of the underlying token to be taken as input.
     * @return unripe The amount of the of the unripe token to be credited from its ripe counterpart.
     */
    function underlyingToUnripe(address unripeToken, uint256 underlying)
        internal
        view
        returns (uint256 unripe)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = IBean(unripeToken).totalSupply().mul(underlying).div(
            s.u[unripeToken].balanceOfUnderlying
        );
    }

    /**
     * Adds the underlying amount of the unripe token to reserves and
     * conditionally updates the recapitalization percentages
     * @param token The address of the unripe token to be added.
     * @param underlying The amount of the of the underlying token to be taken as input.
     */
    function addUnderlying(address token, uint256 underlying) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (token == C.UNRIPE_LP) {
            uint256 recapped = underlying.mul(s.recapitalized).div(
                s.u[C.UNRIPE_LP].balanceOfUnderlying
            );
            s.recapitalized = s.recapitalized.add(recapped);
        }
        incrementUnderlying(token, underlying);
    }

    /**
     * Removes the underlying amount of the unripe token to reserves and
     * conditionally updates the recapitalization percentages
     * @param token The address of the unripe token to be removed.
     * @param underlying The amount of the of the underlying token to be removed.
     */
    function removeUnderlying(address token, uint256 underlying) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (token == C.UNRIPE_LP) {
            uint256 recapped = underlying.mul(s.recapitalized).div(
                s.u[C.UNRIPE_LP].balanceOfUnderlying
            );
            s.recapitalized = s.recapitalized.sub(recapped);
        }
        decrementUnderlying(token, underlying);
    }

    /**
     * @dev Switches the underlying token of an unripe token.
     * Should only be called if `s.u[unripeToken].balanceOfUnderlying == 0`.
     */
    function switchUnderlyingToken(address unripeToken, address newUnderlyingToken) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.u[unripeToken].underlyingToken = newUnderlyingToken;
        emit SwitchUnderlyingToken(unripeToken, newUnderlyingToken);
    }

    function _getPenalizedUnderlying(address unripeToken, uint256 amount, uint256 supply)
        internal
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        uint256 sharesBeingRedeemed = getRecapPaidPercentAmount(amount);
        redeem = _getUnderlying(unripeToken, sharesBeingRedeemed, supply);
    }

    /** 
     * @notice calculates the total underlying token with penalty deduction.
     */
    function _getTotalPenalizedUnderlying(address unripeToken)
        internal
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        uint256 supply = IERC20(unripeToken).totalSupply();
        redeem = _getUnderlying(unripeToken, getRecapPaidPercentAmount(supply), supply);
    }

    /**
     * @notice gets the amount of beans that are locked in the unripe token.
     * @dev locked beans are the beans that are forfeited if the unripe token is chopped.
     */
    function getLockedBeans() internal view returns (uint256 lockedAmount){
        lockedAmount = getTotalUnderlyingForfeited(C.UNRIPE_BEAN)
            .add(getLockedBeansFromLP());
    }

    function getLockedBeansFromLP() internal view returns (uint256 lockedBeanAmount){
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 lockedLpAmount = getTotalUnderlyingForfeited(C.UNRIPE_LP);
        address underlying = s.u[C.UNRIPE_LP].underlyingToken;
        uint256[] memory emaReserves = IInstantaneousPump(C.BEANSTALK_PUMP).readInstantaneousReserves(underlying, C.BYTES_ZERO);
        uint256 beanIndex = LibWell.getBeanIndexFromWell(underlying);
        
        // lockedLp Amount -> MEV resistant
        // emaReserves -> MEV resistant
        // totalSupply -> MEV resistant (LP mints are based on MEV reserves)
        lockedBeanAmount = lockedLpAmount
            .mul(emaReserves[beanIndex])
            .div(IERC20(underlying).totalSupply());
    }
    
    /** 
     * @notice calculates the total underlying token that would be forfeited, 
     * if all unripe tokens were chopped.
     */
    function getTotalUnderlyingForfeited(address unripeToken)
        internal
        view
        returns (uint256 redeem)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(isUnripe(unripeToken), "not vesting");
        redeem = s.u[unripeToken].balanceOfUnderlying
            .sub(_getTotalPenalizedUnderlying(unripeToken));

    }

    /**
     * @notice gets the total recapitalized underlying token.
     * @param amount The amount of the of the unripe token to be taken as input.
     */
    function getRecapPaidPercentAmount(uint256 amount)
        internal
        view
        returns (uint256 penalty)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }

    /**
     * @notice returns true if the token is unripe.
     */
    function isUnripe(address unripeToken) internal view returns (bool unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = s.u[unripeToken].underlyingToken != address(0);
    }

    /**
     * @notice returns the underlying token amount of the unripe token.
     */
    function _getUnderlying(address unripeToken, uint256 amount, uint256 supply)
        internal
        view
        returns (uint256 redeem)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        redeem = s.u[unripeToken].balanceOfUnderlying.mul(amount).div(
            supply
        );
    }
}
