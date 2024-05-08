//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract P {
    struct Pool {
        address pool;
        address[2] tokens;
        uint256[2] balances;
        uint256 price;
        uint256 liquidity;
        int256 deltaB;
        uint256 lpUsd;
        uint256 lpBdv;
    }

    struct Prices {
        address pool;
        address[] tokens;
        uint256 price;
        uint256 liquidity;
        int deltaB;
        P.Pool[] ps;
    }
}
