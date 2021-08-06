/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Mock Upgrade Facet
**/
contract MockUpgradeFacet {

    function woohoo() public pure returns (uint256) {
        return 1;
    }

}
