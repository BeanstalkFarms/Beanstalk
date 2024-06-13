// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";

import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockAttackFacet} from "contracts/mocks/mockFacets/MockAttackFacet.sol";
import {ClaimFacet} from "contracts/beanstalk/silo/SiloFacet/ClaimFacet.sol";

/**
 * @notice Tests the different invariants to ensure they are failing expectedly.
 * @dev All other test cases exercise happy case, only need to directly test breakage.
 */
contract InvariableTest is TestHelper {

    address[] siloUsers = new address[](3);

    function setUp() public {
        initializeBeanstalkTestState(true, true);

        siloUsers = createUsers(3);
        mintTokensToUsers(siloUsers, C.BEAN, 100_000e6);
        initializeUnripeTokens(users[0], 100e6, 100e18);

        setUpSiloDepositTest(10_000e6, siloUsers);
        addFertilizerBasedOnSprouts(0, 100e6);
        sowAmountForFarmer(users[0], 1_000e6);
    }

    /**
     * @notice Violates fundsSafu invariant and confirms reversion.
     */
    function test_fundsSafu(uint256 theftAmount) public {
        theftAmount = bound(theftAmount, 100e6, bean.balanceOf(BEANSTALK));

        IMockFBeanstalk.AdvancedFarmCall[]
            memory advancedFarmCalls = new IMockFBeanstalk.AdvancedFarmCall[](2);
        // Steal Bean from contract balance.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.stealBeans.selector, theftAmount),
            abi.encode("")
        );
        // Execute any external facing function invoking the invariant check.
        advancedFarmCalls[1] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(ClaimFacet.plant.selector),
            abi.encode("")
        );

        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(users[1]);
        bs.advancedFarm(advancedFarmCalls);
    }

    // /**
    //  * @notice Violates noNetFlow invariant and confirms reversion.
    //  */
    // function test_noNetFlow(int256 deltaB, uint256 caseId) public {
    // }

    // /**
    //  * @notice Violates fundsSafu invariant and confirms reversion.
    //  */
    // function test_noOutFlow(int256 deltaB, uint256 caseId) public {
    // }

    // /**
    //  * @notice Violates fundsSafu invariant and confirms reversion.
    //  */
    // function test_oneOutFlow(int256 deltaB, uint256 caseId) public {
    // }

    // /**
    //  * @notice Violates fundsSafu invariant and confirms reversion.
    //  */
    // function test_noSupplyChange(int256 deltaB, uint256 caseId) public {
    // }

    // /**
    //  * @notice Violates fundsSafu invariant and confirms reversion.
    //  */
    // function test_noSupplyIncrease(int256 deltaB, uint256 caseId) public {
    // }
}
