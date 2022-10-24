/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "forge-std/console2.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SeasonFacet/SeasonFacet.sol";
import "../MockToken.sol";


/**
 * @author Publius
 * @title Mock Season Facet
**/

interface ResetPool {
    function reset_cumulative() external;
}

contract MockSeasonFacet is SeasonFacet {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;


    event UpdateTWAPs(uint256[2] balances);
    event DeltaB(int256 deltaB);

    function reentrancyGuardTest() public nonReentrant {
        reentrancyGuardTest();
    }

    function siloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        mockStepSilo(amount);
        console2.log("Sunrise called. Current season is:",s.season.current);
    }

    function mockStepSilo(uint256 amount) public {
        C.bean().mint(address(this), amount);
        rewardToSilo(amount);
    }

    function rainSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        handleRain(4);
    }

    function rainSunrises(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        for (uint256 i; i < amount; ++i) {
            s.season.current += 1;
            handleRain(4);
        }
        s.season.sunriseBlock = uint32(block.number);
    }

    function droughtSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        handleRain(3);
    }

    function rainSiloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        handleRain(4);
        mockStepSilo(amount);
    }

    function droughtSiloSunrise(uint256 amount) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        handleRain(3);
        mockStepSilo(amount);
    }

    function sunSunrise(int256 deltaB, uint256 caseId) public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        stepSun(deltaB, caseId); // Check
    }

    function lightSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        console2.log("LightSunrise called. Current season is:",s.season.current);
    }

    function fastForward(uint32 _s) public {
        s.season.current += _s;
        s.season.sunriseBlock = uint32(block.number);
    }

    function teleportSunrise(uint32 _s) public {
        s.season.current = _s;
        s.season.sunriseBlock = uint32(block.number);
    }

    function farmSunrise() public {
        require(!paused(), "Season: Paused.");
        s.season.current += 1;
        s.season.timestamp = block.timestamp;
        s.season.sunriseBlock = uint32(block.number);
        console2.log("farmSunrise called. Current season is:",s.season.current);
    }

    function farmSunrises(uint256 number) public {
        require(!paused(), "Season: Paused.");
        for (uint256 i; i < number; ++i) {
            s.season.current += 1;
            s.season.timestamp = block.timestamp;
        }
        s.season.sunriseBlock = uint32(block.number);
    }

    function setYieldE(uint32 number) public {
        s.w.yield = number;
    }

    function setAbovePegE(bool num) public {
        s.season.abovePeg = num;
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

    function setSoilE(uint256 amount) public {
        setSoil(amount);
    }

    function resetAccount(address account) public {
        uint32 _s = season();
        for (uint32 j; j <= _s; ++j) {
            if (s.a[account].field.plots[j] > 0) s.a[account].field.plots[j];
            if (s.a[account].bean.deposits[j] > 0) delete s.a[account].bean.deposits[j];
            if (s.a[account].lp.deposits[j] > 0) delete s.a[account].lp.deposits[j];
            if (s.a[account].lp.depositSeeds[j] > 0) delete s.a[account].lp.depositSeeds[j];
            if (s.a[account].bean.withdrawals[j+s.season.withdrawSeasons] > 0)
                delete s.a[account].bean.withdrawals[j+s.season.withdrawSeasons];
            if (s.a[account].lp.withdrawals[j+s.season.withdrawSeasons] > 0)
                delete s.a[account].lp.withdrawals[j+s.season.withdrawSeasons];
        }
        for (uint32 i; i < s.g.bipIndex; ++i) {
                s.g.voted[i][account] = false;
        }
        delete s.a[account];
        
        resetAccountToken(account, C.curveMetapoolAddress());
    }

    function resetAccountToken(address account, address token) public {
        uint32 _s = season();
        for (uint32 j; j <= _s; ++j) {
            if (s.a[account].deposits[token][j].amount > 0) delete s.a[account].deposits[token][j];
            if (s.a[account].withdrawals[token][j+s.season.withdrawSeasons] > 0)
                delete s.a[account].withdrawals[token][j+s.season.withdrawSeasons];
        }
        delete s.siloBalances[token];
    }

    function resetState() public {
        for (uint32 i; i < s.g.bipIndex; ++i) {
            delete s.g.bips[i];
            delete s.g.diamondCuts[i];
        }

        for (uint32 i; i < s.fundraiserIndex; ++i) {
            MockToken(s.fundraisers[i].token).burn(MockToken(s.fundraisers[i].token).balanceOf(address(this)));
            delete s.fundraisers[i];
        }
        delete s.f;
        delete s.s;
        delete s.w;
        s.w.lastSowTime = type(uint32).max;
        s.w.nextSowTime = type(uint32).max;
        delete s.g;
        delete s.r;
        delete s.co;
        delete s.season;
        delete s.fundraiserIndex;
        s.season.start = block.timestamp;
        s.season.timestamp = uint32(block.timestamp % 2 ** 32);
        s.s.stalk = 0;
        s.s.seeds = 0;
        s.season.withdrawSeasons = 25;
        s.season.current = 1;
        s.paused = false;
        C.bean().burn(C.bean().balanceOf(address(this)));
    }

    function stepWeatherE(int256 deltaB, uint128 endSoil) external {
        s.f.soil = endSoil;
        stepWeather(deltaB);
    }

    function stepWeatherWithParams(
        uint256 pods,
        uint256 lastDSoil,
        //uint256 startSoil,
        uint128 endSoil,
        int256 deltaB,
        bool raining,
        bool rainRoots
    ) public {
        s.season.raining = raining;
        s.r.roots = rainRoots ? 1 : 0;
        s.f.pods = pods;
        s.w.lastDSoil = lastDSoil;
        // s.w.startSoil = startSoil;
        s.f.soil = endSoil;
        stepWeather(deltaB);
    }

    function resetSeasonStart(uint256 amount) public {
        s.season.start = block.timestamp.sub(amount);
    }

    function captureE() external returns (int256 deltaB) {
        stepOracle();
        emit DeltaB(deltaB);
    }

    function captureCurveE() external returns (int256 deltaB) {
        (deltaB, ) = LibCurveOracle.capture();
        emit DeltaB(deltaB);
    }

    function updateTWAPCurveE() external returns (uint256[2] memory balances) {
        (balances,s.co.balances) = LibCurveOracle.twap();
        s.co.timestamp = block.timestamp;
        emit UpdateTWAPs(balances);
    }

    function curveOracle() external view returns (Storage.Oracle memory) {
        return s.co;
    }

    function resetPools(address[] calldata pools) external {
        for (uint i; i < pools.length; ++i) {
            ResetPool(pools[i]).reset_cumulative();
        }
    }

    function rewardToFertilizerE(uint256 amount) external {
        rewardToFertilizer(amount*3);
        C.bean().mint(address(this), amount);
    }
}
