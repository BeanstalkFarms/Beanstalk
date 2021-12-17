/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../AppStorage.sol";
import "../../../C.sol";
import "../../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title Life
**/
contract Life {

    using SafeMath for uint256;
    using SafeMath for uint32;

    AppStorage internal s;

    /**
     * Getters
    **/

    // Contracts

    function bean() public view returns (IBean) {
        return IBean(s.c.bean);
    }

    function pair() public view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function pegPair() public view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pegPair);
    }

    // Time

     function time() external view returns (Storage.Season memory) {
         return s.season;
     }

    function season() public view returns (uint32) {
        return s.season.current;
    }

    function seasonTime() public virtual view returns (uint32) {
        if (block.timestamp < s.season.start) return 0;
        if (s.season.period == 0) return uint32(-1);
        return uint32((block.timestamp.sub(s.season.start).div(s.season.period)));
    }

    function incentiveTime() internal view returns (uint256) {
        uint256 timestamp = block.timestamp.sub(
            s.season.start.add(s.season.period.mul(season()))
        );
        if (timestamp > 300) timestamp = 300;
        return timestamp;
    }

    /**
     * Internal
    **/

    function increaseSupply(uint256 newSupply) internal returns (uint256, uint256) {
        (uint256 newHarvestable, uint256 siloReward) = (0, 0);

        if (s.f.harvestable < s.f.pods) {
            uint256 notHarvestable = s.f.pods.sub(s.f.harvestable);
            newHarvestable = newSupply.mul(C.getHarvestPercentage()).div(1e18);
            newHarvestable = newHarvestable > notHarvestable ? notHarvestable : newHarvestable;
            mintToHarvestable(newHarvestable);
        }

        if (s.s.seeds == 0 && s.s.stalk == 0) return (newHarvestable,0);
        siloReward = newSupply.sub(newHarvestable);
        if (siloReward > 0) {
            mintToSilo(siloReward);
        }
        return (newHarvestable, siloReward);
    }

    function mintToSilo(uint256 amount) internal {
        if (amount > 0) {
            bean().mint(address(this), amount);
        }
    }

    function mintToHarvestable(uint256 amount) internal {
        bean().mint(address(this), amount);
        s.f.harvestable = s.f.harvestable.add(amount);
    }

    function mintToAccount(address account, uint256 amount) internal {
        bean().mint(account, amount);
    }

    /**
     * Soil
    **/

    function increaseSoil(uint256 amount) internal returns (int256) {
        uint256 maxTotalSoil = getMaxSoil();
        uint256 soil = s.f.soil;
        if (soil > maxTotalSoil) {
            amount = soil.sub(maxTotalSoil);
            decrementTotalSoil(amount);
            return -int256(amount);
        }
        uint256 newTotalSoil = soil.add(amount);
        if (newTotalSoil > maxTotalSoil) amount = maxTotalSoil.sub(soil);
        incrementTotalSoil(amount);
        return int256(amount);
    }

    function decreaseSoil(uint256 amount, uint256 harvested) internal returns (int256) {
        uint256 minTotalSoil = getMinSoil(harvested);
        uint256 soil = s.f.soil;
        if (soil < minTotalSoil) {
            amount = minTotalSoil.sub(soil);
            incrementTotalSoil(amount);
            return int256(amount);
        }
        if (amount > soil) {
            amount = soil.sub(minTotalSoil);
        } else {
            uint256 newTotalSoil = soil.sub(amount);
            uint256 maxTotalSoil = getMaxSoil();
            if (newTotalSoil > maxTotalSoil) amount = soil.sub(maxTotalSoil);
            else if (newTotalSoil < minTotalSoil) amount = soil.sub(minTotalSoil);
        }

        decrementTotalSoil(amount);
        return -int256(amount);
    }

    function ensureSoilBounds() internal returns (int256) {
        uint256 maxTotalSoil = getMaxSoil();
        if (s.f.soil > maxTotalSoil) {
            uint256 amount = s.f.soil.sub(maxTotalSoil);
            decrementTotalSoil(amount);
            return -int256(amount);
        }
        return 0;
    }

    function getMaxSoil() internal view returns (uint256 maxSoil) {
        maxSoil = bean().totalSupply().div(C.getMaxSoilDenominator());
    }
    
   function getMinSoil(uint256 amount) internal view returns (uint256 minSoil) {
        minSoil = amount.mul(100).div(100 + s.w.yield);
    }

    function incrementTotalSoil(uint256 amount) internal {
        s.f.soil = s.f.soil.add(amount);
    }

    function decrementTotalSoil(uint256 amount) internal {
        s.f.soil = s.f.soil.sub(amount, "Season: Not enough Soil.");
    }

}
