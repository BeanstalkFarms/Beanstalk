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

interface IBEANSTALK {
    function bdv(address token, uint256 amount) external view returns (uint256);

    function poolDeltaB(address pool) external view returns (int256);
}

interface dec{
    function decimals() external view returns (uint256);
}

contract WellPrice {

    using SafeMath for uint256;

    address private constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
    uint256 private constant WELL_DECIMALS = 1e18;
    uint256 private constant PRICE_PRECISION = 1e6;

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

        {
            uint256[] memory wellBalances = well.getReserves();
            pool.balances = [wellBalances[0], wellBalances[1]];
        }

        uint256 beanIndex = LibWell.getBeanIndex(wellTokens);
        uint256 tknIndex = beanIndex == 0 ? 1 : 0;

        // swap 1 bean of the opposite asset to get the usd price 
        // price = amtOut/tknOutPrice
        pool.price = 
            well.getSwapOut(wellTokens[beanIndex], wellTokens[tknIndex], 1e6) // 1e18
            .mul(PRICE_PRECISION) // 1e6 
            .div(LibUsdOracle.getUsdPrice(address(wellTokens[tknIndex]))); // 1e18

        // liquidity is calculated by beanAmt * beanPrice * 2
        pool.liquidity = 
            pool.balances[beanIndex] // 1e6
            .mul(pool.price) // 1e6
            .div(PRICE_PRECISION)
            .mul(2);

        pool.deltaB = IBEANSTALK(BEANSTALK).poolDeltaB(wellAddress);

        pool.lpUsd = pool.liquidity.mul(WELL_DECIMALS).div(IERC20(wellAddress).totalSupply());

        pool.lpBdv = IBEANSTALK(BEANSTALK).bdv(wellAddress, WELL_DECIMALS);

    }

}
