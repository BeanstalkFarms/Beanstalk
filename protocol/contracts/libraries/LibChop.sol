// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBean} from "~/interfaces/IBean.sol";
import {LibAppStorage} from "./LibAppStorage.sol";

/**
 * @title LibChop
 * @author deadmanwalking
 */
library LibChop {

    using SafeMath for uint256;

    /**
     * @notice Chops an unripe asset into its ripe counterpart according to the recapitalization % 
     * @param unripeToken The address of the unripe token to be converted into its ripe counterpart
     * @param amount The amount of the of the unripe token to be converted into its ripe counterpart
     * @return underlyingToken The address of ripe asset received after the chop.
     * @return underlyingAmount The amount of ripe asset received after the chop.
     */
    function chop(
        address unripeToken,
        uint256 amount
    ) internal returns (address underlyingToken, uint256 underlyingAmount) {
        // get access to Beanstalk state
        AppStorage storage s = LibAppStorage.diamondStorage();

        underlyingAmount = _getPenalizedUnderlying(unripeToken, amount);

        LibUnripe.decrementUnderlying(unripeToken, underlyingAmount);

        underlyingToken = s.u[unripeToken].underlyingToken;

    }

    /**
     * @param unripeToken The address of the unripe token 
     * @param amount The amount of the of the unripe token
     * @return redeem the amount of ripe underlying assets that can be redeemed from the unripe ones
     */
    function _getPenalizedUnderlying(address unripeToken, uint256 amount)
        internal
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        uint256 sharesBeingRedeemed = getRecapPaidPercentAmount(amount);
        redeem = LibUnripe.unripeToUnderlying(unripeToken, amount);
    }

    /**
     * @param unripeToken The address of the token to check
     * @return unripe whether the token is unripe
     */
     function isUnripe(address unripeToken) internal view returns (bool unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = s.u[unripeToken].underlyingToken != address(0);
    }

    /**
     * @notice Calculates the penalty for chopping an unripe asset to its ripe counterpart
     * @param amount The amount of the unripe token to chop
     * @return penalty the penalty for chopping 
     */
    function getRecapPaidPercentAmount(uint256 amount)
        internal
        view
        returns (uint256 penalty)
    {
        // get access to Beanstalk state
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }

}