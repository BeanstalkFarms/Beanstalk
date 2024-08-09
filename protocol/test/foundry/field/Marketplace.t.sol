// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {TestHelper, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {MockFieldFacet} from "contracts/mocks/mockFacets/MockFieldFacet.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {C} from "contracts/C.sol";

contract ListingTest is TestHelper {
    // test accounts
    address[] farmers;

    MockFieldFacet field = MockFieldFacet(BEANSTALK);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        season.siloSunrise(0);

        // initalize farmers from farmers (farmer0 == diamond deployer)
        farmers.push(users[1]);
        farmers.push(users[2]);

        // max approve.
        maxApproveBeanstalk(farmers);

        mintTokensToUsers(farmers, C.BEAN, MAX_DEPOSIT_BOUND);

        field.incrementTotalSoilE(1000e18);

        // mine 300 blocks
        vm.roll(300);

        //set temp
        bs.setYieldE(0);

        console.log("bs.activeField(): ", bs.activeField());

        // sow 1000
        vm.prank(users[1]);
        uint256 pods = bs.sow(1000e6, 0, 0);
        console.log("Pods: ", pods);
        vm.prank(users[2]);
        bs.sow(1000e6, 0, 0);
    }

    function testCreatePodListing_InvalidMinFillAmount() public {
        IMockFBeanstalk.PodListing memory podListing = IMockFBeanstalk.PodListing({
            lister: users[1],
            fieldId: bs.activeField(),
            index: 0,
            start: 0,
            podAmount: 50,
            pricePerPod: 100,
            maxHarvestableIndex: 100,
            minFillAmount: 60, // Invalid: greater than podAmount
            mode: 0
        });

        vm.expectRevert("Marketplace: minFillAmount must be <= podAmount.");
        vm.prank(users[1]);
        bs.createPodListing(podListing);
    }

    function testCreatePodListing_ValidMinFillAmount() public {
        // no revert
        IMockFBeanstalk.PodListing memory podListing = IMockFBeanstalk.PodListing({
            lister: users[1],
            fieldId: bs.activeField(),
            index: 0,
            start: 0,
            podAmount: 50,
            pricePerPod: 100,
            maxHarvestableIndex: 100,
            minFillAmount: 30, // Valid: less than or equal to podAmount
            mode: 0
        });
        vm.prank(users[1]);
        bs.createPodListing(podListing);
    }
}
