/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Curve/LibBeanMetaCurve.sol";

/*
 * @author Publius
 * @title CurveBDVFacet holds the Curve MetaPool BDV function.
*/
contract CurveBDVFacet {
    function curveToBDV(uint256 amount) external view returns (uint256) {
        return LibBeanMetaCurve.bdv(amount);
    }
}