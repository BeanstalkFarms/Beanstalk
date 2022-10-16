/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IBean.sol";
import "../MockToken.sol";
import "../../libraries/Curve/LibCurve.sol";
import "../../libraries/Oracle/LibCurveOracle.sol";

/**
 * @author Publius + LeoFib
 * @title Mock Bean3Curve Pair/Pool
**/

interface IMockCurvePool {
    function A_precise() external view returns (uint256);
    function get_balances() external view returns (uint256[2] memory);
    function totalSupply() external view returns (uint256);
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external returns (uint256);
    function balances(int128 i) external view returns (uint256);
    function fee() external view returns (uint256);
    function coins(uint256 i) external view returns (address);
    function get_virtual_price() external view returns (uint256);
    function calc_token_amount(uint256[2] calldata amounts, bool deposit) external view returns (uint256);
    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
    function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function set_virtual_price(uint256 _virtual_price) external;
    function set_A_precise(uint256 _a) external;
    function transfer(address recipient, uint256 amount) external returns (bool);
    function set_supply(uint256 _supply) external;
    function set_balances(uint256[2] calldata _balances) external;
}

contract MockMeta3Curve {
    using SafeMath for uint256;

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    uint256 constant FEE_DENOMINATOR = 1e10;
    uint256 constant ADMIN_FEE = 5000000000;
    uint256 constant N_COINS = 2;
    uint256 constant A_PRECISION = 100;
    uint256 constant PRECISION = 1e18;

    uint256 a;
    uint256[2] balances;
    uint256[2] previousBalances;
    uint256 private supply;
    address[2] coins;
    uint256[2] price_cumulative_last;
    uint256 timestamp_last;
    address BASE_POOL = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    uint256 fee = 4000000;
    uint256 virtual_price;
    uint256 rate_multiplier;

    constructor(address _token, address _token2, address base_pool) {
        coins[0] = _token;
        coins[1] = _token2;
        BASE_POOL = base_pool;
    }

    function init(address _token, address _token2, address base_pool) external {
        coins[0] = _token;
        coins[1] = _token2;
        BASE_POOL = base_pool;
        rate_multiplier = 10 ** (36 - MockToken(_token).decimals());
    }

    function A_precise() external view returns (uint256) {
        return a;
    }

    function get_balances() external view returns (uint256[2] memory) {
        return balances;
    }

    function get_previous_balances() external view returns (uint256[2] memory) {
        return previousBalances;
    }

    function get_virtual_price() external view returns (uint256) {
        return virtual_price;
    }


    // Mock Functions

    function set_A_precise(uint256 _a) external {
        a = _a;
    }

    function set_balances(uint256[2] calldata _balances) external {
        previousBalances = balances;
        balances = _balances;
    }

    function set_supply(uint256 _supply) external {
        supply = _supply;
    }

    function set_virtual_price(uint256 _virtual_price) external {
        virtual_price = _virtual_price;
    }

    // TWAP

    function update(uint256[2] calldata new_balances) public {
        _update();
        balances = new_balances;
    }

    function _update() internal {
        price_cumulative_last[0] += balances[0] * (block.timestamp - timestamp_last);
        price_cumulative_last[1] += balances[1] * (block.timestamp - timestamp_last);
        timestamp_last = block.timestamp;
    }

    function reset_cumulative() public {
        timestamp_last = block.timestamp;
        price_cumulative_last = balances;
    }

    function get_price_cumulative_last() external view returns (uint256[2] memory) {
        return price_cumulative_last;
    }
    
    function block_timestamp_last() external view returns (uint256) {
        return timestamp_last;
    }

    function get_bean_price() external view returns (uint256 price) {
        (uint256[2] memory twa_balances, ) = LibCurveOracle.twap();
        uint256[2] memory rates = get_rates();
        uint256[2] memory xp = LibCurve.getXP(twa_balances, rates);
        uint256 D = LibCurve.getD(xp, a);
        price = LibCurve.getPrice(xp, rates, a, D);
    }
    
    function get_rates() private view returns (uint256[2] memory rates) {
        // Decimals will always be 6 because we can only mint beans
        // 10**(36-decimals)
        return [1e30, virtual_price];
    }

    function reset() external {
        balances = [0,0];
        supply = 0;
        MockToken(coins[0]).burn(MockToken(coins[0]).balanceOf(address(this)));
        MockToken(coins[1]).burn(MockToken(coins[1]).balanceOf(address(this)));
        reset_cumulative();
    }

    function exchange(
        int128 _i_,
        int128 _j_,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256) {
        return exchange(_i_, _j_, dx, min_dy, msg.sender);
    }

    function exchange(
        int128 _i_,
        int128 _j_,
        uint256 dx,
        uint256 min_dy,
        address _receiver
    ) public returns (uint256) {
        uint256 i = uint256(_i_);
        uint256 j = uint256(_j_);
        _update();
        uint256[N_COINS] memory rates = [rate_multiplier, I3Curve(BASE_POOL).get_virtual_price()];
        uint256[N_COINS] memory xp = _xp_mem(rates, balances);

        // uint256 x = xp[i] + dx * rates[i] / PRECISION;
        // uint256 y = get_y(i, j, xp[i] + dx * rates[i] / PRECISION, xp);

        uint256 dy = xp[j] - get_y(i, j, xp[i] + dx * rates[i] / PRECISION, xp) - 1;
        uint256 dy_fee = dy * fee / FEE_DENOMINATOR;

        dy = (dy - dy_fee) * PRECISION / rates[j];
        require(dy >= min_dy, "Curve: error"); 

        uint256 dy_admin_fee = dy_fee * ADMIN_FEE / FEE_DENOMINATOR;
        dy_admin_fee = dy_admin_fee * PRECISION / rates[j];

        balances[i] = balances[i] + dx;
        balances[j] = balances[j] - dy - dy_admin_fee;

        ERC20(coins[i]).transferFrom(msg.sender, address(this), dx);
        ERC20(coins[j]).transfer(_receiver, dy);

        return dy;
    }

    function add_liquidity(uint256[N_COINS] memory _amounts, uint256 _min_mint_amount) external returns (uint256) {
        return add_liquidity(_amounts, _min_mint_amount, msg.sender);
    }

    function add_liquidity(uint256[N_COINS] memory _amounts, uint256 _min_mint_amount, address _receiver) public returns (uint256) {
        _update();
        previousBalances = balances;
        uint256 amp = a;
        uint256[N_COINS] memory rates = [rate_multiplier, I3Curve(BASE_POOL).get_virtual_price()];

        uint256[N_COINS] memory old_balances = balances;
        uint256 D0 = get_D_mem(rates, old_balances, amp);
        uint256[N_COINS] memory new_balances = old_balances;

        uint256 total_supply = supply;
        for (uint256 i; i < N_COINS; ++i) {
            uint256 amount = _amounts[i];
            if (total_supply == 0)
                require(amount > 0, "dev: initial deposit requires all coins");
            new_balances[i] += amount;
        }

        uint256 D1 = get_D_mem(rates, new_balances, amp);
        require(D1 > D0, "New D high");

        uint256[N_COINS] memory fees;
        uint256 mint_amount = 0;
        if (total_supply > 0) {
            uint256 base_fee = fee * N_COINS / (4 * (N_COINS - 1));
            for (uint256 i; i < N_COINS; ++i) {
                uint256 ideal_balance = D1 * old_balances[i] / D0;
                uint256 difference = 0;
                uint256 new_balance = new_balances[i];
                if (ideal_balance > new_balance) difference = ideal_balance - new_balance;
                else difference = new_balance - ideal_balance;
                fees[i] = base_fee * difference / FEE_DENOMINATOR;
                balances[i] = new_balance - (fees[i] * ADMIN_FEE / FEE_DENOMINATOR);
                new_balances[i] -= fees[i];
            }
            uint256 D2 = get_D_mem(rates, new_balances, amp);
            mint_amount = total_supply * (D2 - D0) / D0;
        } else {
            balances = new_balances;
            mint_amount = D1;
        }

        require(mint_amount >= _min_mint_amount, "Curve: Not enough LP");

        for (uint256 i; i < N_COINS; ++i) {
            uint256 amount = _amounts[i];
            if (amount > 0)
                IBean(coins[i]).transferFrom(msg.sender, address(this), amount);
        }

        total_supply += mint_amount;
        _balanceOf[_receiver] += mint_amount;
        supply = total_supply;

        return mint_amount;
    }

    function remove_liquidity(
        uint256 _burn_amount,
        uint256[N_COINS] calldata _min_amounts
    ) external returns (uint256[N_COINS] memory amounts) {
        return remove_liquidity(_burn_amount, _min_amounts, msg.sender);
    }

    function remove_liquidity(
        uint256 _burn_amount,
        uint256[N_COINS] calldata _min_amounts,
        address _receiver
    ) public returns (uint256[N_COINS] memory amounts) {
        _update();

        for (uint256 i; i < N_COINS; ++i) {
            uint256 old_balance = balances[i];
            uint256 value = old_balance * _burn_amount / supply;
            require(value >= _min_amounts[i]);
            balances[i] = old_balance - value;
            amounts[i] = value;
            ERC20(coins[i]).transfer(_receiver, value);
        }

        supply -= _burn_amount;
        _balanceOf[msg.sender] -= _burn_amount;

        return amounts;
    }

    function remove_liquidity_imbalance(
        uint256[N_COINS] memory _amounts,
        uint256 _max_burn_amount
    ) external returns (uint256) {
        return remove_liquidity_imbalance(_amounts, _max_burn_amount, msg.sender);
    }

    function remove_liquidity_imbalance(
        uint256[N_COINS] memory _amounts,
        uint256 _max_burn_amount,
        address _receiver
    ) public returns (uint256) {
        _update();

        uint256 amp = a;
        uint256[N_COINS] memory rates = [rate_multiplier, I3Curve(BASE_POOL).get_virtual_price()];
        uint256[N_COINS] memory old_balances = balances;
        uint256 D0 = get_D_mem(rates, old_balances, amp);

        uint256[N_COINS] memory new_balances = old_balances;
        for (uint256 i; i < N_COINS; ++i) {
            new_balances[i] -= _amounts[i];
        }
        uint256 D1 = get_D_mem(rates, new_balances, amp);

        uint256[N_COINS] memory fees;
        uint256 base_fee = fee * N_COINS / (4 * (N_COINS - 1));
        for (uint256 i; i < N_COINS; ++i) {
            uint256 ideal_balance = D1 * old_balances[i] / D0;
            uint256 difference = 0;
            uint256 new_balance = new_balances[i];
            if (ideal_balance > new_balance) {
                difference = ideal_balance - new_balance;
            } else {
                difference = new_balance - ideal_balance;
                fees[i] = base_fee * difference / FEE_DENOMINATOR;
                balances[i] = new_balance - (fees[i] * ADMIN_FEE / FEE_DENOMINATOR);
                new_balances[i] -= fees[i];
            }
        }
        uint256 D2 = get_D_mem(rates, new_balances, amp);

        uint256 burn_amount = ((D0 - D2) * supply / D0) + 1;
        require(burn_amount > 1);
        require(burn_amount <= _max_burn_amount);

        supply -= burn_amount;
        _balanceOf[msg.sender] -= burn_amount;

        for (uint256 i; i < N_COINS; ++i) {
            uint256 amount = _amounts[i];
            if (amount != 0) {
                ERC20(coins[i]).transfer(_receiver, amount);
            }
        }
        return burn_amount;
    }

    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 _i_,
        uint256 _min_received
    ) external returns (uint256) {
        return remove_liquidity_one_coin(_burn_amount, _i_, _min_received, msg.sender);
    }

    // @notice Withdraw a single coin from the pool
    // @param _burn_amount Amount of LP tokens to burn in the withdrawal
    // @param i Index value of the coin to withdraw
    // @param _min_received Minimum amount of coin to receive
    // @param _receiver Address that receives the withdrawn coins
    // @return Amount of coin received
    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 _i_,
        uint256 _min_received,
        address _receiver
    ) public returns (uint256) {
        _update();
        uint256 i = uint256(_i_);
        (uint256 dy, uint256 dy_fee) = _calc_withdraw_one_coin(_burn_amount, _i_, balances);
        require(dy >= _min_received, "Curve: Insufficient Output");

        balances[i] -= (dy + dy_fee * ADMIN_FEE / FEE_DENOMINATOR);
        supply = supply - _burn_amount;
        _balanceOf[msg.sender] -= _burn_amount;
        IBean(coins[i]).transfer(_receiver, dy);

        return dy;
    }

    function _calc_withdraw_one_coin(uint256 _burn_amount, int128 _i_, uint256[N_COINS] memory _balances) internal view returns (uint256, uint256) {
        // First, need to calculate
        //  Get current D
        // Solve Eqn against y_i for D - _token_amount
        uint256 i = uint256(_i_);
        uint256 amp = a;
        uint256[N_COINS] memory rates = [rate_multiplier, I3Curve(BASE_POOL).get_virtual_price()];
        uint256[N_COINS] memory xp = _xp_mem(rates, _balances);
        uint256 D0 = get_D(xp, amp);

        uint256 total_supply = supply;
        uint256 D1 = D0 - _burn_amount * D0 / total_supply;
        uint256 new_y = get_y_D(amp, i, xp, D1);

        uint256 base_fee = fee * N_COINS / (4 * (N_COINS - 1));
        uint256[N_COINS] memory xp_reduced;

        for (uint j; j < N_COINS; ++j) {
            uint256 dx_expected = 0;
            uint256 xp_j = xp[j];
            if (j == i) dx_expected = xp_j * D1 / D0 - new_y;
            else dx_expected = xp_j - xp_j * D1 / D0;
            xp_reduced[j] = xp_j - base_fee * dx_expected / FEE_DENOMINATOR;
        }

        uint256 dy = xp_reduced[i] - get_y_D(amp, i, xp_reduced, D1);
        uint256 dy_0 = (xp[i] - new_y) * PRECISION / rates[i];  // w/o fees
        dy = (dy - 1) * PRECISION / rates[i];  // Withdraw less to account for rounding errors

        return (dy, dy_0 - dy);
    }

    function calc_withdraw_one_coin(uint256 _burn_amount, int128 i) external view returns (uint256 amount) {
       (amount,) = _calc_withdraw_one_coin(_burn_amount, i, balances);
    }

    function _xp_mem(uint256[N_COINS] memory _rates, uint256[N_COINS] memory _balances) pure private returns (uint256[N_COINS] memory result) {
        for (uint256 i; i < N_COINS; ++i) {
            result[i] = _rates[i] * _balances[i] / PRECISION;
        }
    }

    function get_D(uint256[N_COINS] memory xp, uint256 _a) private pure returns (uint D) {
        // Solution is taken from pool contract: 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49
        uint256 S;
        uint256 Dprev;
        for (uint _i; _i < xp.length; ++_i) {
            S += xp[_i];
        }
        if (S == 0) return 0;

        D = S;
        uint256 Ann = _a * N_COINS;
        for (uint _i; _i < 256; ++_i) {
            uint256 D_P = D;
            for (uint _j; _j < xp.length; ++_j) {
                D_P = D_P * D / (xp[_j] * N_COINS);
            }
            Dprev = D;
            D = (Ann * S / A_PRECISION + D_P * N_COINS) * D / ((Ann - A_PRECISION) * D / A_PRECISION + (N_COINS + 1) * D_P);
            if (D > Dprev && D - Dprev <= 1) return D;
            else if (Dprev - D <= 1) return D;
        }
        require(false, "Price: Convergence false");
        return 0;
    }

    function get_y_D(uint256 A, uint256 i, uint256[N_COINS] memory xp, uint256 D) private pure returns (uint256 y) {
        // Calculate x[i] if one reduces D from being calculated for xp to D

        // Done by solving quadratic equation iteratively.
        // x_1**2 + x1 * (sum' - (A*n**n - 1) * D / (A * n**n)) = D ** (n + 1) / (n ** (2 * n) * prod' * A)
        // x_1**2 + b*x_1 = c

        // x_1 = (x_1**2 + c) / (2*x_1 + b)
        // x in the input is converted to the same price/precision

        require(i >= 0, "Curve: i below zero");
        require(i < N_COINS, "Curve: i above N_COINS");

        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 c = D;
        uint256 Ann = A * N_COINS;

        for (uint256 _i; _i < N_COINS; ++_i) {
            if (_i != i) _x = xp[_i];
            else continue;
            S_ += _x;
            c = c * D / (_x * N_COINS);
        }

        c = c * D * A_PRECISION / (Ann * N_COINS);
        uint256 b = S_ + D * A_PRECISION / Ann;
        y = D;

        for (uint256 _i; _i < 255; ++_i) {
            y_prev = y;
            y = (y*y + c) / (2 * y + b - D);
            // Equality with the precision of 1
            if (y > y_prev) {
                if (y - y_prev <= 1) return y;
            }
            else {
                if (y_prev - y <= 1) return y;
            }
        }
        require(false, "Price: Convergence false");
    }

    function get_y(uint256 i, uint256 j, uint256 x, uint256[N_COINS] memory xp) private view returns (uint256 y) {

        require(i != j);
        require(j >= 0);
        require(j < N_COINS);

        require(i >= 0);
        require(i < N_COINS);

        uint256 amp = a;
        uint256 D = get_D(xp, amp);
        uint256 S_ = 0;
        uint256 _x = 0;
        uint256 y_prev = 0;
        uint256 c = D;
        uint256 Ann = amp * N_COINS;

        for (uint256 _i; _i < N_COINS; ++_i) {
            if (_i == i) _x = x;
            else if (_i != j) _x = xp[_i];
            else continue;
            S_ += _x;
            c = c * D / (_x * N_COINS);
        }

        c = c * D * A_PRECISION / (Ann * N_COINS);
        uint256 b = S_ + D * A_PRECISION / Ann; // - D
        y = D;

        for (uint256 _i; _i < 255; ++_i) {
            y_prev = y;
            y = (y*y + c) / (2 * y + b - D);
            if (y > y_prev && y - y_prev <= 1) return y;
            else if (y_prev - y <= 1) return y;
        }
        require(false, "Curve: Convergence false");
    }
    function calc_token_amount(uint256[N_COINS] memory _amounts, bool _is_deposit) public view returns (uint256) {   
        uint256[N_COINS] memory _balances = balances;

        uint256 D0 = get_D_mem([rate_multiplier, 1e18], _balances, a);
        for (uint256 i; i < N_COINS; ++i) {
            if (_is_deposit) _balances[i] += _amounts[i];
            else _balances[i] -= _amounts[i];
        }
        uint256 D1 = get_D_mem([rate_multiplier, 1e18], _balances, a);
        uint256 diff = 0;
        if (_is_deposit) diff = D1 - D0;
        else diff = D0 - D1;
        return diff * totalSupply() / D0;
    }

    function get_D_mem(uint256[N_COINS] memory _rates, uint256[N_COINS] memory _balances, uint256 _amp) private pure returns (uint256) {
        uint256[N_COINS] memory xp = _xp_mem(_rates, _balances);
        return get_D(xp, _amp);
    }
    
    
    // @openzeppelin/contracts/token/ERC20/ERC20.sol

    mapping (address => uint256) private _balanceOf;

    mapping (address => mapping (address => uint256)) private _allowances;

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual returns (uint256) {
        return supply;
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) public view virtual returns (uint256) {
        return _balanceOf[account];
    }

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

        _balanceOf[sender] = _balanceOf[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balanceOf[recipient] = _balanceOf[recipient].add(amount);
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