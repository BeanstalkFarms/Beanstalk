/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/*
 * @author Publius
 * @title BasicBDVFacet holds a test BDV function.
*/
contract BasicBDVFacet {
    function mockToBDV(uint256 amount) external pure returns (uint256) {
        return amount/1e12;
    }
}