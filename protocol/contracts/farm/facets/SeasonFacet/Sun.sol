/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Weather.sol";

/**
 * @author Publius
 * @title Sun
**/
contract Sun is Weather {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event SupplyIncrease(
        uint256 indexed season,
        uint256 price,
        uint256 newHarvestable,
        uint256 newSilo,
        int256 newSoil
    );
    event SupplyDecrease(uint256 indexed season, uint256 price, int256 newSoil);
    event SupplyNeutral(uint256 indexed season, int256 newSoil);

    /**
     * Internal
    **/

    // Sun

    function stepSun(Decimal.D256 memory beanPrice, Decimal.D256 memory usdcPrice)
        internal
        returns
        (uint256)
    {
        (uint256 eth_reserve, uint256 bean_reserve) = lockedReserves();

        uint256 currentBeans = sqrt(
            bean_reserve.mul(eth_reserve).mul(1e6).div(beanPrice.mul(1e18).asUint256())
        );
        uint256 targetBeans = sqrt(
            bean_reserve.mul(eth_reserve).mul(1e6).div(usdcPrice.mul(1e18).asUint256())
        );

        uint256 price = beanPrice.mul(1e18).div(usdcPrice).asUint256();
        uint256 newSilo;

        if (currentBeans < targetBeans) {
            newSilo = growSupply(targetBeans.sub(currentBeans), price);
        } else if (currentBeans > targetBeans) {
            shrinkSupply(currentBeans.sub(targetBeans), price);
        } else {
            int256 newSoil = setSoil(0);
            emit SupplyNeutral(season(), newSoil);
        }
        s.w.startSoil = s.f.soil;
        return newSilo;
    }

    function shrinkSupply(uint256 beans, uint256 price) private {
        int256 newSoil = setSoil(beans);
        emit SupplyDecrease(season(), price, newSoil);
    }

    function growSupply(uint256 beans, uint256 price) private returns (uint256) {
        (uint256 newHarvestable, uint256 newSilo) = increaseSupply(beans);
        int256 newSoil = setSoil(getMinSoil(newHarvestable));
        emit SupplyIncrease(season(), price, newHarvestable, newSilo, newSoil);
        return newSilo;
    }

    // (ethereum, beans)
    function lockedReserves() public view returns (uint256, uint256) {
        (uint ethReserve, uint beanReserve) = reserves();
        uint lp = pair().totalSupply();
        if (lp == 0) return (0,0);
        uint lockedLP = s.lp.deposited.add(s.lp.withdrawn);
        ethReserve = ethReserve.mul(lockedLP).div(lp);
        beanReserve = beanReserve.mul(lockedLP).div(lp);
        return (ethReserve, beanReserve);
    }

}
