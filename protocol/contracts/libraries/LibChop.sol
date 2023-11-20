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
        underlyingAmount = LibUnripe._getPenalizedUnderlying(unripeToken, amount, supply);
        LibUnripe.decrementUnderlying(unripeToken, underlyingAmount);
        underlyingToken = s.u[unripeToken].underlyingToken;
    }
}
