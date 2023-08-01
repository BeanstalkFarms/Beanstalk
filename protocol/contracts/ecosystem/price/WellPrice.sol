//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {P} from "./P.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IWell, IERC20} from "../../interfaces/basin/IWell.sol";
import {IBeanstalkWellFunction} from "../../interfaces/basin/IBeanstalkWellFunction.sol";
import {LibUsdOracle} from "../../libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "../../libraries/Minting/LibWellMinting.sol";
import {LibWell} from "../../libraries/Well/LibWell.sol";
import {C} from "../../C.sol";

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
        pool.balances = [wellBalances[0], wellBalances[1]];

        uint256 beanIndex = LibWell.getBeanIndex(wellTokens);


        // swap 1 bean of the opposite asset to get the price
        uint256 amtOut = well.getSwapOut(wellTokens[beanIndex], wellTokens[beanIndex == 0 ? 1 : 0], 1e6); 
       
        // get price of other token to price pool
        uint256 tknUsdPrice = LibUsdOracle.getUsdPrice(address(wellTokens[beanIndex == 0 ? 1 : 0]));
        pool.price = amtOut.mul(tknUsdPrice).div(1e12);

        pool.liquidity = pool.balances[beanIndex] + pool.balances[beanIndex == 0 ? 1 : 0] * tknUsdPrice;
        pool.deltaB = LibWellMinting.check(wellAddress);
        pool.lpUsd = pool.liquidity.mul(pool.price).div(1e6);
        pool.lpBdv = pool.liquidity;
    }

}
