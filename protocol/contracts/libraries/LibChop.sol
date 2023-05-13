// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibUnripe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "~/C.sol";
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

     function isUnripe(address unripeToken) internal view returns (bool unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = s.u[unripeToken].underlyingToken != address(0);
    }

// private?
    function getRecapPaidPercentAmount(uint256 amount)
        internal
        view
        returns (uint256 penalty)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }

// private?
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