/*
 SPDX-License-Identifier: MIT
*/

pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;
import "../../interfaces/IWETH.sol";
import "./LibTransfer.sol";

/**
 * @author publius
 * @title LibWeth handles wrapping and unwrapping Weth
 * Largely inspired by Balancer's Vault
 **/

library LibWeth {
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    function wrap(uint256 amount, LibTransfer.To mode) internal {
        deposit(amount);
        LibTransfer.sendToken(IERC20(WETH), amount, msg.sender, mode);
    }

    function unwrap(uint256 amount, LibTransfer.From mode) internal {
        amount = LibTransfer.receiveToken(IERC20(WETH), amount, msg.sender, mode);
        withdraw(amount);
        (bool success, ) = msg.sender.call{value: amount}(new bytes(0));
        require(success, "Weth: unwrap failed");
    }

    function deposit(uint256 amount) private {
        IWETH(WETH).deposit{value: amount}();
    }

    function withdraw(uint256 amount) private {
        IWETH(WETH).withdraw(amount);
    }
}
