// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {MockUpgradeFacet} from "contracts/mocks/mockFacets/MockUpgradeFacet.sol";
import {InitMint} from "contracts/beanstalk/init/InitMint.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";
import {console} from "forge-std/console.sol";

/**
 * @title UpgradeDiamond
 * @author Brean
 * @notice Tests upgrading the diamond.
 */
contract UpgradeDiamond is TestHelper {
    // test accounts
    address[] farmers;

    // forking id.
    uint256 mainnetForkId;

    /**
     * @dev FORKING_RPC must be set as an environment variable.
     */
    function setUp() public {
        mainnetForkId = vm.createFork(vm.envString("FORKING_RPC"));
        vm.selectFork(mainnetForkId);
    }

    function testWoohoo() public pure {
        // verify facet is added (call woohoo()).
        assertEq(MockUpgradeFacet(BEANSTALK).woohoo(), 1);
    }

    function testInitMint() public view {
        // verify beans are minted.
        assertEq(C.bean().balanceOf(users[0]), 100e6);
    }

    function test_SelectorRemoval() public {
        // check woohoo.
        assertEq(MockUpgradeFacet(BEANSTALK).woohoo(), 1);

        bytes4[] memory removeSelectors = new bytes4[](1);
        removeSelectors[0] = MockUpgradeFacet.woohoo.selector;
        // remove woohoo:
        upgradeWithNewFacets(
            BEANSTALK, // upgrading beanstalk.
            IMockFBeanstalk(BEANSTALK).owner(), // fetch beanstalk owner.
            new string[](0),
            new address[](0),
            new IDiamondCut.FacetCutAction[](0),
            address(0),
            new bytes(0),
            removeSelectors
        );

        // verify woohoo() is removed.
        vm.expectRevert(bytes("Diamond: Function does not exist"));
        MockUpgradeFacet(BEANSTALK).woohoo();
    }

    function testPumps() public {
        address beanWstethWell = address(0xBea0061680A2DEeBFA59076d77e0b6c769660595);
        Call[] memory pumps = IWell(beanWstethWell).pumps();
    }
}
