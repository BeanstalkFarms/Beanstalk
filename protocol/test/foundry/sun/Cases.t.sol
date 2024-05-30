// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IWell, IERC20, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {C} from "contracts/C.sol";

contract CasesTest is TestHelper {
    // Events.
    event TemperatureChange(uint256 indexed season, uint256 caseId, int8 absChange);
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);

    // Interfaces.
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    address well = C.BEAN_ETH_WELL;
    uint256 constant EX_LOW = 0;
    uint256 constant RES_LOW = 1;
    uint256 constant RES_HIGH = 2;
    uint256 constant EX_HIGH = 3;
    uint256 constant BELOW_PEG = 0;
    uint256 constant ABOVE_PEG = 1;
    uint256 constant EX_ABOVE_PEG = 2;
    int256 constant MAX_DECREASE = -50e18;
    uint256 constant DEC = 0;
    uint256 constant STDY = 1;
    uint256 constant INC = 2;

    // Beanstalk State parameters.
    // These are the variables that beanstalk measures upon sunrise.
    // (placed in storage due to stack too deep).
    uint256 price; // 0 = below peg, 1 = above peg, 2 = Q
    uint256 podRate; // 0 = Extremely low, 1 = Reasonbly Low, 2 = Reasonably High, 3 = Extremely High
    uint256 changeInSoilDemand; // 0 = Decreasing, 1 = steady, 2 = Inc
    uint256 l2SR; // 0 = Extremely low, 1 = Reasonably Low, 2 = Reasonably High, 3 = Extremely High
    int256 deltaB;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(well, 10000e6, 10 ether);

        // call well to wsteth/bean to initalize the well.
        // avoids errors due to gas limits.
        addLiquidityToWell(C.BEAN_WSTETH_WELL, 10e6, .01 ether);
    }

    /**
     * @notice tests every case of weather that can happen in beanstalk, 0 - 143.
     * @dev See {LibCases.sol} for more infomation.
     * This test verifies general invarients regarding the cases,
     * (i.e how beanstalk should generally react to its state)
     * and does not test the correctness of the magnitude of change.
     * Assumes BeanToMaxGpPerBdvRatio is < 0.
     */
    function testCases(uint256 caseId) public {
        // bound caseId between 0 and 143. (144 total cases)
        caseId = bound(caseId, 0, 143);

        // set temperature to 100%, for better testing.
        bs.setMaxTemp(100);

        uint256 initialTemperature = bs.maxTemperature();
        uint256 initialBeanToMaxLpGpPerBdvRatio = bs.getBeanToMaxLpGpPerBdvRatio();

        price = caseId % 3;
        podRate = (caseId / 3) % 4;
        changeInSoilDemand = (caseId / 12) % 3;
        l2SR = (caseId / 36) % 4;

        // set beanstalk state based on parameters.
        deltaB = season.setBeanstalkState(price, podRate, changeInSoilDemand, l2SR, well);

        // evaluate and update state.
        vm.expectEmit(true, true, false, false);
        emit TemperatureChange(1, caseId, 0);
        vm.expectEmit(true, true, false, false);
        emit BeanToMaxLpGpPerBdvRatioChange(1, caseId, 0);

        uint256 caseId = season.mockCalcCaseIdandUpdate(deltaB);
        (, int8 bT, , int80 bL) = bs.getChangeFromCaseId(caseId);

        // CASE INVARIENTS
        // if deltaB > 0: temperature should never increase. bean2MaxLpGpRatio should never increase.
        // if deltaB < 0: temperature should never decrease. bean2MaxLpGpRatio usually does not decrease.
        int256 tempChange = int256(bs.maxTemperature()) - int256(initialTemperature);
        int256 ratioChange = int256(bs.getBeanToMaxLpGpPerBdvRatio()) -
            int256(initialBeanToMaxLpGpPerBdvRatio);
        if (deltaB > 0) {
            assertLe(tempChange, 0, "Temp inc @ +DeltaB");
            assertLe(ratioChange, 0, "Ratio inc @ +DeltaB");
        } else {
            assertGe(tempChange, 0, "Temp dec @ -DeltaB");
            // Bean2LP Ratio will increase if L2SR is high, or if L2SR is reasonably low and podRate is high.
            // except during the case of excessively high price.
            if (l2SR > RES_LOW || (l2SR == RES_LOW && podRate > RES_LOW)) {
                assertGe(ratioChange, 0, "Ratio dec @ -DeltaB");
            } else {
                // ratio should decrease by 50%.
                assertEq(bs.getBeanToMaxLpGpPerBdvRatio(), 0, "Ratio inc @ -DeltaB");
                assertEq(bL, MAX_DECREASE);
            }
        }

        // at excessively low L2SR or reasonably low L2SR and low debt,
        // BeanToMaxLpGpPerBdvRatio must decrease by 50%.
        if (l2SR < RES_LOW || (l2SR == RES_LOW && podRate < RES_HIGH)) {
            assertEq(bs.getBeanToMaxLpGpPerBdvRatio(), 0, "Ratio did not go to 0 @ low l2SR");
            assertEq(bL, MAX_DECREASE);
        }

        // if price is excessively high, bean2MaxLP ratio must decrease by 50%.
        if (price == EX_ABOVE_PEG) {
            assertEq(bL, MAX_DECREASE, "Temp inc @ Exc High price");
        }

        // if deltaB is positive, and ∆ soil demand is increasing,
        // temperature must decrease by 3%.
        // if deltaB is negative, and  ∆ soil demand is decreasing,
        // temperature must increase by 3%.
        if (deltaB > 0 && changeInSoilDemand == INC) {
            assertEq(bT, -3, "Temp did not decrease by 3% @ +DeltaB, Inc soil demand");
        }
        if (deltaB < 0 && changeInSoilDemand == DEC) {
            assertEq(bT, 3, "Temp did not inc by 3% @ -DeltaB, Dec soil demand");
        }

        // if L2SR is reasonably high or higher,
        // bean2MaxLpGpPerBdvRatio should increase by 1% below peg, and -1% above peg.
        if (l2SR >= RES_HIGH) {
            if (price == ABOVE_PEG) {
                assertEq(bL, -1e18, "Ratio did not dec by 1% @ Rea High L2SR");
            }
            if (price == BELOW_PEG) {
                if (l2SR == EX_HIGH && podRate > RES_LOW) {
                    assertEq(bL, 2e18, "Ratio did not inc by 2% @ Ext High L2SR & PodRate");
                } else {
                    assertEq(bL, 1e18, "Ratio did not inc by 1% @ Rea High L2SR");
                }
            }
        }
    }

    //////// SOWING //////

    /**
     * Series of sowing tests to verify demand logic.
     */

    /**
     * @notice if the time it took to sell out between this season was
     * more than 60 seconds faster than last season, demand is decreasing.
     */
    function testSowTimeSoldOutSlower(uint256 lastSowTime, uint256 thisSowTime) public {
        // set podrate to reasonably high,
        // as we want to verify temp changes as a function of soil demand.
        season.setPodRate(RES_HIGH);
        season.setPrice(ABOVE_PEG, well);

        // 10% temp for easier testing.
        bs.setMaxTempE(10);
        // the maximum value of lastSowTime is 3600
        // the minimum time it takes to sell out is 600 seconds.
        // (otherwise we assume increasing demand).
        lastSowTime = bound(lastSowTime, 601, 3599);
        thisSowTime = bound(thisSowTime, lastSowTime + 61, 3660);

        season.setLastSowTimeE(uint32(lastSowTime));
        season.setNextSowTimeE(uint32(thisSowTime));

        // calc caseId
        season.calcCaseIdE(1, 0);

        // beanstalk should record this season's sow time,
        // and set it as last sow time for next season.
        IMockFBeanstalk.Weather memory w = bs.weather();
        assertEq(uint256(w.lastSowTime), thisSowTime);
        assertEq(uint256(w.thisSowTime), type(uint32).max);
        uint256 steadyDemand;

        // verify ∆temp is 0% (see whitepaper).
        assertEq(10 - uint256(w.temp), 0);
    }

    /**
     * @notice if the time it took to sell out between this season and
     * the last season is within 60 seconds, demand is steady.
     */
    function testSowTimeSoldOutSowSameTime(uint256 lastSowTime, uint256 thisSowTime) public {
        // set podrate to reasonably high,
        // as we want to verify temp changes as a function of soil demand.
        season.setPodRate(RES_HIGH);
        season.setPrice(ABOVE_PEG, well);

        // 10% temp for easier testing.
        bs.setMaxTempE(10);
        // the maximum value of lastSowTime is 3600
        // the minimum time it takes to sell out is 600 seconds.
        // (otherwise we assume increasing demand).
        lastSowTime = bound(lastSowTime, 600, 3600);
        thisSowTime = bound(thisSowTime, lastSowTime, lastSowTime + 60);

        season.setLastSowTimeE(uint32(lastSowTime));
        season.setNextSowTimeE(uint32(thisSowTime));

        // calc caseId
        season.calcCaseIdE(1, 0);

        // beanstalk should record this season's sow time,
        // and set it as last sow time for next season.
        IMockFBeanstalk.Weather memory w = bs.weather();
        assertEq(uint256(w.lastSowTime), thisSowTime);
        assertEq(uint256(w.thisSowTime), type(uint32).max);
        uint256 steadyDemand;

        // verify ∆temp is 1% (see whitepaper).
        assertEq(10 - uint256(w.temp), 1);
    }

    /**
     * @notice if the time it took to sell out between this season was
     * more than 60 seconds faster than last season, demand is increasing.
     */
    function testSowTimeSoldOutFaster(uint256 lastSowTime, uint256 thisSowTime) public {
        // set podrate to reasonably high,
        // as we want to verify temp changes as a function of soil demand.
        season.setPodRate(RES_HIGH);
        season.setPrice(ABOVE_PEG, well);

        // 10% temp for easier testing.
        bs.setMaxTempE(10);
        // the maximum value of lastSowTime is 3600
        // the minimum time it takes to sell out is 600 seconds.
        // (otherwise we assume increasing demand).
        lastSowTime = bound(lastSowTime, 601, 3600);
        thisSowTime = bound(thisSowTime, 1, lastSowTime - 61);

        season.setLastSowTimeE(uint32(lastSowTime));
        season.setNextSowTimeE(uint32(thisSowTime));

        // calc caseId
        season.calcCaseIdE(1, 0);

        // beanstalk should record this season's sow time,
        // and set it as last sow time for next season.
        IMockFBeanstalk.Weather memory w = bs.weather();
        assertEq(uint256(w.lastSowTime), thisSowTime);
        assertEq(uint256(w.thisSowTime), type(uint32).max);
        uint256 steadyDemand;

        // verify ∆temp is 3% (see whitepaper).
        assertEq(10 - uint256(w.temp), 3);
    }
}
