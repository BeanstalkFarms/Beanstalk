/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/*
 * Author: Beasley
 * ICurve interacts with the various curve pools
*/

interface IMeta3Curve {

	/*
	 * Write functions
	*/

	function add_liquidity(address _pool, uint256[4] calldata _deposit_amounts, uint256 _min_mint_amount) external;
	
	function add_liquidity(address _pool, uint256[4] calldata _deposit_amounts, uint256 _min_mint_amount, address _receiver) external;

	function remove_liquidity(address _pool, uint256 _burn_amount, uint256[4] calldata _min_amounts) external;
	
	function remove_liquidity(address _pool, uint256 _burn_amount, uint256[4] calldata _min_amounts, address _receiver) external;

	function remove_liquidity_one_coin(address _pool, uint256 _burn_amount, int128 i, uint256 _min_amount) external;
	
	function remove_liquidity_one_coin(address _pool, uint256 _burn_amount, int128 i, uint256 _min_amount, address _receiver) external;

	function remove_liquidity_imbalance(address _pool, uint256[4] calldata _amounts, uint256 _max_burn_amount) external;
	
	function remove_liquidity_imbalance(address _pool, uint256[4] calldata _amounts, uint256 _max_burn_amount, address _receiver) external;

	/*
	 * Read Functions
	*/

        function calc_withdraw_one_coin(address _pool, uint256 _token_amount, int128 i) external returns (uint256);

	function calc_token_amount(address _pool, uint256[4] calldata amounts, bool _is_deposit) external returns (uint256);
}
