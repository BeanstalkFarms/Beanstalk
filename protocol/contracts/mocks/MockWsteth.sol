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
    
    address STETH = address(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

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

    function wrap(uint256 _stETHAmount) external returns (uint256) {
        require(_stETHAmount > 0, "wstETH: can't wrap zero stETH");
        uint256 wstETHAmount = _stETHAmount * 1e18 / _stEthPerToken;
        _mint(msg.sender, wstETHAmount);
        MockToken(STETH).transferFrom(msg.sender, address(this), _stETHAmount);
        return wstETHAmount;
    }

    function unwrap(uint256 _wstETHAmount) external returns (uint256) {
        require(_wstETHAmount > 0, "wstETH: zero amount unwrap not allowed");
        uint256 stETHAmount = _wstETHAmount * _stEthPerToken / 1e18;
        _burn(msg.sender, _wstETHAmount);
        MockToken(STETH).transferFrom(address(this), msg.sender, stETHAmount);
        return stETHAmount;
    }
}
