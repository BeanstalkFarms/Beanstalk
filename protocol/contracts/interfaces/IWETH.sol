/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title WETH Interface
 **/
interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint) external;
}
