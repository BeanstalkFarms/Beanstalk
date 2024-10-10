/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.17;

interface IWETH {
    function withdraw(uint256) external;
    function balanceOf(address) external returns (uint256);
}

/// @title UnwrapAndSendETH
/// @notice Helper contract for pipeline to unwrap WETH and send to an account
/// @author 0xkokonut
contract UnwrapAndSendETH {
    receive() external payable {}

    address public immutable WETH;

    constructor(address wethAddress) {
        WETH = wethAddress;
    }

    /// @notice Unwrap WETH and send ETH to the specified address
    /// @dev Make sure to load WETH into this contract before calling this function
    function unwrapAndSendETH(address to) external {
        uint256 wethBalance = IWETH(WETH).balanceOf(address(this));
        require(wethBalance > 0, "Insufficient WETH");
        IWETH(WETH).withdraw(wethBalance);
        (bool success, ) = to.call{value: address(this).balance}(new bytes(0));
        require(success, "Eth transfer Failed.");
    }
}
