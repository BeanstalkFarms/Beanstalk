// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBean} from "~/interfaces/IBean.sol";
import {LibAppStorage} from "./LibAppStorage.sol";

/**
 * @title LibChop
 * @author deadmanwalking
 */
library LibChop {

    using SafeERC20 for IERC20;
    using LibTransfer for IERC20;
    using SafeMath for uint256;

    event Chop(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 underlying
    );

    /**
     * @notice Chops an unripe asset into its ripe counterpart according to the recapitalization % 
     * @param unripeToken The address of the unripe token to be converted into its ripe counterpart
     * @param amount The amount of the of the unripe token to be converted into its ripe counterpart
     * @param fromMode The balance from which the unripe tokens will be converted (e.g INTERNAL , EXTERNAL)
     * @param toMode The balance to which the ripe tokens will be credited (e.g INTERNAL , EXTERNAL)
     * @return underlyingAmount The amount of ripe asset received after the chop.
     */
    function chop(
        address unripeToken,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) internal returns (uint256 underlyingAmount) {
        // get access to Beanstalk state
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 unripeSupply = IERC20(unripeToken).totalSupply();

        amount = LibTransfer.burnToken(IBean(unripeToken), amount, msg.sender, fromMode);

        underlyingAmount = _getPenalizedUnderlying(unripeToken, amount, unripeSupply);

        LibUnripe.decrementUnderlying(unripeToken, underlyingAmount);

        address underlyingToken = s.u[unripeToken].underlyingToken;

        IERC20(underlyingToken).sendToken(underlyingAmount, msg.sender, toMode);
        
        emit Chop(msg.sender, unripeToken, amount, underlyingAmount);
    }

    /**
     * @param unripeToken The address of the unripe token 
     * @param amount The amount of the of the unripe token
     * @param supply The total unripe supply
     * @return redeem the amount of ripe underlying assets that can be redeemed from the unripe ones
     */
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

    /**
     * @param unripeToken The address of the unripe token
     * @param supply The total supply of the unripe token
     * @return redeem the final amount of ripe assets chopped from its unripe counterpart
     */
     function _getUnderlying(address unripeToken, uint256 amount, uint256 supply)
        internal
        view
        returns (uint256)
    {
        // get access to Beanstalk state
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 redeem = s.u[unripeToken].balanceOfUnderlying.mul(amount).div(
            supply
        );
        return redeem;
    }

}