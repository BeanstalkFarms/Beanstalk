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
    using SafeMath for uint32;

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
        stepGovernance();
        s.season.current += 1;
        handleRain(4);
        mockStepSilo(amount);
    }

    function droughtSiloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        stepGovernance();
        s.season.current += 1;
        handleRain(3);
        mockStepSilo(amount);
    }

    function sunSunrise(uint256 beanPrice, uint256 usdcPrice, uint256 divisor) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        uint256 siloReward = stepSun(
            Decimal.ratio(beanPrice, divisor),
            Decimal.ratio(usdcPrice, divisor)
        );
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

    function governanceSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        stepGovernance();
        siloSunrise(amount);
    }

    function governanceSunrises(uint256 number) public {
        require(!paused(), "Season: Paused.");
        for (uint256 i = 0; i < number; i++) {
            governanceSunrise(0);
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

    function setYieldE(uint32 number) public {
        s.w.yield = number;
    }

    function setStartSoilE(uint256 number) public {
        s.w.startSoil = number;
    }

    function setLastDSoilE(uint256 number) public {
        s.w.lastDSoil = number;
    }

    function setDidSowFasterE(bool faster) public {
        s.w.didSowFaster = faster;
    }

    function setDidSowBelowMinE(bool below) public {
        s.w.didSowBelowMin = below;
    }

    function setLastSowTimeE(uint32 number) public {
        s.w.lastSowTime = number;
    }

    function setLastSoilPercentE(uint96 number) public {
        s.w.lastSoilPercent = number;
    }

    function incrementTotalSoilE(uint256 amount) public {
        incrementTotalSoil(amount);
    }

    function decrementTotalSoilE(uint256 amount) public {
        decrementTotalSoil(amount);
    }

    function increaseSoilE(uint256 amount) public {
        increaseSoil(amount);
    }

    function decreaseSoilE(uint256 amount, uint256 harvested) public {
        decreaseSoil(amount, harvested);
    }

    function ensureSoilBoundsE() public {
        ensureSoilBounds();
    }

    function minSoil(uint256 amount) public view returns (uint256) {
        return getMinSoil(amount);
    }

    function maxSoil() public view returns (uint256) {
        return getMaxSoil();
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
    }

    function resetState() public {
        uint32 _s = season();
        for (uint32 j = 0; j <= _s; j++) delete s.sops[j];
        resetStateNoSeason();
    }

    function resetStateNoSeason() public {
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
        delete s.g;
        delete s.r;
        delete s.v1SI;
        delete s.season;
        delete s.unclaimedRoots;
        delete s.fundraiserIndex;
        s.season.start = block.timestamp;
        s.season.timestamp = uint32(block.timestamp % 2 ** 32);
        delete s.sop;
        s.s.stalk = 0;
        s.s.seeds = 0 ;
        s.season.current = 1;
        s.paused = false;
        bean().burn(bean().balanceOf(address(this)));
        IBean(s.c.weth).burn(IBean(s.c.weth).balanceOf(address(this)));
    }

    function stepWeatherWithParams(
        uint256 pods,
        uint256 lastDSoil,
        uint256 startSoil,
        uint256 endSoil,
        uint256 intPrice,
        bool raining,
        bool rainRoots
    ) public {
        s.r.raining = raining;
        s.r.roots = rainRoots ? 1 : 0;
        s.f.pods = pods;
        s.w.lastDSoil = lastDSoil;
        s.w.startSoil = startSoil;
        stepWeather(intPrice.mul(1e16), endSoil);
    }

}
