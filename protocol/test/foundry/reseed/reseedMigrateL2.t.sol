// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {BeanL2MigrationFacet} from "contracts/beanstalk/migration/BeanL2MigrationFacet.sol";
import {ReseedL2Migration} from "contracts/beanstalk/init/reseed/L1/ReseedL2Migration.sol";
import {L1TokenFacet} from "contracts/beanstalk/migration/L1TokenFacet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";

/**
 * @notice Tests the functionality of migration.
 * @dev note: this test assumes an L2 chain, but can be modified based on the DAO's needs.
 */
contract reeseedMigrateL2 is TestHelper {
    // mainnet fork id.
    uint256 mainnetForkId;

    // L2 fork Id
    uint256 l2ForkId;

    function setUp() public {
        // fork mainnet.
        mainnetForkId = vm.createFork(vm.envString("FORKING_RPC"));
        vm.selectFork(mainnetForkId);

        // perform step 1 of the migration process. (transferring assets to the BCM).
        // this is done on L1.

        // this test was written prior to the deployment of the bean-wsteth well.
        // thus, a mock deployment is used. This should be removed upon the bean-wsteth migration.
        aquifer = AQUIFER;
        deployWellAtAddressNoData(
            C.BEAN_WSTETH_WELL,
            C.BEAN,
            C.WSTETH,
            CP2,
            MFP,
            WELL_IMPLMENTATION
        );

        string[] memory facetNames = new string[](2);
        facetNames[0] = "BeanL2MigrationFacet";
        facetNames[1] = "L1TokenFacet";
        address[] memory newFacetAddresses = new address[](2);
        newFacetAddresses[0] = address(new BeanL2MigrationFacet()); // deploy the BeanL2MigrationFacet.
        newFacetAddresses[1] = address(new L1TokenFacet()); // deploy the BeanL2MigrationFacet.

        IDiamondCut.FacetCutAction[] memory facetCutActions = new IDiamondCut.FacetCutAction[](2);
        facetCutActions[0] = IDiamondCut.FacetCutAction.Add;
        facetCutActions[1] = IDiamondCut.FacetCutAction.Replace;

        // upgrade beanstalk with an L2 migration facet.
        upgradeWithNewFacets(
            BEANSTALK, // upgrading beanstalk.
            IMockFBeanstalk(BEANSTALK).owner(), // fetch beanstalk owner.
            facetNames,
            newFacetAddresses,
            facetCutActions,
            address(new ReseedL2Migration()), // deploy the InitMint.
            abi.encodeWithSignature("init()"), // call init.
            new bytes4[](0) // remove no selectors.
        );
    }

    /**
     * @notice verfies that all assets have been transferred to the BCM.
     */
    function test_bcm_transfer() public {
        uint256 beanEthBalance = IERC20(C.BEAN_ETH_WELL).balanceOf(BEANSTALK);
        uint256 bean3crvBalance = IERC20(C.CURVE_BEAN_METAPOOL).balanceOf(BEANSTALK);
        uint256 wstethBalance = IERC20(C.BEAN_WSTETH_WELL).balanceOf(BEANSTALK);

        assertEq(beanEthBalance, 0);
        assertEq(bean3crvBalance, 0);
        assertEq(wstethBalance, 0);
    }

    //////// MIGRATION HELPERS ////////
    // function generateL2MigrationSelectors() public {}
}
