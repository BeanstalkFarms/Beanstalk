/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
import "../../interfaces/IWETH.sol";
import "../LibTractor.sol";
import "./LibTransfer.sol";

/**
 * @author publius
 * @title LibWeth handles wrapping and unwrapping Weth
 * Largely inspired by Balancer's Vault
 **/

library LibWeth {
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    function wrap(uint256 amount, LibTransfer.To mode) internal {
        deposit(amount);
        LibTransfer.sendToken(IERC20(WETH), amount, LibTractor._user(), mode);
    }

    function unwrap(uint256 amount, LibTransfer.From mode) internal {
        amount = LibTransfer.receiveToken(IERC20(WETH), amount, LibTractor._user(), mode);
        withdraw(amount);
        (bool success, ) = LibTractor._user().call{value: amount}(new bytes(0));
        require(success, "Weth: unwrap failed");
    }

    function deposit(uint256 amount) private {
        IWETH(WETH).deposit{value: amount}();
    }

    function withdraw(uint256 amount) private {
        IWETH(WETH).withdraw(amount);
    }
}
