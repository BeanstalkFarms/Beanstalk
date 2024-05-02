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
import {LibChainlinkOracle} from "contracts/libraries/Oracle/LibChainlinkOracle.sol";
import {LibEthUsdOracle} from "contracts/libraries/Oracle/LibEthUsdOracle.sol";
import {LibWstethEthOracle} from "contracts/libraries/Oracle/LibWstethEthOracle.sol";
import {LibWstethUsdOracle} from "contracts/libraries/Oracle/LibWstethUsdOracle.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibAppStorage, Storage} from "contracts/libraries/LibAppStorage.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibEvaluate} from "contracts/libraries/LibEvaluate.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";

import "forge-std/console.sol";
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

    function update(address well, uint256[] memory _reserves, bytes memory) external;

    function readInstantaneousReserves(
        address well,
        bytes memory data
    ) external view returns (uint[] memory reserves);
}

contract MockSeasonFacet is SeasonFacet {
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
        LibGerminate.endTotalGermination(
            s.season.current,
            LibWhitelistedTokens.getWhitelistedTokens()
        );
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
        handleRain(2);
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

    /**
     * @dev Mocks the stepSeason function.
     */
    function mockStepSeason() public returns (uint32 season) {
        s.season.current += 1;
        season = s.season.current;
        s.season.sunriseBlock = uint32(block.number); // Note: Will overflow in the year 3650.
        emit Sunrise(season);
    }

    function fastForward(uint32 _s) public {
        // teleport current sunrise 2 seasons ahead,
        // end germination,
        // then teleport remainder of seasons.
        if (_s >= 2) {
            s.season.current += 2;
            LibGerminate.endTotalGermination(
                s.season.current,
                LibWhitelistedTokens.getWhitelistedTokens()
            );
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
        LibGerminate.endTotalGermination(
            s.season.current,
            LibWhitelistedTokens.getWhitelistedTokens()
        );
    }

    function farmSunrises(uint256 number) public {
        require(!s.paused, "Season: Paused.");
        for (uint256 i; i < number; ++i) {
            s.season.current += 1;
            s.season.timestamp = block.timestamp;
            // ending germination only needs to occur for the first two loops.
            if (i < 2) {
                LibGerminate.endTotalGermination(
                    s.season.current,
                    LibWhitelistedTokens.getWhitelistedTokens()
                );
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

        delete s.f;
        delete s.s;
        delete s.w;
        s.w.lastSowTime = type(uint32).max;
        s.w.thisSowTime = type(uint32).max;
        delete s.g;
        delete s.r;
        delete s.co;
        delete s.season;
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
        // L2SR
        // 3 = exs high, 1 = rea high, 2 = rea low, 3 = exs low
        uint256[] memory reserves = new uint256[](2);
        if (L2SRState == 3) {
            // reserves[1] = 0.8e1
            reserves[1] = uint256(801e18);
        } else if (L2SRState == 2) {
            // reserves[1] = 0.8e18 - 1;
            reserves[1] = uint256(799e18);
        } else if (L2SRState == 1) {
            // reserves[1] = 0.4e18 - 1;
            reserves[1] = uint256(399e18);
        } else if (L2SRState == 0) {
            // reserves[1] = 0.12e18 - 1;
            reserves[1] = uint256(119e18);
        }
        uint256 beanEthPrice = 1000e6;
        uint256 l2srBeans = beanEthPrice.mul(1000);
        reserves[0] = reserves[1].mul(beanEthPrice).div(1e18);
        if (l2srBeans > C.bean().totalSupply()) {
            C.bean().mint(address(this), l2srBeans - C.bean().totalSupply());
        }
        Call[] memory pump = IWell(C.BEAN_ETH_WELL).pumps();
        IMockPump(pump[0].target).update(pump[0].target, reserves, pump[0].data);
        s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0]);
        s.twaReserves[C.BEAN_ETH_WELL].reserve1 = uint128(reserves[1]);
        s.usdTokenPrice[C.BEAN_ETH_WELL] = 0.001e18;
        if (aboveQ) {
            // increase bean price
            s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0].mul(10).div(11));
        } else {
            // decrease bean price
            s.twaReserves[C.BEAN_ETH_WELL].reserve0 = uint128(reserves[0]);
        }

        /// FIELD ///
        s.season.raining = raining;
        s.r.roots = rainRoots ? 1 : 0;
        s.f.pods = (pods.mul(C.bean().totalSupply()) / 1000); // previous tests used 1000 as the total supply.
        s.w.lastDSoil = uint128(_lastDSoil);
        s.f.beanSown = beanSown;
        s.f.soil = endSoil;
        calcCaseIdandUpdate(deltaB);
    }

    function resetSeasonStart(uint256 amount) public {
        s.season.start = block.timestamp.sub(amount + 3600 * 2);
    }

    function captureE() external returns (int256 deltaB) {
        deltaB = stepOracle();
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

        s.ss[C.BEAN].stalkEarnedPerSeason = 2 * 1e6;
        s.ss[C.BEAN].stalkIssuedPerBdv = 10000;
        s.ss[C.BEAN].milestoneSeason = currentSeason;
        s.ss[C.BEAN].milestoneStem = 0;

        s.ss[C.CURVE_BEAN_METAPOOL].stalkEarnedPerSeason = 4 * 1e6;
        s.ss[C.CURVE_BEAN_METAPOOL].stalkIssuedPerBdv = 10000;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneSeason = currentSeason;
        s.ss[C.CURVE_BEAN_METAPOOL].milestoneStem = 0;

        s.ss[C.UNRIPE_BEAN].stalkEarnedPerSeason = 2 * 1e6;
        s.ss[C.UNRIPE_BEAN].stalkIssuedPerBdv = 10000;
        s.ss[C.UNRIPE_BEAN].milestoneSeason = currentSeason;
        s.ss[C.UNRIPE_BEAN].milestoneStem = 0;

        s.ss[address(C.unripeLP())].stalkEarnedPerSeason = 2 * 1e6;
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

    function getEthUsdTwap(uint256 lookback) external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice(lookback);
    }

    function getChainlinkEthUsdPrice() external view returns (uint256) {
        return
            LibChainlinkOracle.getPrice(
                C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT
            );
    }

    function getChainlinkTwapEthUsdPrice(uint256 lookback) external view returns (uint256) {
        return
            LibChainlinkOracle.getTwap(
                C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                lookback
            );
    }

    function getWstethUsdPrice() external view returns (uint256) {
        return LibWstethUsdOracle.getWstethUsdPrice(0);
    }

    function getWstethUsdTwap(uint256 lookback) external view returns (uint256) {
        return LibWstethUsdOracle.getWstethUsdPrice(lookback);
    }

    function getWstethEthPrice() external view returns (uint256) {
        return LibWstethEthOracle.getWstethEthPrice(0);
    }

    function getWstethEthTwap(uint256 lookback) external view returns (uint256) {
        return LibWstethEthOracle.getWstethEthPrice(lookback);
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
        LibGauge.updateGrownStalkEarnedPerSeason(
            maxLpGpPerBdv,
            lpGpData,
            totalGaugePoints,
            totalLpBdv
        );
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
        emit UpdateGaugeSettings(
            token,
            gaugePointSelector,
            liquidityWeightSelector,
            optimalPercentDepositedBdv
        );
    }

    function mockSetBean3CrvOracle(uint256[2] memory reserves) external {
        s.co.balances = reserves;
    }

    function mockEndTotalGerminationForToken(address token) external {
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
        handleRain(3);
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
        LibTokenSilo.incrementTotalGerminating(token, amount, bdv, germ);
    }

    /**
     * @notice simulates beanstalk state based on the parameters.
     * @param price below, above, significant above peg.
     * @param podRate extremely low, low, high, extremely high.
     * @param changeInSoilDemand decreasing, steady, increasing.
     * @param liquidityToSupplyRatio extremely low, low, high, extremely high.
     * @dev
     * assumes the inital L2SR is >80%.
     * assumes only one well with beans.
     */
    function setBeanstalkState(
        uint256 price,
        uint256 podRate,
        uint256 changeInSoilDemand,
        uint256 liquidityToSupplyRatio,
        address targetWell
    ) external returns (int256 deltaB) {
        ////////// PRICE //////////
        deltaB = setPrice(price, targetWell);

        ////////// L2SR //////////
        setL2SR(liquidityToSupplyRatio, targetWell);

        // POD RATE
        setPodRate(podRate);

        ////// DELTA POD DEMAND //////
        setChangeInSoilDemand(changeInSoilDemand);
    }

    /**
     * @notice sets the price state of beanstalk.
     * @dev 0 = below peg, 1 = above peg, 2 = significantly above peg.
     */
    function setPrice(uint256 price, address targetWell) public returns (int256 deltaB) {
        // initalize beanTknPrice, and reserves.
        uint256 ethPrice = 1000e6;
        s.usdTokenPrice[targetWell] = 1e24 / ethPrice;
        uint256[] memory reserves = IWell(targetWell).getReserves();
        s.twaReserves[targetWell].reserve0 = uint128(reserves[0]);
        s.twaReserves[targetWell].reserve1 = uint128(reserves[1]);
        if (price == 0) {
            // below peg
            deltaB = -1;
            s.season.abovePeg = false;
        } else {
            // above peg
            deltaB = 1;
            s.season.abovePeg = true;
            if (price == 2) {
                // excessively above peg

                // to get Q, decrease s.reserve0 of the well to be >1.05.
                s.twaReserves[targetWell].reserve0 = uint128(reserves[0].mul(90).div(100));
            }
        }
    }

    /**
     * @notice sets the pod rate state of beanstalk.
     * @dev 0 = Extremely low, 1 = Reasonably Low, 2 = Reasonably High, 3 = Extremely High.
     */
    function setPodRate(uint256 podRate) public {
        uint256 beanSupply = C.bean().totalSupply();
        if (podRate == 0) {
            // < 5%
            s.f.pods = beanSupply.mul(49).div(1000);
        } else if (podRate == 1) {
            // < 15%
            s.f.pods = beanSupply.mul(149).div(1000);
        } else if (podRate == 2) {
            // < 25%
            s.f.pods = beanSupply.mul(249).div(1000);
        } else {
            // > 25%
            s.f.pods = beanSupply.mul(251).div(1000);
        }
    }

    /**
     * @notice sets the change in soil demand state of beanstalk.
     * @dev 0 = decreasing, 1 = steady, 2 = increasing.
     */
    function setChangeInSoilDemand(uint256 changeInSoilDemand) public {
        if (changeInSoilDemand == 0) {
            // decreasing demand
            s.w.lastSowTime = 600; // last season, everything was sown in 10 minutes.
            s.w.thisSowTime = 1200; // this season, everything was sown in 20 minutes.
        } else if (changeInSoilDemand == 1) {
            // steady demand
            s.w.lastSowTime = 600; // last season, everything was sown in 10 minutes.
            s.w.thisSowTime = 600; // this season, everything was sown in 10 minutes.
        } else {
            // increasing demand
            s.w.lastSowTime = type(uint32).max; // last season, no one sow'd
            s.w.thisSowTime = type(uint32).max - 1; // this season, someone sow'd
        }
    }

    /**
     * @notice sets the L2SR state of beanstalk.
     * @dev 0 = extremely low, 1 = low, 2 = high, 3 = extremely high.
     */
    function setL2SR(uint256 liquidityToSupplyRatio, address targetWell) public {
        uint256 beansInWell = C.bean().balanceOf(targetWell);
        uint256 beanSupply = C.bean().totalSupply();
        uint currentL2SR = beansInWell.mul(1e18).div(beanSupply);

        // issue beans to sender based on ratio and supply of well.
        uint256 ratio = 1e18;
        if (liquidityToSupplyRatio == 0) {
            // < 12%
            ratio = 0.119e18;
        } else if (liquidityToSupplyRatio == 1) {
            // < 40%
            ratio = 0.399e18;
        } else if (liquidityToSupplyRatio == 2) {
            // < 80%
            ratio = 0.799e18;
        } else {
            ratio = 0.801e18;
        }

        // mint new beans outside of the well for the L2SR to change.
        uint256 newSupply = beansInWell.mul(currentL2SR).div(ratio).sub(beansInWell);
        beanSupply += newSupply;

        C.bean().mint(msg.sender, newSupply);
    }

    function mockCalcCaseIdandUpdate(int256 deltaB) external returns (uint256 caseId) {
        return calcCaseIdandUpdate(deltaB);
    }

    function getSeasonStart() external view returns (uint256) {
        return s.season.start;
    }

    /**
     * @notice returns the timestamp in which the next sunrise can be called.
     */
    function getNextSeasonStart() external view returns (uint256) {
        uint256 currentSeason = s.season.current;
        return s.season.start + ((currentSeason + 1) * 3600);
    }

    /**
     * @notice intializes the oracle for all whitelisted well lp tokens.
     * @dev should only be used if the oracle has not been initialized.
     */
    function initOracleForAllWhitelistedWells() external {
        address[] memory lp = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint i = 0; i < lp.length; i++) {
            initOracleForWell(lp[i]);
        }
    }

    function initOracleForWell(address well) internal {
        require(s.wellOracleSnapshots[well].length == 0, "Season: Oracle already initialized.");
        LibWellMinting.initializeOracle(well);
    }

    function getPoolDeltaBWithoutCap(address well) external view returns (int256 deltaB) {
        bytes memory lastSnapshot = LibAppStorage.diamondStorage().wellOracleSnapshots[well];
        // If the length of the stored Snapshot for a given Well is 0,
        // then the Oracle is not initialized.
        if (lastSnapshot.length > 0) {
            (deltaB, , , ) = LibWellMinting.twaDeltaB(well, lastSnapshot);
        }
    }
}
