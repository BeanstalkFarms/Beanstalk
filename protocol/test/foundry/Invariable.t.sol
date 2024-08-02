// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";

import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {ClaimFacet} from "contracts/beanstalk/silo/SiloFacet/ClaimFacet.sol";
import {MockAttackFacet} from "contracts/mocks/mockFacets/MockAttackFacet.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

/**
 * @notice Tests the different invariants to ensure they are failing expectedly.
 * @dev All other test cases exercise happy case, only need to directly test breakage.
 */
contract InvariableTest is TestHelper {
    address[] siloUsers = new address[](3);

    function setUp() public {
        initializeBeanstalkTestState(true, true);
        MockToken(C.WETH).mint(BEANSTALK, 100_000);

        siloUsers = createUsers(3);
        initializeUnripeTokens(siloUsers[0], 100e6, 100e18);
        mintTokensToUsers(siloUsers, C.BEAN, 100_000e6);

        setUpSiloDepositTest(10_000e6, siloUsers);
        addFertilizerBasedOnSprouts(0, 100e6);
        sowAmountForFarmer(siloUsers[0], 1_000e6);
    }

    /**
     * @notice Violates fundsSafu invariant through manipulation of internal and external assets.
     */
    function test_fundsSafu(uint256 theftAmount) public {
        theftAmount = bound(theftAmount, 1, bean.balanceOf(BEANSTALK));

        // Advanced farm call containing one exploit call. Will be checked against  fundsSafu.
        IMockFBeanstalk.AdvancedFarmCall[]
            memory advancedFarmCalls = new IMockFBeanstalk.AdvancedFarmCall[](1);

        // Steal Bean from contract balance.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.stealBeans.selector, theftAmount),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Manipulate user internal balance.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.exploitUserInternalTokenBalance.selector),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Malicious send of user tokens internally.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.exploitUserSendTokenInternal.selector),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Exploit Fertilizer index.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.exploitFertilizer.selector),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Exploit Flood plenty.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.exploitSop.selector),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Exploit Pod Order Beans.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(MockAttackFacet.exploitPodOrderBeans.selector),
            abi.encode("")
        );
        vm.expectRevert("INV: Insufficient token balance");
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);

        // Happy path.
        advancedFarmCalls[0] = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(ClaimFacet.plant.selector),
            abi.encode("")
        );
        vm.prank(siloUsers[1]);
        bs.advancedFarm(advancedFarmCalls);
    }

    /**
     * @notice Violates noNetFlow invariant and confirms reversion.
     */
    function test_noNetFlow() public {
        vm.expectRevert("INV: noNetFlow Token balance changed");
        vm.prank(siloUsers[1]);
        bs.revert_netFlow();
    }

    /**
     * @notice Violates noOutFlow invariant and confirms reversion.
     */
    function test_noOutFlow() public {
        vm.expectRevert("INV: noOutFlow Token balance decreased");
        vm.prank(siloUsers[1]);
        bs.revert_outFlow();
    }

    /**
     * @notice Violates oneOutFlow invariant and confirms reversion.
     */
    function test_oneOutFlow() public {
        vm.expectRevert("INV: oneOutFlow multiple token balances decreased");
        vm.prank(siloUsers[1]);
        bs.revert_oneOutFlow();
    }

    /**
     * @notice Violates noSupplyChange invariant and confirms reversion.
     */
    function test_noSupplyChange() public {
        vm.expectRevert("INV: Supply changed");
        vm.prank(siloUsers[1]);
        bs.revert_supplyChange();
    }

    /**
     * @notice Violates noSupplyIncrease invariant and confirms reversion.
     */
    function test_noSupplyIncrease() public {
        vm.expectRevert("INV: Supply increased");
        vm.prank(siloUsers[1]);
        bs.revert_supplyIncrease();
    }
}
