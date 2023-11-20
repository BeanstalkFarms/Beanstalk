//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {P} from "./P.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {Call, IWell, IERC20} from "../../interfaces/basin/IWell.sol";
import {IBeanstalkWellFunction} from "../../interfaces/basin/IBeanstalkWellFunction.sol";
import {LibUsdOracle} from "../../libraries/Oracle/LibUsdOracle.sol";
import {LibWellMinting} from "../../libraries/Minting/LibWellMinting.sol";
import {LibWell} from "../../libraries/Well/LibWell.sol";
import {C} from "../../C.sol";

interface IBeanstalk {
    function bdv(address token, uint256 amount) external view returns (uint256);

    function poolDeltaB(address pool) external view returns (int256);
}

interface dec{
    function decimals() external view returns (uint256);
}

contract WellPrice {

    using SafeMath for uint256;
    using SafeCast for uint256;

    IBeanstalk private constant BEANSTALK = IBeanstalk(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);
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

    /**
     * @notice Returns the non-manipulation resistant on-chain liquidiy, deltaB and price data for
     * Bean a given Well.
     * @dev No protocol should use this function to calculate manipulation resistant Bean price data.
    **/
    function getConstantProductWell(address wellAddress) public view returns (P.Pool memory pool) {
        IWell well = IWell(wellAddress);
        pool.pool = wellAddress;
        
        IERC20[] memory wellTokens = well.tokens();
        pool.tokens = [address(wellTokens[0]), address(wellTokens[1])];

        uint256[] memory wellBalances = well.getReserves();
        pool.balances = [wellBalances[0], wellBalances[1]];

        uint256 beanIndex = LibWell.getBeanIndex(wellTokens);
        uint256 tknIndex = beanIndex == 0 ? 1 : 0;

        // swap 1 bean of the opposite asset to get the usd price 
        // price = amtOut/tknOutPrice
        uint256 assetPrice = LibUsdOracle.getUsdPrice(pool.tokens[tknIndex]);
        if(assetPrice > 0) {
            pool.price = 
            well.getSwapOut(wellTokens[beanIndex], wellTokens[tknIndex], 1e6)
                .mul(PRICE_PRECISION)
                .div(assetPrice);
        }

        // liquidity is calculated by getting the usd value of the bean portion of the pool, 
        // and multiplying by 2 to get the total liquidity of the pool.
        pool.liquidity = 
            pool.balances[beanIndex]
            .mul(pool.price)
            .mul(2)
            .div(PRICE_PRECISION);

        pool.deltaB = getDeltaB(wellAddress, wellTokens, wellBalances);
        pool.lpUsd = pool.liquidity.mul(WELL_DECIMALS).div(IERC20(wellAddress).totalSupply());
        try BEANSTALK.bdv(wellAddress, WELL_DECIMALS) returns (uint256 bdv) {
            pool.lpBdv = bdv;
        } catch {}
    }

    function getDeltaB(address well, IERC20[] memory tokens, uint256[] memory reserves) internal view returns (int256 deltaB) {
        Call memory wellFunction = IWell(well).wellFunction();
        (uint256[] memory ratios, uint256 beanIndex, bool success) = LibWell.getRatiosAndBeanIndex(tokens);
        // If the USD Oracle oracle call fails, we can't compute deltaB
        if(!success) return 0;

        uint256 beansAtPeg = IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioSwap(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        );

        deltaB = beansAtPeg.toInt256() - reserves[beanIndex].toInt256();
    }

}
