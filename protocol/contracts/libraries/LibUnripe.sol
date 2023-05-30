// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IBean} from "../interfaces/IBean.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";
import {C} from "../C.sol";

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
    function unripeToUnderlying(address unripeToken, uint256 unripe)
        internal
        view
        returns (uint256 underlying)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        underlying = s.u[unripeToken].balanceOfUnderlying.mul(unripe).div(
            IBean(unripeToken).totalSupply()
        );
    }

    /**
     * @notice Calculates the amount of unripe assets received from their ripe counterpart.
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
}
