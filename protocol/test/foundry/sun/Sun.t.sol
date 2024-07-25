// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {IMockFBeanstalk as IBS} from "contracts/interfaces/IMockFBeanstalk.sol";

/**
 * @notice Tests the functionality of the sun, the distrubution of beans and soil.
 */
contract SunTest is TestHelper {
    // Events
    event Soil(uint32 indexed season, uint256 soil);
    event Shipped(uint32 indexed season, uint256 shipmentAmount);
    // event Receipt(IBS.ShipmentRecipient indexed recipient, uint256 receivedAmount, bytes data);

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
        uint256 initalPods = bs.totalUnharvestable(0);
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
        assertEq(bs.totalUnharvestable(0), 0, "invalid pods");
    }

    /**
     * @notice tests bean issuance with a field and silo.
     * @dev bean mints are split between the field and silo 50/50.
     * In the case that the field is paid off with the new bean issuance,
     * the remaining bean issuance is given to the silo.
     */
    function test_sunFieldAndSilo(uint256 podsInField, int256 deltaB, uint256 caseId) public {
        // Set up shipment routes to include only Silo and one Field.
        setRoutes_siloAndFields();

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
        bs.incrementTotalPodsE(0, podsInField);

        // soil event check.
        uint256 soilIssued;
        uint256 beansToField;
        uint256 beansToSilo;
        if (deltaB > 0) {
            (beansToField, beansToSilo) = calcBeansToFieldAndSilo(uint256(deltaB), podsInField);
            soilIssued = getSoilIssuedAbovePeg(beansToField, caseId);
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
            assertEq(
                bs.totalUnharvestable(0),
                podsInField - beansToField,
                "invalid pods @ +deltaB"
            );
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
            assertEq(bs.totalUnharvestable(0), podsInField, "invalid pods @ -deltaB");
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

        uint256 initialEarnedBeans = bs.totalEarnedBeans();

        // test is capped to CP2 constraints. See {ConstantProduct2.sol}
        sproutsInBarn = bound(sproutsInBarn, 0, type(uint72).max);

        // increase pods in field.
        bs.incrementTotalPodsE(0, podsInField);

        // initialize farmer with unripe tokens in order for fertilizer to function.
        initializeUnripeTokens(users[0], 100e6, 100e18);
        uint256 fertilizerMinted;
        (sproutsInBarn, fertilizerMinted) = addFertilizerBasedOnSprouts(0, sproutsInBarn);
        assertEq(sproutsInBarn, bs.totalUnfertilizedBeans(), "invalid sprouts in barn");

        // bean supply may change due to fert issuance, and initial supply is placed here.
        uint256 beansInBeanstalk = C.bean().balanceOf(BEANSTALK);

        int256 initialLeftoverBeans = int256(bs.leftoverBeans());

        vm.expectEmit(true, false, false, false);
        emit Soil(currentSeason + 1, 0);

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

            // Verify amount of change in Fertilizer. Either a max of cap or a min of 1/3 mints.
            uint256 beansToFertilizer = sproutsInBarn - bs.totalUnfertilizedBeans();
            int256 leftoverChange = int256(bs.leftoverBeans()) - initialLeftoverBeans;
            beansToFertilizer = leftoverChange > 0
                ? beansToFertilizer + uint256(leftoverChange)
                : beansToFertilizer - uint256(-leftoverChange);
            assertLe(beansToFertilizer, uint256(deltaB) / 2, "too many Beans to Fert");
            assertTrue(
                beansToFertilizer == sproutsInBarn - uint256(initialLeftoverBeans) ||
                    beansToFertilizer >= uint256(deltaB) / 3,
                "not enough Beans to Fert"
            );

            // Verify amount of change in Field. Either a max of cap or a min of 1/3 mints.
            uint256 beansToField = podsInField - bs.totalUnharvestable(0);
            assertLe(beansToField, uint256(deltaB) / 2, "too many Beans to Field");
            assertTrue(
                beansToField == podsInField || beansToField >= uint256(deltaB) / 3,
                "not enough Beans to Field"
            );

            // Verify amount of change in Silo. Min of 1/3 mints.
            uint256 beansToSilo = bs.totalEarnedBeans() - initialEarnedBeans;
            assertLe(beansToSilo, uint256(deltaB), "too many Beans to Silo");
            assertGe(beansToSilo, uint256(deltaB) / 3, "not enough Beans to Silo");

            uint256 soilIssued = getSoilIssuedAbovePeg(beansToField, caseId);
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ +deltaB");
        }
        // if deltaB is negative, soil is issued equal to deltaB.
        // no beans should be minted.
        if (deltaB <= 0) {
            assertEq(
                C.bean().balanceOf(BEANSTALK) - beansInBeanstalk,
                0,
                "invalid bean minted -deltaB"
            );
            assertEq(bs.totalUnfertilizedBeans(), sproutsInBarn, "invalid sprouts @ +deltaB");
            assertEq(bs.totalUnharvestable(0), podsInField, "invalid pods @ -deltaB");
            uint256 soilIssued = uint256(-deltaB);
            vm.roll(block.number + 300);
            assertEq(bs.totalSoil(), soilIssued, "invalid soil @ -deltaB");
        }
    }

    // TODO: Improve this tests by handling multiple concurrent seasons with shipment edge cases.
    /**
     * @notice tests bean issuance with two fields, a silo, and a fertilizer.
     * @dev bean mints are split between the field 0, field 1, silo, and fertilizer.
     *      Points corresponding to the routes are 10, 30, 30, 30.
     * In the case that the fertilizer is paid off with the new bean issuance,
     * the remaining bean issuance is split between field and silo.
     */
    function test_multipleSunrisesWithTwoFieldsFertilizerAndSilo(
        uint256 sproutsInBarn,
        uint256 podsInField0,
        uint256 podsInField1,
        int256[] memory deltaBList,
        uint256[] memory caseIdList
    ) public {
        // int256[] memory deltaBList = new int256[](3);
        // uint256[] memory caseIdList = new uint256[](3);
        // deltaBList[0] = 100;
        // deltaBList[1] = -100;
        // deltaBList[2] = 100;
        // caseIdList[0] = 0;
        // caseIdList[1] = 1;
        // caseIdList[2] = 2;

        vm.assume(deltaBList.length > 0);
        vm.assume(caseIdList.length > 0);
        uint256 numOfSeasons = deltaBList.length < caseIdList.length
            ? deltaBList.length
            : caseIdList.length;

        // test is capped to CP2 constraints. See {ConstantProduct2.sol}
        sproutsInBarn = bound(sproutsInBarn, 0, type(uint72).max);

        // increase pods in field.
        bs.incrementTotalPodsE(0, podsInField0);
        bs.incrementTotalPodsE(1, podsInField1);

        // initialize farmer with unripe tokens in order for fertilizer to function.
        initializeUnripeTokens(users[0], 100e6, 100e18);
        (sproutsInBarn, ) = addFertilizerBasedOnSprouts(0, sproutsInBarn);
        assertEq(sproutsInBarn, bs.totalUnfertilizedBeans(), "invalid sprouts in barn");

        // Set up second Field. Update Routes and Plan getters.
        vm.prank(deployer);
        bs.addField();
        vm.prank(deployer);
        bs.setActiveField(1, 1);
        setRoutes_siloAndBarnAndTwoFields();

        for (uint256 i; i < numOfSeasons; i++) {
            // int256 deltaB = deltaBList[i];
            // uint256 caseId = caseIdList[i];

            // deltaB cannot exceed uint128 max. Bound tighter here to handle repeated seasons.
            int256 deltaB = bound(deltaBList[i], type(int96).min, type(int96).max);
            // cases can only range between 0 and 143.
            uint256 caseId = bound(caseIdList[i], 0, 143);

            // May change at each sunrise.
            uint256 priorEarnedBeans = bs.totalEarnedBeans();
            uint256 priorBeansInBeanstalk = C.bean().balanceOf(BEANSTALK);
            uint256 priorUnfertilizedBeans = bs.totalUnfertilizedBeans();
            uint256 priorLeftoverBeans = bs.leftoverBeans();

            vm.roll(block.number + 300);

            // vm.expectEmit(false, false, false, false);
            // emit Soil(0, 0);

            season.sunSunrise(deltaB, caseId);

            // if deltaB is positive,
            // 1) beans are minted equal to deltaB.
            // 2) soil is equal to the amount of soil
            // needed to equal the newly paid off pods (scaled up or down).
            // 3) totalunharvestable() should decrease by the amount issued to the field.
            // 4) totalUnfertilizedBeans() should decrease by the amount issued to the barn.
            if (deltaB >= 0) {
                assertEq(
                    C.bean().balanceOf(BEANSTALK) - priorBeansInBeanstalk,
                    uint256(deltaB),
                    "invalid bean minted +deltaB"
                );

                // Verify amount of change in Fertilizer. Either a max of cap or a min of 1/3 mints.
                {
                    // int256 leftoverChange = ;
                    uint256 beansToFertilizer = uint256(
                        int256(priorUnfertilizedBeans) -
                            int256(bs.totalUnfertilizedBeans()) +
                            (int256(bs.leftoverBeans()) - int256(priorLeftoverBeans))
                    );
                    // There is no case where Fert receives more than 50% of mints (shared w/ Silo).
                    assertLe(beansToFertilizer, uint256(deltaB) / 2, "too many Beans to Fert");
                    // Fert should either receive its exact cap, or a minimum of its point ratio.
                    uint256 fertCap = priorUnfertilizedBeans - priorLeftoverBeans;
                    assertLe(beansToFertilizer, fertCap, "Beans to Fert exceeds cap");
                    if (beansToFertilizer != fertCap) {
                        assertGe(
                            beansToFertilizer,
                            (uint256(deltaB) * 3) / 10,
                            "not enough Beans to Fert"
                        );
                    }
                    sproutsInBarn -= beansToFertilizer;
                }

                // Verify amount of change in Field 0. Either a max of cap or a min of 1/3 mints.
                {
                    uint256 beansToField0 = podsInField0 - bs.totalUnharvestable(0);
                    // There is no case where a Field receives more than 50% of mints (shared w/ Silo).
                    assertLe(beansToField0, uint256(deltaB) / 2, "too many Beans to Field 0");
                    // Field should either receive its exact cap, or a minimum of its point ratio.
                    if (beansToField0 != podsInField0) {
                        assertGe(
                            beansToField0,
                            (uint256(deltaB) * 1) / 10,
                            "not enough Beans to Field 0"
                        );
                    }
                    podsInField0 -= beansToField0;
                }

                // Verify amount of change in Field 1. Either a max of cap or a min of 1/3 mints.
                {
                    uint256 beansToField1 = podsInField1 - bs.totalUnharvestable(1);
                    // There is no case where a Field receives more than 50% of mints (shared w/ Silo).
                    assertLe(beansToField1, uint256(deltaB) / 2, "too many Beans to Field 1");
                    // Field should either receive its exact cap, or a minimum of its point ratio.
                    if (beansToField1 != podsInField1) {
                        assertGe(
                            beansToField1,
                            (uint256(deltaB) * 3) / 10,
                            "not enough Beans to Field 1"
                        );
                    }
                    podsInField1 -= beansToField1;

                    // Verify soil amount. Field 1 is the active Field.
                    uint256 soilIssued = getSoilIssuedAbovePeg(beansToField1, caseId);
                    assertEq(bs.totalSoil(), soilIssued, "invalid soil @ +deltaB");
                }

                // Verify amount of change in Silo. Min of 1/3 mints.
                {
                    uint256 beansToSilo = bs.totalEarnedBeans() - priorEarnedBeans;
                    // Silo can receive at most 100% of deltaB.
                    assertLe(beansToSilo, uint256(deltaB), "too many Beans to Silo");
                    // Silo should receive at least 1/3 of deltaB.
                    assertGe(beansToSilo, (uint256(deltaB) * 3) / 10, "not enough Beans to Silo");
                }
            }
            // if deltaB is negative, soil is issued equal to deltaB.
            // no beans should be minted.
            if (deltaB <= 0) {
                assertEq(
                    C.bean().balanceOf(BEANSTALK) - priorBeansInBeanstalk,
                    0,
                    "invalid bean minted -deltaB"
                );
                assertEq(
                    bs.totalUnfertilizedBeans() - bs.leftoverBeans(),
                    sproutsInBarn,
                    "invalid sprouts @ +deltaB"
                );
                assertEq(bs.totalUnharvestable(0), podsInField0, "invalid pods @ -deltaB");
                assertEq(bs.totalUnharvestable(1), podsInField1, "invalid pods @ -deltaB");
                uint256 soilIssued = uint256(-deltaB);
                vm.roll(block.number + 50);
                assertEq(bs.totalSoil(), soilIssued, "invalid soil @ -deltaB");
            }
        }
    }

    ////// HELPER FUNCTIONS //////

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
        uint256 podsRipened,
        uint256 caseId
    ) internal view returns (uint256 soilIssued) {
        soilIssued = (podsRipened * 100) / (100 + (bs.maxTemperature() / 1e6));
        if (caseId % 36 >= 24) {
            soilIssued = (soilIssued * 0.5e18) / 1e18; // high podrate
        } else if (caseId % 36 < 8) {
            soilIssued = (soilIssued * 1.5e18) / 1e18; // low podrate
        }
    }
}
