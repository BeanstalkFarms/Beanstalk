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

//TODO: write Natspec.

/**
 * @title LibUnripe
 * @author Publius
 */
library LibUnripe {
    using SafeMath for uint256;

    event ChangeUnderlying(address indexed token, int256 underlying);

    uint256 constant DECIMALS = 1e6;

    function percentBeansRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            s.u[C.UNRIPE_BEAN].balanceOfUnderlying.mul(DECIMALS).div(
                C.unripeBean().totalSupply()
            );
    }

    function percentLPRecapped() internal view returns (uint256 percent) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            C.unripeLPPerDollar().mul(s.recapitalized).div(
                C.unripeLP().totalSupply()
            );
    }

    function incrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.u[token].balanceOfUnderlying = s.u[token].balanceOfUnderlying.add(
            amount
        );
        emit ChangeUnderlying(token, int256(amount));
    }

    function decrementUnderlying(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.u[token].balanceOfUnderlying = s.u[token].balanceOfUnderlying.sub(
            amount
        );
        emit ChangeUnderlying(token, -int256(amount));
    }

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
    function _getTotalPenalizedUnderlying(address unripeToken, uint256 supply)
        internal
        view
        returns (uint256 redeem)
    {
        require(isUnripe(unripeToken), "not vesting");
        redeem = _getUnderlying(unripeToken, getRecapPaidPercentAmount(supply), supply);
    }

    /**
     * @notice gets the amount of beans that are locked in the unripe token.
     * @dev locked beans are the beans that are forfeitted if the unripe token is chopped.
     */
    function getLockedBeans() internal view returns (uint256 lockedAmount){
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 beanIndex = LibWell.getBeanIndexFromWell(C.BEAN_ETH_WELL);
        lockedAmount = LibUnripe.getTotalUnderlyingForfeited(C.UNRIPE_BEAN);
        lockedAmount = lockedAmount.add(LibUnripe.getTotalUnderlyingForfeited(C.UNRIPE_LP)
            .mul(
                IInstantaneousPump(C.BEANSTALK_PUMP).readInstantaneousReserves(
                    s.u[C.UNRIPE_LP].underlyingToken, 
                    C.BYTES_ZERO
                )[beanIndex]
            )
        .div(IERC20(s.u[C.UNRIPE_LP].underlyingToken).totalSupply()));
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
        require(isUnripe(unripeToken), "not vesting1");
        uint256 supply = IERC20(unripeToken).totalSupply();
        redeem = _getUnderlying(unripeToken, getRecapPaidPercentAmount(supply), supply);
    }


    function getRecapPaidPercentAmount(uint256 amount)
        internal
        view
        returns (uint256 penalty)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.fertilizedIndex.mul(amount).div(s.unfertilizedIndex);
    }

    function isUnripe(address unripeToken) internal view returns (bool unripe) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = s.u[unripeToken].underlyingToken != address(0);
    }

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
