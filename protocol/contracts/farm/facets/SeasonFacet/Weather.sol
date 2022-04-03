/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Decimal.sol";
import "../../../libraries/LibMarket.sol";
import "./Silo.sol";

/**
 * @author Publius
 * @title Weather
**/
contract Weather is Silo {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

    event WeatherChange(uint256 indexed season, uint256 caseId, int8 change);
    event SeasonOfPlenty(uint256 indexed season, uint256 eth, uint256 harvestable);

    /**
     * Getters
    **/

    // Weather

    function weather() public view returns (Storage.Weather memory) {
        return s.w;
    }

    function rain() public view returns (Storage.Rain memory) {
        return s.r;
    }

    function yield() public view returns (uint32) {
        return s.w.yield;
    }

    // Reserves

    // (ethereum, beans)
    function reserves() public view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return s.index == 0 ? (reserve1, reserve0) : (reserve0, reserve1);
    }

    // (ethereum, usdc)
    function pegReserves() public view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pegPair().getReserves();
        return (reserve1, reserve0);
    }

    /**
     * Internal
    **/

    function stepWeather(uint256 int_price, uint256 endSoil) internal {

        if (bean().totalSupply() == 0) {
            s.w.yield = 1;
            return;
        }

        Decimal.D256 memory podRate = Decimal.ratio(
            s.f.pods.sub(s.f.harvestable),
            bean().totalSupply()
        );

        uint256 dsoil = s.w.startSoil.sub(endSoil);

        Decimal.D256 memory deltaPodDemand;
        uint256 lastDSoil = s.w.lastDSoil;
        if (dsoil == 0) deltaPodDemand = Decimal.zero();
        else if (lastDSoil == 0) deltaPodDemand = Decimal.from(1e18);
        else deltaPodDemand = Decimal.ratio(dsoil, lastDSoil);

        uint8 caseId = 0;
        if (podRate.greaterThanOrEqualTo(C.getUpperBoundPodRate())) caseId = 24;
        else if (podRate.greaterThanOrEqualTo(C.getOptimalPodRate())) caseId = 16;
        else if (podRate.greaterThanOrEqualTo(C.getLowerBoundPodRate())) caseId = 8;

        if (
            int_price > 1e18 || (int_price == 1e18 &&
            podRate.lessThan(C.getOptimalPodRate()))
        ) {
            caseId += 4;
        }

        if (deltaPodDemand.greaterThanOrEqualTo(C.getUpperBoundDPD())) {
            caseId += 2;
        } else if (deltaPodDemand.greaterThanOrEqualTo(C.getLowerBoundDPD())) {
            if (s.w.lastSowTime == type(uint32).max || !s.w.didSowBelowMin) {
                caseId += 1;
            }
            else if (s.w.didSowFaster) {
                caseId += 2;
                s.w.didSowFaster = false;
            }
        }
        s.w.lastDSoil = dsoil;
        handleExtremeWeather(endSoil);
        changeWeather(caseId);
        handleRain(caseId);
    }

    function handleExtremeWeather(uint256 endSoil) private {
        if (s.w.didSowBelowMin) {
            s.w.didSowBelowMin = false;
            uint256 lsp = endSoil.mul(1e18).div(bean().totalSupply());
            s.w.lastSoilPercent = lsp < type(uint96).max ? uint96(lsp) : type(uint96).max;
            s.w.lastSowTime = s.w.nextSowTime;
            s.w.nextSowTime = type(uint32).max;
        }
        else if (s.w.lastSowTime != type(uint32).max) {
            s.w.lastSowTime = type(uint32).max;
        }
    }

    function changeWeather(uint256 caseId) private {
        int8 change = s.cases[caseId];
        if (change < 0) {
                if (yield() <= (uint32(-change))) {
                    // if (change < 0 && yield() <= uint32(-change)),
                    // then 0 <= yield() <= type(int8).max because change is an int8.
                    // Thus, downcasting yield() to an int8 will not cause overflow.
                    change = 1 - int8(yield());
                    s.w.yield = 1;
                }
                else s.w.yield = yield()-(uint32(-change));
        }
        else s.w.yield = yield()+(uint32(change));

        emit WeatherChange(season(), caseId, change);
    }

    function handleRain(uint256 caseId) internal {
        if (caseId < 4 || caseId > 7) {
            if (s.r.raining) s.r.raining = false;
            return;
        }
        else if (!s.r.raining) {
            s.r.raining = true;
            s.sops[season()] = s.sops[s.r.start];
            s.r.start = season();
            s.r.pods = s.f.pods;
            s.r.roots = s.s.roots;
        }
        else if (season() >= s.r.start.add(s.season.withdrawSeasons - 1)) {
            if (s.r.roots > 0) sop();
        }
    }

    function sop() private {
        (uint256 newBeans, uint256 newEth) = calculateSopBeansAndEth();
        if (
            newEth <= s.s.roots.div(1e20) ||
            (s.sop.base > 0 && newBeans.mul(s.sop.base).div(s.sop.weth).div(s.r.roots) == 0)
        )
            return;

        mintToSilo(newBeans);
        uint256 ethBought = LibMarket.sellToWETH(newBeans, 0);
        uint256 newHarvestable = 0;
        if (s.f.harvestable < s.r.pods) {
            newHarvestable = s.r.pods - s.f.harvestable;
            mintToHarvestable(newHarvestable);
        }
        if (ethBought == 0) return;
        rewardEther(ethBought);
        emit SeasonOfPlenty(season(), ethBought, newHarvestable);
    }

    function calculateSopBeansAndEth() private view returns (uint256, uint256) {
        (uint256 ethBeanPool, uint256 beansBeanPool) = reserves();
        (uint256 ethUSDCPool, uint256 usdcUSDCPool) = pegReserves();

        uint256 newBeans = sqrt(ethBeanPool.mul(beansBeanPool).mul(usdcUSDCPool).div(ethUSDCPool));
        if (newBeans <= beansBeanPool) return (0,0);
        uint256 beans = newBeans - beansBeanPool;
        beans = beans.mul(10000).div(9985).add(1);

        uint256 beansWithFee = beans.mul(997);
        uint256 numerator = beansWithFee.mul(ethBeanPool);
        uint256 denominator = beansBeanPool.mul(1000).add(beansWithFee);
        uint256 eth = numerator / denominator;

        return (beans, eth);
    }

    /**
     * Shed
    **/

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

}
