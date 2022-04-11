/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

contract MockPlainCurve {
    uint256 a;
    uint256[2] balances;
    uint256[2] previousBalances;
    uint256 virtualPrice;
    uint256 supply;

    function get_previous_balances() external view returns (uint256[2] memory) {
        return previousBalances;
    }

    function get_virtual_price() external view returns (uint256) {
        return virtualPrice;
    }

    function A_precise() external view returns (uint256) {
        return a;
    }
    function get_balances() external view returns (uint256[2] memory) {
        return balances;
    }
    function totalSupply() external view returns (uint256) {
        return supply;
    }

    function set_A_precise(uint256 _a) external {
        a = _a;
    }

    function set_balances(uint256[2] memory _balances) external {
        previousBalances = balances;
        balances = _balances;
    }

    function set_supply(uint256 _supply) external {
        supply = _supply;
    }

    function set_virtual_price(uint256 vp) external {
        virtualPrice = vp;
    }
}