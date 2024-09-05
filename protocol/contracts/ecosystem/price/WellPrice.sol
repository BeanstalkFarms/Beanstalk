//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {P} from "./P.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Call, IWell, IERC20} from "../../interfaces/basin/IWell.sol";
import {IBeanstalkWellFunction} from "../../interfaces/basin/IBeanstalkWellFunction.sol";
import {C} from "../../C.sol";

interface IBeanstalk {
    function bdv(address token, uint256 amount) external view returns (uint256);

    function poolCurrentDeltaB(address pool) external view returns (int256 deltaB);

    function getUsdTokenPrice(address token) external view returns (uint256);

    function getBeanIndex(IERC20[] memory tokens) external view returns (uint256);

    function getWhitelistedWellLpTokens() external view returns (address[] memory tokens);
}

interface dec {
    function decimals() external view returns (uint256);
}

contract WellPrice {
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;

    IBeanstalk immutable beanstalk;

    constructor(address _beanstalk) {
        beanstalk = IBeanstalk(_beanstalk);
    }
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
     * Bean in a given Well.
     * @dev No protocol should use this function to calculate manipulation resistant Bean price data.
     **/
    function getWell(address wellAddress) public view returns (P.Pool memory pool) {
        IWell well = IWell(wellAddress);
        pool.pool = wellAddress;

        IERC20[] memory wellTokens = well.tokens();
        pool.tokens = [address(wellTokens[0]), address(wellTokens[1])];

        uint256[] memory wellBalances = well.getReserves();
        pool.balances = [wellBalances[0], wellBalances[1]];

        uint256 beanIndex = beanstalk.getBeanIndex(wellTokens);
        uint256 tknIndex = beanIndex == 0 ? 1 : 0;

        // swap 1 bean of the opposite asset to get the usd price
        // price = amtOut/tknOutPrice
        uint256 assetPrice = beanstalk.getUsdTokenPrice(pool.tokens[tknIndex]);
        if (assetPrice > 0) {
            pool.price = well
                .getSwapOut(wellTokens[beanIndex], wellTokens[tknIndex], 1e6)
                .mul(PRICE_PRECISION)
                .div(assetPrice);
        }

        // liquidity is calculated by getting the usd value of the bean portion of the pool,
        // and multiplying by 2 to get the total liquidity of the pool.
        pool.liquidity = pool.balances[beanIndex].mul(pool.price).mul(2).div(PRICE_PRECISION);

        pool.deltaB = beanstalk.poolCurrentDeltaB(wellAddress);
        pool.lpUsd = pool.liquidity.mul(WELL_DECIMALS).div(IERC20(wellAddress).totalSupply());
        try beanstalk.bdv(wellAddress, WELL_DECIMALS) returns (uint256 bdv) {
            pool.lpBdv = bdv;
        } catch {}
    }
}
