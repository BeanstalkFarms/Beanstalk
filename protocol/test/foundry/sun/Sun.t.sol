// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {console} from "forge-std/console.sol";

/**
 * @notice Tests the functionality of the sun, the distrubution of beans and soil.
 */
contract SunTest is TestHelper {
    // Events
    event Soil(uint32 indexed season, uint256 soil);
    event Reward(uint32 indexed season, uint256 toField, uint256 toSilo, uint256 toFertilizer);

    // Interfaces
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    function setUp() public {
        initializeBeanstalkTestState(true, true);
    }

    /**
     * @notice tests bean issuance with only the silo.
     * @dev 100% of new bean signorage should be issued to the silo.
     */
    function test_sunOnlySilo(int256 deltaB, uint256 caseId) public {
        uint32 currentSeason = bs.season();
        uint256 initialBeanBalance = C.bean().balanceOf(BEANSTALK);
        uint256 initalPods = bs.totalUnharvestable();
        // cases can only range between 0 and 143.
        caseId = bound(caseId, 0, 143);
        // deltaB cannot exceed uint128 max.
        deltaB = bound(
            deltaB,
            -int256(uint256(type(uint128).max)),
            int256(uint256(type(uint128).max))
        );

        // soil event check.
        uint256 soilIssued;
        if (deltaB > 0) {
            // note: no soil is issued as no debt exists.
            vm.expectEmit();
            emit Reward(currentSeason + 1, 0, uint256(deltaB), 0);
        } else {
            soilIssued = uint256(-deltaB);
        }
        vm.expectEmit();
        emit Soil(currentSeason + 1, soilIssued);

        season.sunSunrise(deltaB, caseId);

        // if deltaB is positive,
        // 1) beans are minted equal to deltaB.
        // 2) soil is equal to the amount of soil
        // needed to equal the newly paid off pods (scaled up or down).
        // 3) no pods should be paid off.
        if (deltaB >= 0) {
            assertEq(C.bean().balanceOf(BEANSTALK), uint256(deltaB), "invalid bean minted +deltaB");
        }
        // if deltaB is negative, soil is issued equal to deltaB.
        // no beans should be minted.
        if (deltaB <= 0) {
            assertEq(
                initialBeanBalance - C.bean().balanceOf(BEANSTALK),
                0,
                "invalid bean minted -deltaB"
            );
        }

        // in both cases, soil should be issued,
        // and pods should remain 0.
        assertEq(bs.totalSoil(), soilIssued, "invalid soil issued");
        assertEq(bs.totalUnharvestable(), 0, "invalid pods");
    }

    /**
     * @notice tests bean issuance with a field and silo.
     * @dev bean mints are split between the field and silo 50/50.
     * In the case that the field is paid off with the new bean issuance,
     * the remaining bean issuance is given to the silo.
     */
    function test_sunFieldAndSilo(uint256 podsInField, int256 deltaB, uint256 caseId) public {
        uint32 currentSeason = bs.season();
        uint256 initialBeanBalance = C.bean().balanceOf(BEANSTALK);
        // cases can only range between 0 and 143.
        caseId = bound(caseId, 0, 143);
        // deltaB cannot exceed uint128 max.
        deltaB = bound(
            deltaB,
            -int256(uint256(type(uint128).max)),
            int256(uint256(type(uint128).max))
        );
        // increase pods in field.
        bs.incrementTotalPodsE(podsInField);

        // soil event check.
        uint256 soilIssued;
        uint256 beansToField;
        uint256 beansToSilo;
        if (deltaB > 0) {
            (beansToField, beansToSilo) = calcBeansToFieldAndSilo(uint256(deltaB), podsInField);
            soilIssued = getSoilIssuedAbovePeg(podsInField, beansToField, caseId);
            vm.expectEmit();
            emit Reward(currentSeason + 1, beansToField, beansToSilo, 0);
        } else {
            soilIssued = uint256(-deltaB);
        }
        vm.expectEmit();
        emit Soil(currentSeason + 1, soilIssued);

        season.sunSunrise(deltaB, caseId);

        // if deltaB is positive,
        // 1) beans are minted equal to deltaB.
        // 2) soil is equal to the amount of soil
        // needed to equal the newly paid off pods (scaled up or down).
        // 3) totalunharvestable() should decrease by the amount issued to the field.
        if (deltaB >= 0) {
            assertEq(C.bean().balanceOf(BEANSTALK), uint256(deltaB), "invalid bean minted +deltaB");
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ +deltaB");
            assertEq(bs.totalUnharvestable(), podsInField - beansToField, "invalid pods @ +deltaB");
        }
        // if deltaB is negative, soil is issued equal to deltaB.
        // no beans should be minted.
        if (deltaB <= 0) {
            assertEq(
                initialBeanBalance - C.bean().balanceOf(BEANSTALK),
                0,
                "invalid bean minted -deltaB"
            );
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ -deltaB");
            assertEq(bs.totalUnharvestable(), podsInField, "invalid pods @ -deltaB");
        }
    }

    /**
     * @notice tests bean issuance with a field, silo, and fertilizer.
     * @dev bean mints are split between the field, silo, and fertilizer 1/3, 1/3, 1/3.
     * In the case that the fertilizer is paid off with the new bean issuance,
     * the remaining bean issuance is split between field and silo.
     */
    function test_sunFertilizerFieldAndSilo(
        uint256 sproutsInBarn,
        uint256 podsInField,
        int256 deltaB,
        uint256 caseId
    ) public {
        uint32 currentSeason = bs.season();
        // cases can only range between 0 and 143.
        caseId = bound(caseId, 0, 143);
        // deltaB cannot exceed uint128 max.
        deltaB = bound(
            deltaB,
            -int256(uint256(type(uint128).max)),
            int256(uint256(type(uint128).max))
        );

        // test is capped to CP2 constraints. See {ConstantProduct2.sol}
        sproutsInBarn = bound(sproutsInBarn, 0, type(uint72).max);

        // increase pods in field.
        bs.incrementTotalPodsE(podsInField);

        // initialize farmer with unripe tokens in order for fertilizer to function.
        initializeUnripeTokens(users[0], 100e6, 100e18);
        uint256 fertilizerMinted;
        (sproutsInBarn, fertilizerMinted) = addFertilizerBasedOnSprouts(0, sproutsInBarn);
        // soil event check.
        uint256 soilIssued;
        uint256 beansToFertilizer;
        uint256 beansToField;
        uint256 beansToSilo;
        if (deltaB > 0) {
            (beansToFertilizer, beansToField, beansToSilo) = calcBeansToFertilizerFieldAndSilo(
                uint256(deltaB),
                sproutsInBarn,
                podsInField
            );
            soilIssued = getSoilIssuedAbovePeg(podsInField, beansToField, caseId);
            vm.expectEmit();
            emit Reward(currentSeason + 1, beansToField, beansToSilo, beansToFertilizer);
        } else {
            soilIssued = uint256(-deltaB);
        }

        // bean supply may change due to fert issuance, and inital supply is placed here.
        uint256 beansInBeanstalk = C.bean().balanceOf(BEANSTALK);

        vm.expectEmit();
        emit Soil(currentSeason + 1, soilIssued);

        season.sunSunrise(deltaB, caseId);

        // if deltaB is positive,
        // 1) beans are minted equal to deltaB.
        // 2) soil is equal to the amount of soil
        // needed to equal the newly paid off pods (scaled up or down).
        // 3) totalunharvestable() should decrease by the amount issued to the field.
        // 4) totalUnfertilizedBeans() should decrease by the amount issued to the barn.
        if (deltaB >= 0) {
            assertEq(
                C.bean().balanceOf(BEANSTALK) - beansInBeanstalk,
                uint256(deltaB),
                "invalid bean minted +deltaB"
            );
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ +deltaB");
            assertEq(bs.totalUnharvestable(), podsInField - beansToField, "invalid pods @ +deltaB");
            assertEq(
                bs.totalUnfertilizedBeans(),
                sproutsInBarn - beansToFertilizer,
                "invalid sprouts @ +deltaB"
            );
        }
        // if deltaB is negative, soil is issued equal to deltaB.
        // no beans should be minted.
        if (deltaB <= 0) {
            assertEq(
                C.bean().balanceOf(BEANSTALK) - beansInBeanstalk,
                0,
                "invalid bean minted -deltaB"
            );
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ -deltaB");
            assertEq(bs.totalUnharvestable(), podsInField, "invalid pods @ -deltaB");
            assertEq(bs.totalUnfertilizedBeans(), sproutsInBarn, "invalid sprouts @ +deltaB");
        }
    }

    ////// HELPER FUNCTIONS //////

    /**
     * @notice calculates the distrubution of field and silo beans.
     * @dev TODO: generalize division.
     */
    function calcBeansToFertilizerFieldAndSilo(
        uint256 beansIssued,
        uint256 sproutsInBarn,
        uint256 podsInField
    ) internal returns (uint256 beansToFertilizer, uint256 beansToField, uint256 beansToSilo) {
        // Fertilizer gets 1/3 of bean issuance. Only enabled if fert is purchased.
        if (bs.getActiveFertilizer() > 0) {
            beansToFertilizer = beansIssued / 3;
            // Fertilizer Issuance rounds down to the nearest activeFertilizer (see Sun.rewardToFertilizer).
            beansToFertilizer =
                (beansToFertilizer / bs.getActiveFertilizer()) *
                bs.getActiveFertilizer();
            // Cap fertilizer issuance is to the number of sprouts in the barn.
            if (beansToFertilizer > sproutsInBarn) beansToFertilizer = sproutsInBarn;
        }

        beansIssued -= beansToFertilizer;
        (beansToField, beansToSilo) = calcBeansToFieldAndSilo(beansIssued, podsInField);
    }

    /**
     * @notice calculates the distrubution of field and silo beans.
     * @dev TODO: generalize field division.
     */
    function calcBeansToFieldAndSilo(
        uint256 beansIssued,
        uint256 podsInField
    ) internal returns (uint256 beansToField, uint256 beansToSilo) {
        beansToField = beansIssued / 2 > podsInField ? podsInField : beansIssued / 2;
        beansToSilo = beansIssued - beansToField;
    }

    /**
     * @notice calculates the amount of soil issued above peg.
     * @dev see {Sun.sol}.
     */
    function getSoilIssuedAbovePeg(
        uint256 podsInField,
        uint256 podsRipened,
        uint256 caseId
    ) internal view returns (uint256 soilIssued) {
        soilIssued = (podsRipened * 100) / (100 + (bs.maxTemperature() / 1e6));
        if (caseId >= 24) {
            soilIssued = (soilIssued * 0.5e18) / 1e18; // high podrate
        } else if (caseId < 8) {
            soilIssued = (soilIssued * 1.5e18) / 1e18; // low podrate
        }
    }
}
