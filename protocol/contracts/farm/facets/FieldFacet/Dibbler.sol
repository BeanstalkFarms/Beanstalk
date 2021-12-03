/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../C.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/Decimal.sol";
import "../../../libraries/LibCheck.sol";

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
     * Shed
    **/

    function _sow(uint256 amount, address account) internal returns (uint256) {
        require(amount > 0, "Field: Must purchase non-zero amount.");
        s.f.soil = s.f.soil.sub(amount, "Field: Not enough outstanding Soil.");
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function _sowNoSoil(uint256 amount, address account) internal returns (uint256) {
        require(amount > 0, "Field: Must purchase non-zero amount.");
        uint256 pods = beansToPods(amount, s.w.yield);
        sowPlot(account, amount, pods);
        s.f.pods = s.f.pods.add(pods);
        saveSowTime();
        return pods;
    }

    function sowPlot(address account, uint256 beans, uint256 pods) internal {
        s.a[account].field.plots[s.f.pods] = pods;
        emit Sow(account, s.f.pods, beans, pods);
    }

    function beansToPods(uint256 beanstalks, uint256 y) internal pure returns (uint256) {
        Decimal.D256 memory rate = Decimal.ratio(y, 100).add(Decimal.one());
        return Decimal.from(beanstalks).mul(rate).asUint256();
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

    function saveSowTime() private {
        uint256 totalBeanSupply = bean().totalSupply();
        if (s.f.soil >= totalBeanSupply.div(C.getComplexWeatherDenominator())) return;

        uint256 sowTime = block.timestamp.sub(s.season.timestamp);
        s.w.nextSowTime = uint32(sowTime);
        uint96 soilPercent = uint96(s.f.soil.mul(1e18).div(totalBeanSupply));
        if (!s.w.didSowBelowMin) s.w.didSowBelowMin = true;

        if (
            soilPercent <= C.getUpperBoundPodRate().mul(s.w.lastSoilPercent).asUint256() &&
            !s.w.didSowFaster &&
            s.w.lastSowTime != MAX_UINT32 &&
            s.w.lastDSoil != 0
        ) {
            uint256 deltaSoil = s.w.startSoil.sub(s.f.soil);
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