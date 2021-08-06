/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../AppStorage.sol";
import "../../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title Silo Internal
**/
contract SiloInternal {

    struct IncreaseBases {
        uint256 increaseBase;
        uint256 stalkBase;
        uint256 plentyBase;
        uint256 rainBase;
        uint256 increaseMultiple;
        uint256 stalkMultiple;
        uint32 si;
        uint32 sop;
        uint256 sopBasePerStalkBase;
    }

    using SafeMath for uint256;
    using SafeMath for uint32;

    AppStorage internal s;

    /**
     * Contracts
    **/

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
     * Supply Increase + Season of Plenty
    **/

    function stalkReward(uint256 seeds, uint32 seasons) internal pure returns (uint256) {
        return seeds.mul(seasons);
    }

    function balanceOfRewardedIncreaseStalk(uint256 stalkBase, uint256 increaseBase)
        internal
        view
        returns (uint256)
    {
        if (s.si.stalk == 0 || s.si.increaseBase == 0 || s.si.stalkBase == 0) return 0;
        uint256 increaseStalk = increaseBase.mul(s.si.increase.mul(10000)).div(s.si.increaseBase);
        uint256 minBase = increaseStalk.mul(s.si.stalkBase).div(s.si.stalk);
        if (minBase >= stalkBase) return 0;
        uint256 stalkBaseForIncrease = s.si.increase.mul(10000).mul(s.si.stalkBase).div(s.si.stalk);
        if (s.si.stalkBase == stalkBaseForIncrease) return 0;
        uint256 stalk = (stalkBase).mul(s.si.stalk.sub(s.si.increase.mul(10000))).div(s.si.stalkBase);
        if (stalk > s.si.stalk.sub(s.si.increase.mul(10000))) {
            return s.si.stalk.sub(s.si.increase.mul(10000));
        }
        return stalk;
    }

    function plentyBaseForStalk(address account) internal view returns (uint256) {
        if (s.sop.last <= s.a[account].lastUpdate) return 0;
        uint256 plentyBase;
        uint32 plentySeason = s.sop.last;
        uint32 _lastUpdate = s.a[account].lastUpdate;
        uint256 sopMultiple = 1;
        while (s.sops[plentySeason].rainSeason > _lastUpdate) {
            uint256 stalkAtSeason = s.a[account].s.stalk.add(stalkReward(s.a[account].s.seeds, s.sops[plentySeason].rainSeason - _lastUpdate - 1));
            plentyBase = plentyBase.add(s.sops[plentySeason].base.mul(stalkAtSeason).mul(sopMultiple));
            if (s.rbs[plentySeason].sopMultiple > 0) sopMultiple = sopMultiple.mul(s.rbs[plentySeason].sopMultiple);
            plentySeason = s.sops[plentySeason].next;
        }
        while (plentySeason > _lastUpdate) {
            plentyBase = plentyBase.add(s.sops[plentySeason].base.mul(s.a[account].sop.stalk));
            plentySeason = s.sops[plentySeason].next;
        }
        return plentyBase;
    }

    function increaseBasesForAccount(address account) internal view returns (IncreaseBases memory) {
        IncreaseBases memory b;
        b.si = s.si.lastSupplyIncrease;
        b.sop = s.sop.last;
        if (s.r.raining && s.r.start > s.a[account].lastUpdate) {
            b = increaseBasesWithSop(account, b, s.r.start-1);
            b.rainBase = b.stalkBase;
        }
        b = increaseBasesWithSop(account, b, s.a[account].lastUpdate);
        if (s.r.raining && s.r.start > s.a[account].lastUpdate)
            b.rainBase = b.stalkBase.sub(b.rainBase);
        return b;
    }

    function increaseBasesWithSop(address account, IncreaseBases memory b, uint32 endSeason)
        private
        view
        returns (IncreaseBases memory)
    {
        uint256 previousStalkBase = b.stalkBase;
        while (b.sop > endSeason) {
            if (b.si > s.sops[b.sop].rainSeason)
                b = increaseBases(
                    account,
                    b,
                    (s.sops[b.sop].rainSeason-1) > endSeason ? (s.sops[b.sop].rainSeason-1) : endSeason
                );
            b.plentyBase = b.plentyBase.add(b.sopBasePerStalkBase.mul(b.stalkBase.sub(previousStalkBase)));
            b.sopBasePerStalkBase = b.sopBasePerStalkBase.add(s.sops[b.sop].increaseBase);
            previousStalkBase = b.stalkBase;
            b.sop = s.sops[b.sop].next;
        }
        b = increaseBases(account, b, endSeason);
        if (b.sopBasePerStalkBase > 0)
            b.plentyBase = b.plentyBase.add(b.sopBasePerStalkBase.mul(b.stalkBase.sub(previousStalkBase)));
        return b;
    }

    function increaseBases(address account, IncreaseBases memory b, uint32 endSeason)
        private
        view
        returns
        (IncreaseBases memory)
    {
        while (b.si > endSeason) {
            uint256 stalkAtSeason = s.a[account].s.stalk.add(stalkReward(s.a[account].s.seeds, b.si - s.a[account].lastUpdate - 1));
            if (b.increaseMultiple == 0) b.increaseBase = b.increaseBase.add(s.seasons[b.si].increaseBase.mul(stalkAtSeason));
            else b.increaseBase = b.increaseBase.add(s.seasons[b.si].increaseBase.mul(stalkAtSeason).mul(b.increaseMultiple));
            if (b.stalkMultiple == 0) b.stalkBase = b.stalkBase.add(s.seasons[b.si].stalkBase.mul(stalkAtSeason));
            else b.stalkBase = b.stalkBase.add(s.seasons[b.si].stalkBase.mul(stalkAtSeason).mul(b.stalkMultiple));
            if (s.rbs[b.si].increaseMultiple > 0) b.increaseMultiple = b.increaseMultiple > 0 ? b.increaseMultiple.mul(s.rbs[b.si].increaseMultiple) : s.rbs[b.si].increaseMultiple;
            if (s.rbs[b.si].stalkMultiple > 0) b.stalkMultiple = b.stalkMultiple > 0 ? b.stalkMultiple.mul(s.rbs[b.si].stalkMultiple) : s.rbs[b.si].stalkMultiple;
            b.si = s.seasons[b.si].next;
        }
        return b;
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

}
