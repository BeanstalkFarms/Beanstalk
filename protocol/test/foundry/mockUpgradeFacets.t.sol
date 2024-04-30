// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {console} from "forge-std/console.sol";
import {MockUpgradeFacet} from "contracts/mocks/mockFacets/MockUpgradeFacet.sol";
import {InitMint} from "contracts/beanstalk/init/InitMint.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";

/**
 * @title GerminationTest
 * @author Brean
 * @notice Test the germination of beans in the silo.
 * @dev Tests total/farmer values and validates the germination process.
 */
contract MockUpgradeFacets is TestHelper {
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
        string[] memory facetNames = new string[](1);
        facetNames[0] = "MockUpgradeFacet";
        address[] memory newFacetAddresses = new address[](1);
        newFacetAddresses[0] = deployCode("MockUpgradeFacet.sol");

        users = createUsers(1);
        address user = users[0];

        // upgrade beanstalk with a new mock facet and init Mint.
        upgradeWithNewFacets(
            BEANSTALK, // upgrading beanstalk.
            IMockFBeanstalk(BEANSTALK).owner(), // fetch beanstalk owner.
            facetNames,
            newFacetAddresses,
            address(new InitMint()), // deploy the InitMint.
            abi.encodeWithSignature("init(address,uint256)", user, 100e6), // issue 100 beans to owner.
            new bytes4[](0) // remove no selectors.
        );
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
            address(0),
            new bytes(0),
            removeSelectors
        );

        // verify woohoo() is removed.
        vm.expectRevert(bytes("Diamond: Function does not exist"));
        MockUpgradeFacet(BEANSTALK).woohoo();
    }
}
