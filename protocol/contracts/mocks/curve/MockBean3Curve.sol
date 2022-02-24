contract MockBean3Curve {
    uint256 a;
    uint256[2] balances;
    uint256 supply;
    uint256[2] price_cumulative_last;
    uint256 timestamp_last;

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

    function set_balances(uint256[2] calldata _balances) external {
        balances = _balances;
    }

    function set_supply(uint256 _supply) external {
        supply = _supply;
    }

    function update(uint256[2] calldata new_balances) external {
        price_cumulative_last[0] += balances[0] * (block.timestamp - timestamp_last);
        price_cumulative_last[1] += balances[1] * (block.timestamp - timestamp_last);
        balances = new_balances;
        timestamp_last = block.timestamp;
    }

    function reset_cumulative() external {
        timestamp_last = block.timestamp;
        price_cumulative_last = balances;
    }

    function get_price_cumulative_last() external view returns (uint256[2] memory) {
        return price_cumulative_last;
    }
    
    function block_timestamp_last() external view returns (uint256) {
        return timestamp_last;
    }
}