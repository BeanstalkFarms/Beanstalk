/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;

import "./MockToken.sol";
import {IWsteth} from "contracts/libraries/Oracle/LibWstethEthOracle.sol";

/**
 * @author Brendan
 * @title Mock WStEth
**/
contract MockWsteth is MockToken {

    uint256 _stEthPerToken;

    constructor() MockToken("Wrapped Staked Ether", "WSTETH") {
        _stEthPerToken = 1e18;
    }

    function setStEthPerToken(uint256 __stEthPerToken) external {
        _stEthPerToken = __stEthPerToken;
    }

    function stEthPerToken() external view returns (uint256) {
        return _stEthPerToken;
    }

    function getWstETHByStETH(uint256 __stAmount) external view returns (uint256) {
        return __stAmount * 1e18 / _stEthPerToken;
    }
}
