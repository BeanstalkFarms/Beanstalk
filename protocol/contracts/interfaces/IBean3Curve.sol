/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/*
 * Author: Beasley
 * ICurve adds liquidity to the various curve pools
*/

interface IBean3Curve {

	/* 
	 * Write Functions
	*/

	function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount) external;

	function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount, address _receiver) external;

	function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external;

	function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy, address _receiver) external;

	function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 min_dy) external;

	function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 min_dy, address _receiver) external;

	function remove_liquidity(uint256 _burn_amount, uint256[2] calldata _min_amounts) external;

	function remove_liquidity(uint256 _burn_amount, uint256[2] calldata _min_amounts, address _receiver) external;

	function remove_liquidity_imbalance(uint256[2] calldata _amounts, uint256 _max_burn_amount) external;
	
	function remove_liquidity_imbalance(uint256[2] calldata _amounts, uint256 _max_burn_amount, address _receiver) external;

	function remove_liquidity_one_coin(uint256 _burn_amount, int256 i, uint256 _min_received) external;
	
	function remove_liquidity_one_coin(uint256 _burn_amount, int256 i, uint256 _min_received, address _receiver) external;

	function ramp_A(uint256 _future_A, uint256 _future_time) external;

	function stop_ramp_A() external;

	function withdraw_admin_fees() external;

	/*
	 * Read Functions
	*/
        
        function calc_token_amount(uint256[2] calldata _amounts, bool _is_deposit) external returns (uint256);
       
	function calc_token_amount(uint256[2] calldata _amounts, bool _is_deposit, bool _previous) external returns (uint256);

	function get_dy(int128 i, int128 j, uint256 dx) external returns (uint256);
	
	function get_dy(int128 i, int128 j, uint256 dx, uint256[2] calldata _balances) external returns (uint256);

	function get_dy_underlying(int128 i, int128 j, uint256 dx) external returns (uint256);
	
	function get_dy_underlying(int128 i, int128 j, uint256 dx, uint256[2] calldata _balances) external returns (uint256);

	function calc_withdraw_one_coin(uint256 _burn_amount, int128 i) external returns (uint256);
	
	function calc_withdraw_one_coin(uint256 _burn_amount, int128 i, bool _previous) external returns (uint256);

	function coins(uint256 arg0) external returns (address);

	function totalSupply() external returns (uint256);

	function balanceOf(address account) external returns (uint256);
}
