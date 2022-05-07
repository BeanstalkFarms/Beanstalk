/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../../libraries/Curve/LibBeanMetaCurve.sol";
import "../../libraries/Curve/LibBeanLUSDCurve.sol";

/*
 * @author Publius
 * @title BDVFacet holds the Curve MetaPool BDV function.
 */
contract BDVFacet {
    using SafeMath for uint256;

    function curveToBDV(uint256 amount) public view returns (uint256) {
        return LibBeanMetaCurve.bdv(amount);
    }

    // function lusdToBDV(uint256 amount) public view returns (uint256) {
    //     return LibBeanLUSDCurve.bdv(amount);
    // }

    function beanToBDV(uint256 amount) public pure returns (uint256) {
        return amount;
    }

    function unripeLPToBDV(uint256 amount) public pure returns (uint256) {
        return amount.div(10); // TODO: Implement
    }

    function unripeBeanToBDV(uint256 amount) public pure returns (uint256) {
        return amount.div(2); // TODO: Implement
    }

    function bdv(address token, uint256 amount)
        external
        view
        returns (uint256)
    {
        if (token == C.beanAddress()) return beanToBDV(amount);
        else if (token == C.curveMetapoolAddress()) return curveToBDV(amount);
        else if (token == C.unripeBeanAddress()) return unripeBeanToBDV(amount);
        else if (token == C.unripeLPAddress()) return unripeLPToBDV(amount);
        // else if (token == C.curveBeanLUSDAddress()) return LibBeanLUSDCurve.bdv(amount);
        revert("BDV: Token not whitelisted");
    }
}
