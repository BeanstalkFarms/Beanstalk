// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibUnripe, SafeMath, AppStorage} from "contracts/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibAppStorage} from "./LibAppStorage.sol";

/**
 * @title LibChop
 * @author deadmanwalking
 */
library LibChop {
    using SafeMath for uint256;

    /**
     * @notice Chops an Unripe Token into its Ripe Token.
     * @dev The output amount is based on the % of Sprouts that are Rinsable or Rinsed
     * and the % of Fertilizer that has been bought.
     * @param unripeToken The address of the Unripe Token to be Chopped.
     * @param amount The amount of the of the Unripe Token to be Chopped.
     * @return underlyingToken The address of Ripe Tokens received after the Chop.
     * @return underlyingAmount The amount of Ripe Tokens received after the Chop.
     */
    function chop(
        address unripeToken,
        uint256 amount,
        uint256 supply
    ) internal returns (address underlyingToken, uint256 underlyingAmount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        underlyingAmount = _getPenalizedUnderlying(unripeToken, amount, supply);
        LibUnripe.decrementUnderlying(unripeToken, underlyingAmount);
        underlyingToken = s.u[unripeToken].underlyingToken;
    }

    /**
     * @notice Calculates the amount of Ripe Tokens received from Chopping.
     * @param unripeToken The address of the Unripe Token.
     * @param amount The amount of Unripe Tokens.
     * @return redeem The amount of Ripe Tokens received from Chopping.
     */
    function _getPenalizedUnderlying(
        address unripeToken,
        uint256 amount,
        uint256 supply
    ) internal view returns (uint256 redeem) {
        require(isUnripe(unripeToken), "not vesting");
        redeem = LibUnripe.unripeToUnderlying(
            unripeToken,
            getRecapPaidPercentAmount(amount),
            supply
        );
    }

    /**
     * @param unripeToken The address of the token to check.
     * @return _isUnripe Whether the token is Unripe.
     */
    function isUnripe(address unripeToken) internal view returns (bool _isUnripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        _isUnripe = s.u[unripeToken].underlyingToken != address(0);
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
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }
}
