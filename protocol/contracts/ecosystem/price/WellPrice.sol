//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {P} from "./P.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IWell} from "../../interfaces/basin/IWell.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IBeanstalkWellFunction} from "../../interfaces/basin/IBeanstalkWellFunction.sol";

interface IERC20D {
    function decimals() external view returns (uint8);
}

interface IBDV {
    function bdv(address token, uint256 amount) external view returns (uint256);
}

contract WellPrice {

    using SafeMath for uint256;

    address[2] private tokens = [0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab, 0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490];

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

    function getConstantProductWell(address wellAddress) public view returns (P.Pool memory pool) {
        IWell well = IWell(wellAddress);
        pool.pool = wellAddress;
        IERC20[] memory wellTokens = well.tokens();
        pool.tokens = [address(wellTokens[0]), address(wellTokens[1])];
        uint256[] memory wellBalances = well.getReserves();
        pool.balances = [wellBalances[0],wellBalances[1]];

        pool.price = 0;
        pool.liquidity = 0;
        pool.deltaB = 0;
        pool.lpUsd = 0;
        pool.lpBdv = 0;
    }

}
