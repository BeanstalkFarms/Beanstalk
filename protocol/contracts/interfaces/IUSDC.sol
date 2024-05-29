/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Publius
 * @title WETH Interface
 **/

interface IUSDC is IERC20 {
    function masterMinter() external view returns (address);
    function mint(address _to, uint256 _amount) external;
}
