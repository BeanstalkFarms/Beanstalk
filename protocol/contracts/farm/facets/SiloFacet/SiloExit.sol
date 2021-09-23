/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../../C.sol";
import "../../../interfaces/IWETH.sol";
import "../../AppStorage.sol";
import "../../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title Silo Exit
**/
contract SiloExit {

    using SafeMath for uint256;
    using SafeMath for uint32;

    AppStorage internal s;

    /**
     * Contracts
    **/

    function weth() public view returns (IWETH) {
        return IWETH(s.c.weth);
    }

    function index() internal view returns (uint8) {
        return s.index;
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }

    function season() internal view returns (uint32) {
        return s.season.current;
    }

    /**
     * Silo
    **/

    function totalStalk() public view returns (uint256) {
        return s.s.stalk;
    }

    function totalRoots() public view returns(uint256) {
        return s.s.roots;
    }

    function totalSeeds() public view returns (uint256) {
        return s.s.seeds;
    }

    function totalFarmableBeans() public view returns (uint256) {
        return s.si.beans;
    }

    function totalFarmableStalk() public view returns (uint256) {
        return s.si.stalk;
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds.add(balanceOfFarmableBeans(account).mul(C.getSeedsPerBean()));
    }

    function balanceOfStalk(address account) public view returns (uint256) {
        uint256 farmableBeans = balanceOfFarmableBeans(account);
        uint256 farmableStalk = balanceOfFarmableStalkFromBeans(account, farmableBeans);
        return s.a[account].s.stalk.add(farmableBeans.mul(C.getStalkPerBean())).add(farmableStalk);
    }

    function balanceOfRoots(address account) public view returns (uint256) {
        return s.a[account].roots;
    }

    function balanceOfGrownStalk(address account) public view returns (uint256) {
        return stalkReward(s.a[account].s.seeds, season()-lastUpdate(account));
    }

    function balanceOfFarmableStalk(address account) public view returns (uint256) {
        uint256 farmableBeans = balanceOfFarmableBeans(account);
        return balanceOfFarmableStalkFromBeans(account, farmableBeans);
    }

    function balanceOfFarmableBeans(address account) public view returns (uint256) {
        if (s.s.roots == 0 || s.si.beans == 0) return 0;
        uint256 stalk = totalStalk().sub(s.si.stalk).mul(balanceOfRoots(account)).div(s.s.roots);
        if (stalk <= s.a[account].s.stalk) return 0;
        uint256 beans = stalk.sub(s.a[account].s.stalk).div(C.getStalkPerBean());
        if (beans > s.si.beans) return s.si.beans;
        return beans;
    }

    function balanceOfFarmableSeeds(address account) public view returns (uint256) {
        return balanceOfFarmableBeans(account).mul(C.getSeedsPerBean());
    }

    function balanceOfFarmableStalkFromBeans(address account, uint256 beans) internal view returns (uint256) {
        if (beans == 0) return 0;
        uint256 seeds = beans.mul(C.getSeedsPerBean());
        uint256 stalk = balanceOfGrownFarmableStalk(account, beans);
        uint32 _s = uint32(stalk.div(seeds));
        if (_s >= season()) _s = season()-1;
        uint256 leftoverStalk = stalk.sub(seeds.mul(_s));
        if (_s < season()-1) {
            uint256 previousSeasonBeans = leftoverStalk.div(C.getSeedsPerBean());
            leftoverStalk = leftoverStalk.sub(previousSeasonBeans.mul(C.getSeedsPerBean()));
        }
        return stalk.sub(leftoverStalk);
    }

    function balanceOfGrownFarmableStalk(address account, uint256 beans) internal view returns (uint256) {
        if (s.s.roots == 0 || s.si.stalk == 0) return 0;
        uint256 stalk = balanceOfAllFarmableStalk(account);
        uint256 stalkFromBeans = beans.mul(C.getStalkPerBean());
        if (stalk <= stalkFromBeans) return 0;
        stalk = stalk.sub(stalkFromBeans);
        if (stalk > s.si.stalk) return s.si.stalk;
        return stalk;
    }

    function balanceOfAllFarmableStalk(address account) public view returns (uint256) {
        uint256 stalk = totalStalk().mul(balanceOfRoots(account)).div(s.s.roots);
        if (stalk <= s.a[account].s.stalk) return 0;
        return stalk.sub(s.a[account].s.stalk);
    }

    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    /**
     * Season Of Plenty
    **/

    function lastSeasonOfPlenty() public view returns (uint32) {
        return s.sop.last;
    }

    function seasonsOfPlenty() public view returns (Storage.SeasonOfPlenty memory) {
        return s.sop;
    }

    function balanceOfEth(address account) public view returns (uint256) {
        if (s.sop.base == 0) return 0;
        return balanceOfPlentyBase(account).mul(s.sop.weth).div(s.sop.base);
    }

    function balanceOfPlentyBase(address account) public view returns (uint256) {
        uint256 plenty = s.a[account].sop.base;
        uint32 endSeason = s.a[account].lastSop;
        uint256 plentyPerRoot;
        uint256 rainSeasonBase = s.sops[s.a[account].lastRain];
        if (rainSeasonBase > 0) {
            if (endSeason == s.a[account].lastRain) {
                plentyPerRoot = rainSeasonBase.sub(s.a[account].sop.basePerRoot);
            } else {
                plentyPerRoot = rainSeasonBase.sub(s.sops[endSeason]);
                endSeason = s.a[account].lastRain;
            }
            if (plentyPerRoot > 0) plenty = plenty.add(plentyPerRoot.mul(s.a[account].sop.roots));
        }

        if (s.sop.last > lastUpdate(account)) {
            plentyPerRoot = s.sops[s.sop.last].sub(s.sops[endSeason]);
            plenty = plenty.add(plentyPerRoot.mul(balanceOfRoots(account)));
        }
        return plenty;
    }

    function balanceOfRainRoots(address account) public view returns (uint256) {
        return s.a[account].sop.roots;
    }

    /**
     * Governance
    **/

    function lockedUntil(address account) public view returns (uint32) {
        if (locked(account)) {
            return s.a[account].lockedUntil;
        }
        return 0;
    }

    function locked(address account) public view returns (bool) {
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                    uint32 activeBip = s.g.activeBips[i];
                    if (s.g.voted[activeBip][account]) {
                        return true;
                    }
            }
        }
        return false;
    }

    /**
     * Shed
    **/

    function reserves() internal view returns (uint256, uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair().getReserves();
        return (index() == 0 ? reserve1 : reserve0,index() == 0 ? reserve0 : reserve1);
    }

    function lpToLPBeans(uint256 amount) internal view returns (uint256) {
        (,uint256 beanReserve) = reserves();
        return amount.mul(beanReserve).mul(2).div(pair().totalSupply());
    }

    function stalkReward(uint256 seeds, uint32 seasons) internal pure returns (uint256) {
        return seeds.mul(seasons);
    }

    /**
     * Migration
    **/

    function balanceOfMigrationRoots(address account) internal view returns (uint256) {
        return balanceOfMigrationStalk(account).mul(C.getRootsBase());
    }

    function balanceOfMigrationStalk(address account) private view returns (uint256) {
        return s.a[account].s.stalk.add(stalkReward(s.a[account].s.seeds, s.bip0Start-lastUpdate(account)));
    }

}
