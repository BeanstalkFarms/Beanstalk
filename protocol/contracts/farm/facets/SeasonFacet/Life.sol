/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../AppStorage.sol";
import "../../ReentrancyGuard.sol";
import "../../../C.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/LibSafeMath32.sol";

/**
 * @author Publius
 * @title Life
**/
contract Life is ReentrancyGuard {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

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
    
    function withdrawSeasons() public view returns (uint8) {
        return s.season.withdrawSeasons;
    }

    function seasonTime() public virtual view returns (uint32) {
        if (block.timestamp < s.season.start) return 0;
        if (s.season.period == 0) return type(uint32).max;
        return uint32((block.timestamp - s.season.start) / s.season.period); // Note: SafeMath is redundant here.
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
            uint256 notHarvestable = s.f.pods - s.f.harvestable; // Note: SafeMath is redundant here.
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

    function setSoil(uint256 amount) internal returns (int) {
        int soil = int(s.f.soil);
        s.f.soil = amount;
        return int(amount) - soil;
    }

   function getMinSoil(uint256 amount) internal view returns (uint256 minSoil) {
        minSoil = amount.mul(100).div(100 + s.w.yield);
    }
}
