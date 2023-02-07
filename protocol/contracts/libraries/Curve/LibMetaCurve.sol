// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibCurve} from "./LibCurve.sol";
import "../../C.sol";

/**
 * @dev Interface for the 3Pool Curve pool
 */
interface IMeta3Curve {
    function A_precise() external view returns (uint256);
    function get_previous_balances() external view returns (uint256[2] memory);
    function get_virtual_price() external view returns (uint256);
}

/**
 * @title LibMetaCurve
 * @author Publius
 * @notice Calculates the price of Curve metapools.
 */
library LibMetaCurve {
    using SafeMath for uint256;

    uint256 private constant MAX_DECIMALS = 18;

    function price(
        address pool,
        uint256 decimals
    ) internal view returns (uint256) {
        uint256 a = IMeta3Curve(pool).A_precise();
        uint256[2] memory balances = IMeta3Curve(pool).get_previous_balances();
        uint256[2] memory xp = getXP(balances, 10**MAX_DECIMALS.sub(decimals));
        uint256 D = LibCurve.getD(xp, a);
        return LibCurve.getPrice(xp, a, D, 1e6); // FIXME: document derivation of 1e6
    }

    function getXP(
        uint256[2] memory balances,
        uint256 padding
    ) internal view returns (uint256[2] memory) {
        return LibCurve.getXP(
            balances,
            padding,
            C.curve3Pool().get_virtual_price()
        );
    }

    function getDFroms(
        address pool,
        uint256[2] memory balances,
        uint256 padding
    ) internal view returns (uint256) {
        return LibCurve.getD(
            getXP(balances, padding),
            IMeta3Curve(pool).A_precise()
        );
    }
}
