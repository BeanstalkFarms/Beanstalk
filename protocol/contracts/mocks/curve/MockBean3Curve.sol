
contract MockBean3Curve {
    uint256 a;
    uint256[2] balances;
    uint256 supply;

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

    function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount) external returns (uint256) {
        uint256[2] memory old_balances = balances;
        // D0: uint256 = self.get_D_mem(rates, old_balances, amp)
        uint256[2] memory new_balances = old_balances;
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            if (supply == 0) {
                require(amount > 0, "dev: initial deposit requires all coins");
            }
            new_balances[i] += amount;
        }
        
    }
}