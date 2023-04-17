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
}
