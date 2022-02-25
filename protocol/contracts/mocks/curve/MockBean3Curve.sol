/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IBean.sol";

/**
 * @author Publius + LeoFib
 * @title Mock Bean3Curve Pair/Pool
**/

contract MockBean3Curve {
    using SafeMath for uint256;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    uint256 a;
    uint256[2] balances;
    uint256 private supply;
    address[2] coins;

    constructor(address _token, address _token2) {
        coins[0] = _token;
        coins[1] = _token2;
    }

    function A_precise() external view returns (uint256) {
        return a;
    }
    function get_balances() external view returns (uint256[2] memory) {
        return balances;
    }
    function totalSupply() external view returns (uint256) {
        return supply;
    }

    function set_A_precise(uint256 _a) external {
        a = _a;
    }

    function set_balances(uint256[2] memory _balances) external {
        balances = _balances;
    }

    function set_supply(uint256 _supply) external {
        supply = _supply;
    }

    // @param _amounts List of amounts of coins to deposit
    // @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit

    function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount) external returns (uint256) {
        uint256[2] memory old_balances = balances;
        // D0: uint256 = self.get_D_mem(rates, old_balances, amp)
        uint256[2] memory new_balances = old_balances;
        uint256 total_supply = supply;
        uint256 mint_amount = min_mint_amount;

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            if (total_supply == 0) {
                require(amount > 0, "dev: initial deposit requires all coins");
            }
            new_balances[i].add(amount);
        }
        balances = new_balances;

        // Take coins from the sender
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            if (amount > 0)
                IERC20(coins[i]).transferFrom(msg.sender, address(this), amount);  // dev: failed transfer
        }
        //  Mint pool tokens
        total_supply.add(mint_amount);
        balanceOf[msg.sender].add(mint_amount);
        supply = total_supply;
        return mint_amount;

    }

    // @openzeppelin/contracts/token/ERC20/ERC20.sol

    mapping (address => uint256) private balanceOf;

    mapping (address => mapping (address => uint256)) private _allowances;

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for `sender`"s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        balanceOf[sender] = balanceOf[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        balanceOf[recipient] = balanceOf[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}