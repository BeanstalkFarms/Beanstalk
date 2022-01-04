/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "../interfaces/IBean.sol";
import "./Decimal.sol";
import "./LibCheck.sol";
import "./LibAppStorage.sol";

/**
 * @author Publius
 * @title Dibbler
**/
library LibDibbler {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    uint32 private constant MAX_UINT32 = 2**32-1;

    event Sow(address indexed account, uint256 index, uint256 beans, uint256 pods);

    /**
     * Shed
    **/

    function sow(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(amount > 0, "Field: Must purchase non-zero amount.");
        s.f.soil = s.f.soil.sub(amount, "Field: Not enough outstanding Soil.");
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function sowNoSoil(uint256 amount, address account) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(amount > 0, "Field: Must purchase non-zero amount.");
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function sowPlot(address account, uint256 beans, uint256 pods) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    function beansToPods(uint256 beanstalks, uint256 y) private pure returns (uint256) {
        Decimal.D256 memory rate = Decimal.ratio(y, 100).add(Decimal.one());
        return Decimal.from(beanstalks).mul(rate).asUint256();
    }

    function saveSowTime() private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 totalBeanSupply = IBean(s.c.bean).totalSupply();
        uint256 soil = s.f.soil;
        if (soil >= totalBeanSupply.div(C.getComplexWeatherDenominator())) return;

        uint256 sowTime = block.timestamp.sub(s.season.timestamp);
        s.w.nextSowTime = uint32(sowTime);
        if (!s.w.didSowBelowMin) s.w.didSowBelowMin = true;

        if (s.w.didSowFaster ||
            s.w.lastSowTime == MAX_UINT32 ||
            s.w.lastDSoil == 0
        ) return;

        uint96 soilPercent = uint96(soil.mul(1e18).div(totalBeanSupply));
        if (soilPercent <= C.getUpperBoundPodRate().mul(s.w.lastSoilPercent).asUint256()) {
            uint256 deltaSoil = s.w.startSoil.sub(soil);
            if (Decimal.ratio(deltaSoil, s.w.lastDSoil).greaterThan(C.getLowerBoundDPD())) {
                uint256 fasterTime =
                    s.w.lastSowTime > C.getSteadySowTime() ?
                    s.w.lastSowTime.sub(C.getSteadySowTime()) :
                    0;
                if (sowTime < fasterTime) s.w.didSowFaster = true;
                else s.w.lastSowTime = MAX_UINT32;
            }
        }
    }

}