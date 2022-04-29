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

    function curveToBDV(uint256 amount) external view returns (uint256) {
        return LibBeanMetaCurve.bdv(amount);
    }
    
    function lusdToBDV(uint256 amount) external view returns (uint256) {
        return LibBeanLUSDCurve.bdv(amount);
    }

    function beanToBDV(uint256 amount) external view returns (uint256) {
        return amount;
    }

    function bdv(address token, uint256 amount) external view returns (uint256) {
        if (token == C.beanAddress()) return amount;
        else if (token == C.curveMetapoolAddress()) return LibBeanMetaCurve.bdv(amount);
        // else if (token == C.curveBeanLUSDAddress()) return LibBeanLUSDCurve.bdv(amount);
        revert("BDV: Token not whitelisted");
    }
}