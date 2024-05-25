/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/C.sol";
import "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import "contracts/libraries/LibUnripe.sol";
import "contracts/libraries/Well/LibWellBdv.sol";

/**
 * @title BDVFacet
 * @author Publius
 * @notice Calculates BDV for whitelisted Silo tokens.
 */
contract BDVFacet {
    using SafeMath for uint256;

    /**
     * @dev Returns the BDV of a given `amount` of Bean:3Crv LP tokens.
     */
    function curveToBDV(uint256 amount) public view returns (uint256) {
        return LibBeanMetaCurve.bdv(amount);
    }
    /**
     * @dev Returns the BDV of a given `amount` of Beans.
     */
    function beanToBDV(uint256 amount) public pure returns (uint256) {
        return amount;
    }

    /**
     * @dev Returns the BDV of a given `amount` of Unripe Bean:3Crv LP Tokens.
     */
    function unripeLPToBDV(uint256 amount) public view returns (uint256) {
        amount = LibUnripe.unripeToUnderlying(
            C.UNRIPE_LP, 
            amount, 
            IBean(C.UNRIPE_LP).totalSupply()
        );
        amount = LibWellBdv.bdv(C.BEAN_ETH_WELL, amount);
        return amount;
    }

    /**
     * @dev Returns the BDV of a given `amount` of Unripe Beans.
     */
    function unripeBeanToBDV(uint256 amount) public view returns (uint256) {
        return LibUnripe.unripeToUnderlying(
            C.UNRIPE_BEAN, 
            amount, 
            IBean(C.UNRIPE_BEAN).totalSupply()
        );
    }

    /**
     * @dev Returns the BDV of a given `amount` of Well LP Tokens given a Well `token`.
     * A Well's `token` address is the same as the Well address.
     * Any Well `token` that uses the `wellBdv` function as its BDV function must have 
     `encodeType = 1` in {Storage.SiloSettings}.
     */
    function wellBdv(address token, uint256 amount)
        external
        view
        returns (uint256)
    {
        return LibWellBdv.bdv(token, amount);
    }
}
