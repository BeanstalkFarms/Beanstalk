/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Curve/LibBeanMetaCurve.sol";
import "~/libraries/LibUnripe.sol";
import "~/libraries/Well/LibWellPrice.sol";

/**
 * @title BDVFacet
 * @author Publius
 * @notice Calculates BDV for whitelisted Silo tokens.
 */
contract BDVFacet {
    using SafeMath for uint256;

    function curveToBDV(uint256 amount) public view returns (uint256) {
        return LibBeanMetaCurve.bdv(amount);
    }

    function beanToBDV(uint256 amount) public pure returns (uint256) {
        return amount;
    }

    function unripeLPToBDV(uint256 amount) public view returns (uint256) {
        amount = LibUnripe.unripeToUnderlying(C.unripeLPAddress(), amount);
        amount = LibBeanMetaCurve.bdv(amount);
        return amount;
    }

    function unripeBeanToBDV(uint256 amount) public view returns (uint256) {
        return LibUnripe.unripeToUnderlying(C.unripeBeanAddress(), amount);
    }

    function wellBdv(address token, uint256 amount)
        external
        view
        returns (uint256)
    {
        return LibWellPrice.bdv(token, 0, 0, amount);
    }
}
