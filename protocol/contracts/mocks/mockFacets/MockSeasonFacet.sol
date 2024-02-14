/*
 SPDX-License-Identifier: MIT*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "contracts/beanstalk/sun/SeasonFacet/SeasonFacet.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../MockToken.sol";
import "contracts/libraries/LibBytes.sol";
import {LibEthUsdOracle, LibUniswapOracle, LibChainlinkOracle} from "contracts/libraries/Oracle/LibEthUsdOracle.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibAppStorage, Storage} from "contracts/libraries/LibAppStorage.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Mock Season Facet
 *
 */

struct MockCurveMetapoolOracle {
    bool initialized; // ────┐ 1
    uint32 startSeason; // ──┘ 4 (5/32)
    uint256[2] balances;
    uint256 deprecated_timestamp;
}

interface ResetPool {
    function reset_cumulative() external;
}

interface IMockPump {
    function update(uint256[] memory _reserves, bytes memory) external;
    function readInstantaneousReserves(address well, bytes memory data) external view returns (uint[] memory reserves);
}

contract MockSeasonFacet is SeasonFacet  {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using SignedSafeMath for int256;


    event UpdateTWAPs(uint256[2] balances);
    event DeltaB(int256 deltaB);
    event GaugePointChange(uint256 indexed season, address indexed token, uint256 gaugePoints);
    event Incentivization(address indexed account, uint256 beans);
    event UpdateAverageStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);
    event UpdateGaugeSettings(
        address indexed token,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint64 optimalPercentDepositedBdv
    );

    function reentrancyGuardTest() public nonReentrant {
        reentrancyGuardTest();
    }

    function setYieldE(uint256 t) public {
        s.w.t = uint32(t);
    }

    function siloSunrise(uint256 amount) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.timestamp = block.timestamp;
        s.season.sunriseBlock = uint32(block.number);
        mockStepSilo(amount);
        LibGerminate.endTotalGermination(s.season.current, LibWhitelistedTokens.getWhitelistedTokens());
    }

    function mockStepSilo(uint256 amount) public {
        C.bean().mint(address(this), amount);
        rewardToSilo(amount);
    }

    function rainSunrise() public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        // update last snapshot in beanstalk. 
        stepOracle();
        mockStartSop();
    }

    function rainSunrises(uint256 amount) public {
        require(!s.paused, "Season: Paused.");
        for (uint256 i; i < amount; ++i) {
            s.season.current += 1;
            stepOracle();
            mockStartSop();
        }
        s.season.sunriseBlock = uint32(block.number);
    }

    function droughtSunrise() public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        // update last snapshot in beanstalk. 
        stepOracle();
        handleRain(2, C.BEAN_ETH_WELL);
    }

    function rainSiloSunrise(uint256 amount) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        // update last snapshot in beanstalk. 
        stepOracle();
        mockStartSop();
        mockStepSilo(amount);
    }

    function droughtSiloSunrise(uint256 amount) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        // update last snapshot in beanstalk. 
        stepOracle();
        mockStartSop();
        mockStepSilo(amount);
    }

    function sunSunrise(int256 deltaB, uint256 caseId) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        stepSun(deltaB, caseId);
    }

    function seedGaugeSunSunrise(int256 deltaB, uint256 caseId) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
        updateTemperatureAndBeanToMaxLpGpPerBdvRatio(caseId);
        stepSun(deltaB, caseId);
    }

    function sunTemperatureSunrise(int256 deltaB, uint256 caseId, uint32 t) public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.w.t = t;
        s.season.sunriseBlock = uint32(block.number);
        stepSun(deltaB, caseId);
    }

    function lightSunrise() public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.sunriseBlock = uint32(block.number);
    }

    function fastForward(uint32 _s) public {
        // teleport current sunrise 2 seasons ahead,
        // end germination, 
        // then teleport remainder of seasons.
        if(_s >= 2) {
            s.season.current += 2;
            LibGerminate.endTotalGermination(s.season.current, LibWhitelistedTokens.getWhitelistedTokens());
            s.season.current += _s - 2;
            
        } else {
            s.season.current += _s;
        }
    }

    function teleportSunrise(uint32 _s) public {
        s.season.current = _s;
        s.season.sunriseBlock = uint32(block.number);
    }

    function farmSunrise() public {
        require(!s.paused, "Season: Paused.");
        s.season.current += 1;
        s.season.timestamp = block.timestamp;
        s.season.sunriseBlock = uint32(block.number);
        LibGerminate.endTotalGermination(s.season.current, LibWhitelistedTokens.getWhitelistedTokens());
    }

    function farmSunrises(uint256 number) public {
        require(!s.paused, "Season: Paused.");
        for (uint256 i; i < number; ++i) {
            s.season.current += 1;
            s.season.timestamp = block.timestamp;
            // ending germination only needs to occur for the first two loops.
            if(i < 2) { 
                LibGerminate.endTotalGermination(s.season.current, LibWhitelistedTokens.getWhitelistedTokens());
            }
        }
        s.season.sunriseBlock = uint32(block.number);
    }

    function setMaxTempE(uint32 number) public {
        s.w.t = number;
    }

    function setAbovePegE(bool peg) public {
        s.season.abovePeg = peg;
    }

    function setLastDSoilE(uint128 number) public {
        s.w.lastDSoil = number;
    }

    function setNextSowTimeE(uint32 _time) public {
        s.w.thisSowTime = _time;
    }

    function setLastSowTimeE(uint32 number) public {
        s.w.lastSowTime = number;
    }

    function setSoilE(uint256 amount) public {
        setSoil(amount);
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
        s.w.thisSowTime = type(uint32).max;
        delete s.g;
        delete s.r;
        delete s.co;
        delete s.season;
        delete s.fundraiserIndex;
        s.season.start = block.timestamp;
        s.season.timestamp = block.timestamp;
        s.s.stalk = 0;
        s.season.withdrawSeasons = 25;
        s.season.current = 1;
        s.paused = false;
        C.bean().burn(C.bean().balanceOf(address(this)));
    }

    function calcCaseIdE(int256 deltaB, uint128 endSoil) external {
        s.f.soil = endSoil;
        s.f.beanSown = endSoil;
        calcCaseIdandUpdate(deltaB);
    }

    function setCurrentSeasonE(uint32 _season) public {
        s.season.current = _season;
    }

    function calcCaseIdWithParams(
        uint256 pods,
        uint256 _lastDSoil,
        uint128 beanSown,
        uint128 endSoil,
        int256 deltaB,
        bool raining,
        bool rainRoots,
        bool aboveQ,
        uint256 L2SRState
    ) public {
        s.season.raining = raining;
        s.r.roots = rainRoots ? 1 : 0;
        s.f.pods = pods;
        s.w.lastDSoil = uint128(_lastDSoil);
        s.f.beanSown = beanSown;
        s.f.soil = endSoil;
        // L2SR
        // 3 = exs high, 1 = rea high, 2 = rea low, 3 = exs low
        uint256[] memory reserves = new uint256[](2);
        uint256 totalSupply = C.bean().totalSupply();
        if (L2SRState == 3) {
            // reserves[1] = 0.8e18;
            reserves[1] = uint256(800);
        } else if (L2SRState == 2) {
            // reserves[1] = 0.8e18 - 1;
            reserves[1] = uint256(799);
        } else if (L2SRState == 1) {
            // reserves[1] = 0.4e18 - 1;
            reserves[1] = uint256(399);
        } else if (L2SRState == 0) {
            // reserves[1] = 0.12e18 - 1;    
            reserves[1] = uint256(119);
        }
        reserves[0] = reserves[1].mul(totalSupply).div(1000);
        reserves[1] = reserves[1]
            .mul(totalSupply)
            .mul(LibEvaluate.LIQUIDITY_PRECISION)
            .div(1000) // eth price
            .div(1000); // reserve[1] / 1000 = %
        IMockPump(C.BEANSTALK_PUMP).update(reserves, new bytes(0));
        s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0]);
        s.twaReserves[C.BEAN_ETH_WELL].reserve1 = uint128(reserves[1]);
        if(aboveQ) {
            // increase bean price
            s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0].mul(2));
            s.usdTokenPrice[C.BEAN_ETH_WELL] = 0.001e18;
        } else {
            // decrease bean price
            s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0]);
            s.usdTokenPrice[C.BEAN_ETH_WELL] = 0.001e18;
        }
        calcCaseIdandUpdate(deltaB);
    }

    function resetSeasonStart(uint256 amount) public {
        s.season.start = block.timestamp.sub(amount + 3600 * 2);
    }

    function captureE() external returns (int256 deltaB) {
        stepOracle();
        emit DeltaB(deltaB);
    }

    function captureCurveE() external returns (int256 deltaB) {
        deltaB = LibCurveMinting.capture();
        s.season.timestamp = block.timestamp;
        emit DeltaB(deltaB);
    }

    function captureWellE(address well) external returns (int256 deltaB) {
        deltaB = LibWellMinting.capture(well);
        s.season.timestamp = block.timestamp;
        emit DeltaB(deltaB);
    }

    function updateTWAPCurveE() external returns (uint256[2] memory balances) {
        (balances, s.co.balances) = LibCurveMinting.twaBalances();
        s.season.timestamp = block.timestamp;
        emit UpdateTWAPs(balances);
    }

    function resetPools(address[] calldata pools) external {
        for (uint256 i; i < pools.length; ++i) {
            ResetPool(pools[i]).reset_cumulative();
        }
    }

    function rewardToFertilizerE(uint256 amount) external {
        rewardToFertilizer(amount * 3);
        C.bean().mint(address(this), amount);
    }

    function setSunriseBlock(uint256 _block) external {
        s.season.sunriseBlock = uint32(_block);
    }

    //fake the grown stalk per bdv deployment, does same as InitBipNewSilo
    function deployStemsUpgrade() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        ds.supportedInterfaces[type(IERC1155).interfaceId] = true;
        ds.supportedInterfaces[0x0e89341c] = true;


        uint24 currentSeason = uint24(s.season.current);

        // Clear the storage variable
        delete s.s.deprecated_seeds;

        s.ss[C.BEAN].stalkEarnedPerSeason = 2*1e6;
        s.ss[C.BEAN].stalkIssuedPerBdv = 10000;
        s.ss[C.BEAN].milestoneSeason = currentSeason;
        s.ss[C.BEAN].milestoneStem = 0;


        s.ss[C.CURVE_BEAN_METAPOOL].stalkEarnedPerSeason = 4*1e6;
        s.ss[C.CURVE_BEAN_METAPOOL].stalkIssuedPerBdv = 10000;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneSeason = currentSeason;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneStem = 0;


        s.ss[C.UNRIPE_BEAN].stalkEarnedPerSeason = 2*1e6;
        s.ss[C.UNRIPE_BEAN].stalkIssuedPerBdv = 10000;
        s.ss[C.UNRIPE_BEAN].milestoneSeason = currentSeason;
        s.ss[C.UNRIPE_BEAN].milestoneStem = 0;


        s.ss[address(C.unripeLP())].stalkEarnedPerSeason = 2*1e6;
        s.ss[address(C.unripeLP())].stalkIssuedPerBdv = 10000;
        s.ss[address(C.unripeLP())].milestoneSeason = currentSeason;
        s.ss[address(C.unripeLP())].milestoneStem = 0;
        
        s.season.stemStartSeason = uint16(s.season.current);
    }

    //constants for old seeds values

    function lastDSoil() external view returns (uint256) {
        return uint256(s.w.lastDSoil);
    }

    function lastSowTime() external view returns (uint256) {
        return uint256(s.w.lastSowTime);
    }

    function thisSowTime() external view returns (uint256) {
        return uint256(s.w.thisSowTime);
    }

    function getT() external view returns (uint256) {
        return uint256(s.w.t);
    }

    function getUsdPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token);
    }

    function getEthUsdPrice() external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice();
    }

    function getEthUsdcPrice() external view returns (uint256) {
        return LibUniswapOracle.getEthUsdcPrice(900);
    }

    function getEthUsdtPrice() external view returns (uint256) {
        return LibUniswapOracle.getEthUsdtPrice(900);
    }

    function getChainlinkEthUsdPrice() external view returns (uint256) {
        return LibChainlinkOracle.getEthUsdPrice();
    }

    function getChainlinkTwapEthUsdPrice(uint256 lookback) external view returns (uint256) {
        return LibChainlinkOracle.getEthUsdTwap(lookback);
    }

    function setBeanToMaxLpGpPerBdvRatio(uint128 percent) external {
        s.seedGauge.beanToMaxLpGpPerBdvRatio = percent;
    }
    
    function setUsdEthPrice(uint256 price) external {
        s.usdTokenPrice[C.BEAN_ETH_WELL] = price;
    }

    function mockStepGauge() external {
        (
            uint256 maxLpGpPerBdv,
            LibGauge.LpGaugePointData[] memory lpGpData,
            uint256 totalGaugePoints,
            uint256 totalLpBdv
        ) = LibGauge.updateGaugePoints();
        if (totalLpBdv == type(uint256).max) return;
        LibGauge.updateGrownStalkEarnedPerSeason(maxLpGpPerBdv, lpGpData, totalGaugePoints, totalLpBdv);
    }

    function stepGauge() external {
       LibGauge.stepGauge();
    }
    
    function mockSetAverageGrownStalkPerBdvPerSeason(
        uint128 _averageGrownStalkPerBdvPerSeason
    ) external {
        s.seedGauge.averageGrownStalkPerBdvPerSeason = _averageGrownStalkPerBdvPerSeason;
    }

    function mockInitalizeGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint96 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external {
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
        ss.gpSelector = gaugePointSelector;
        ss.gaugePoints = gaugePoints;
        ss.optimalPercentDepositedBdv = optimalPercentDepositedBdv;
        emit UpdateGaugeSettings(token, gaugePointSelector, liquidityWeightSelector, optimalPercentDepositedBdv);
    }

    function mockSetBean3CrvOracle(
        uint256[2] memory reserves
    ) external {
        s.co.balances = reserves;
    }

    function mockEndTotalGerminationForToken(
        address token
    ) external {
        // increment total deposited and amounts for each token.
        Storage.TotalGerminating storage totalGerm;
        if (LibGerminate.getSeasonGerminationState() == LibGerminate.Germinate.ODD) {
            totalGerm = s.oddGerminating;
        } else {
            totalGerm = s.evenGerminating;
        }
        LibTokenSilo.incrementTotalDeposited(
            token,
            totalGerm.deposited[token].amount,
            totalGerm.deposited[token].bdv
        );
        delete totalGerm.deposited[token];
    }

    function mockUpdateAverageStalkPerBdvPerSeason() external {
        LibGauge.updateAverageStalkPerBdvPerSeason();
    }

    function mockStartSop() internal {
        handleRain(3, C.BEAN_ETH_WELL);
    }

    function mockSetSopWell(address well) external {
        s.sopWell = well;
    }

    function mockIncrementGermination(
        address token,
        uint128 amount,
        uint128 bdv,
        LibGerminate.Germinate germ
    ) external {
        LibTokenSilo.incrementTotalGerminating(
            token,
            amount,
            bdv,
            germ
        );
    }
}
