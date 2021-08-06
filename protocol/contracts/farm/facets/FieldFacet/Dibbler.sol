/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../C.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/Decimal.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";

/**
 * @author Publius
 * @title Dibbler
**/
contract Dibbler {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    AppStorage internal s;
    uint32 private constant MAX_UINT32 = 2**32-1;

    event Sow(address indexed account, uint256 index, uint256 beans, uint256 pods);

    /**
     * Getters
    **/

    function totalPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvested);
    }

    function podIndex() public view returns (uint256) {
        return s.f.pods;
    }

    function harvestableIndex() public view returns (uint256) {
        return s.f.harvestable;
    }

    function harvestedIndex() public view returns (uint256) {
        return s.f.harvested;
    }

    function totalHarvestable() public view returns (uint256) {
        return s.f.harvestable.sub(s.f.harvested);
    }

    function totalUnripenedPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvestable);
    }

    function plot(address account, uint256 plotId) public view returns (uint256) {
        return s.a[account].field.plots[plotId];
    }

    function totalSoil() public view returns (uint256) {
        return s.f.soil;
    }

    /**
     * Internal
    **/

    function _sowBeans(uint256 amount) internal returns (uint256) {
        require(amount > 0, "Field: Must purchase non-zero amount.");
        require (totalSoil() >= amount, "Field: Not enough outstanding Soil.");
        burn(amount);
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(msg.sender, amount, pods);
        incrementTotalPods(pods);
        saveSowTime();
        LibCheck.beanBalanceCheck();

        return pods;
    }

    function incrementTotalPods(uint256 amount) internal {
        s.f.pods = s.f.pods.add(amount);
    }

    function sowPlot(address account, uint256 beans, uint256 pods) internal {
        s.a[account].field.plots[podIndex()] = pods;
        emit Sow(msg.sender, podIndex(), beans, pods);
    }

    function burn(uint256 amount) private {
        bean().burn(amount);
        s.f.soil = s.f.soil.sub(amount, "Field: Not enough outstanding Soil.");
    }

    function saveSowTime() private {
        uint256 totalBeanSupply = bean().totalSupply();
        uint256 minTotalSoil = C.getMinSoilRatioCap().mul(bean().totalSupply()).div(1e18);
        if (totalSoil() >= minTotalSoil) return;

        uint256 sowTime = block.timestamp.sub(s.season.timestamp);
        s.w.nextSowTime = uint32(sowTime);
        uint96 soilPercent = uint96(totalSoil().mul(1e18).div(totalBeanSupply));
        if (!s.w.didSowBelowMin) s.w.didSowBelowMin = true;

        if (
            soilPercent <= C.getUpperBoundPodRate().mul(s.w.lastSoilPercent).asUint256() &&
            !s.w.didSowFaster &&
            s.w.lastSowTime != MAX_UINT32 &&
            s.w.lastDSoil != 0
        ) {
            uint256 deltaSoil = s.w.startSoil.sub(totalSoil());
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

    /**
     * Shed
    **/

    function beansToPods(uint256 beanstalks, uint256 y) private pure returns (uint256) {
        Decimal.D256 memory rate = Decimal.ratio(y, 100).add(Decimal.one());
        return Decimal.from(beanstalks).mul(rate).asUint256();
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

}
