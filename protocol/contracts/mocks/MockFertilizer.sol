/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "contracts/tokens/Fertilizer/Fertilizer.sol";

/**
 * @author Publius
 * @title MockFertilizer is a Mock version of Fertilizer
 **/
contract MockFertilizer is Fertilizer {
    function initialize() public initializer {
        __Internallize_init("");
    }

    /**
     * @dev No access control for testing.
     */
    function beanstalkUpdate(
        address account,
        uint256[] memory ids,
        uint128 bpf
    ) external override returns (uint256) {
        return __update(account, ids, uint256(bpf));
    }

    /**
     * @dev No access control for testing.
     */
    function beanstalkMint(
        address account,
        uint256 id,
        uint128 amount,
        uint128 bpf
    ) external override {
        _beanstalkMint(account, id, amount, bpf);
    }

    /**
     * @dev No access control for testing.
     */
    function beanstalkBurn(
        address account,
        uint256 id,
        uint128 amount,
        uint128 bpf
    ) external override {
        _beanstalkBurn(account, id, amount, bpf);
    }
}
