/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../farm/facets/UniswapFacet/UniswapFacet.sol';
import '../../libraries/LibUserBalance.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @author Beasley
 * @title Uniswap Facet for testing
**/

contract MockUniswapFacet is UniswapFacet {

	function internalBalance(address account, address token) public view returns (uint256) {
		return LibUserBalance._getInternalBalance(account, IERC20(token));
	}

	function resetInternalBalance(address account, address token) public {
		LibUserBalance._decreaseInternalBalance(account, IERC20(token), internalBalance(account, token), false);
	}
}
