/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

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
