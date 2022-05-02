/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SeasonFacet/SeasonFacet.sol";
import "../../libraries/Decimal.sol";
import "../MockToken.sol";

/**
 * @author Publius
 * @title Mock Season Facet
**/
contract MockSeasonFacet is SeasonFacet {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    function reentrancyGuardTest() public nonReentrant {
        reentrancyGuardTest();
    }

    function siloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        mockStepSilo(amount);
    }

    function mockStepSilo(uint256 amount) public {
        if ((s.s.seeds == 0 && s.s.stalk == 0)) {
            stepSilo(0);
            return;
        }
        mintToSilo(amount);
        stepSilo(amount);

    }

    function rainSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        handleRain(4);
    }

    function rainSiloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        handleRain(4);
        mockStepSilo(amount);
    }

    function droughtSiloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        handleRain(3);
        mockStepSilo(amount);
    }

    function sunSunrise(int256 deltaB) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        uint256 siloReward = stepSun(deltaB);
        s.bean.deposited = s.bean.deposited.add(siloReward);
    }

    function lightSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
    }

    function teleportSunrise(uint32 _s) public {
        s.season.current = _s;
    }

    function siloSunrises(uint256 number) public {
        require(!paused(), "Season: Paused.");
        for (uint256 i = 0; i < number; i++) {
            s.season.current += 1;
            stepSilo(0);
        }
    }

    function farmSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.timestamp = block.timestamp;
    }

    function farmSunrises(uint256 number) public {
        require(!paused(), "Season: Paused.");
        for (uint256 i = 0; i < number; i++) {
            s.season.current += 1;
            s.season.timestamp = block.timestamp;
        }
    }

    function halfWeekSunrise() public {
            teleportSunrise(84);
            decrementWithdrawSeasons();
    }
    
    function weekSunrise() public {
            teleportSunrise(168);
            decrementWithdrawSeasons();
    }

    function decrementSunrise(uint256 week) public {
            for (uint256 i = 0; i < week; i++) {
                    weekSunrise();
            }
    }
    

    function setYieldE(uint32 number) public {
        s.w.yield = number;
    }

    function setStartSoilE(uint256 number) public {
        s.w.startSoil = number;
    }

    function setLastDSoilE(uint256 number) public {
        s.w.lastDSoil = number;
    }

    function setNextSowTimeE(uint32 time) public {
        s.w.nextSowTime = time;
    }

    function setLastSowTimeE(uint32 number) public {
        s.w.lastSowTime = number;
    }

    function setLastSoilPercentE(uint96 number) public {
        s.w.lastSoilPercent = number;
    }

    function setSoilE(uint256 amount) public returns (int256) {
        return setSoil(amount);
    }

    function minSoil(uint256 amount) public view returns (uint256) {
        return getMinSoil(amount);
    }

    function resetAccount(address account) public {
        uint32 _s = season();
        for (uint32 j = 0; j <= _s; j++) {
            if (s.a[account].field.plots[j] > 0) s.a[account].field.plots[j];
            if (s.a[account].bean.deposits[j] > 0) delete s.a[account].bean.deposits[j];
            if (s.a[account].lp.deposits[j] > 0) delete s.a[account].lp.deposits[j];
            if (s.a[account].lp.depositSeeds[j] > 0) delete s.a[account].lp.depositSeeds[j];
            if (s.a[account].bean.withdrawals[j+C.getSiloWithdrawSeasons()] > 0)
                delete s.a[account].bean.withdrawals[j+C.getSiloWithdrawSeasons()];
            if (s.a[account].lp.withdrawals[j+C.getSiloWithdrawSeasons()] > 0)
                delete s.a[account].lp.withdrawals[j+C.getSiloWithdrawSeasons()];
        }
        for (uint32 i = 0; i < s.g.bipIndex; i++) {
                s.g.voted[i][account] = false;
        }
        delete s.a[account];
        
        resetAccountToken(account, C.curveMetapoolAddress());
    }

    function resetAccountToken(address account, address token) public {
        uint32 _s = season();
        for (uint32 j = 0; j <= _s; j++) {
            if (s.a[account].deposits[token][j].amount > 0) delete s.a[account].deposits[token][j];
            if (s.a[account].withdrawals[token][j+C.getSiloWithdrawSeasons()] > 0)
                delete s.a[account].withdrawals[token][j+C.getSiloWithdrawSeasons()];
        }
        delete s.siloBalances[token];
    }

    function resetState() public {
        for (uint32 i = 0; i < s.g.bipIndex; i++) {
            delete s.g.bips[i];
            delete s.g.diamondCuts[i];
        }

        for (uint32 i = 0; i < s.fundraiserIndex; i++) {
            MockToken(s.fundraisers[i].token).burn(MockToken(s.fundraisers[i].token).balanceOf(address(this)));
            delete s.fundraisers[i];
        }
        delete s.f;
        delete s.bean;
        delete s.lp;
        delete s.si;
        delete s.s;
        delete s.w;
        s.w.lastSowTime = type(uint32).max;
        s.w.nextSowTime = type(uint32).max;
        delete s.g;
        delete s.r;
        delete s.o;
        delete s.co;
        delete s.v1SI;
        delete s.season;
        delete s.unclaimedRoots;
        delete s.fundraiserIndex;
        s.season.start = block.timestamp;
        s.season.timestamp = uint32(block.timestamp % 2 ** 32);
        delete s.sop;
        s.s.stalk = 0;
        s.s.seeds = 0;
        s.season.withdrawSeasons = 25;
        s.season.current = 1;
        s.paused = false;
        bean().burn(bean().balanceOf(address(this)));
    }

    function stepWeatherE(int256 deltaB, uint256 endSoil) external {
        stepWeather(deltaB, endSoil);
    }

    function stepWeatherWithParams(
        uint256 pods,
        uint256 lastDSoil,
        uint256 startSoil,
        uint256 endSoil,
        int256 deltaB,
        bool raining,
        bool rainRoots
    ) public {
        s.r.raining = raining;
        s.r.roots = rainRoots ? 1 : 0;
        s.f.pods = pods;
        s.w.lastDSoil = lastDSoil;
        s.w.startSoil = startSoil;
        stepWeather(deltaB, endSoil);
    }

}
