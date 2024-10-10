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
}
