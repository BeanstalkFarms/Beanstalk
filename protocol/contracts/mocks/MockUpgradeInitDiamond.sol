/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Mock Upgrade Init Diamond
**/
contract MockUpgradeInitDiamond {
    uint256 private _s;
    function init() public {
        _s = 1;
    }

}
