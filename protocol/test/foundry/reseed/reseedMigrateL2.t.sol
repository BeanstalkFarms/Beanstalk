// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {BeanL2MigrationFacet} from "contracts/beanstalk/migration/BeanL2MigrationFacet.sol";
import {ReseedL2Migration} from "contracts/beanstalk/init/reseed/L1/ReseedL2Migration.sol";
import {L1TokenFacet} from "contracts/beanstalk/migration/L1TokenFacet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "contracts/interfaces/IDiamondLoupe.sol";

/**
 * @notice Tests the functionality of migration.
 * @dev note: this test assumes an L2 chain, but can be modified based on the DAO's needs.
 */
contract reeseedMigrateL2 is TestHelper {
    // BCM.
    address internal constant BCM = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    // Beanstalk Farms.
    address internal constant BS_FARMS = address(0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7);

    // L2Beanstalk: note this is a mock/random address.
    address internal constant L2_BEANSTALK = address(0x4021489084021481024812904812481242141241);

    // mainnet fork id.
    uint256 mainnetForkId;

    // L2 fork Id
    uint256 l2ForkId;

    function setUp() public {
        bs = IMockFBeanstalk(BEANSTALK);
        // fork mainnet.
        mainnetForkId = vm.createFork(vm.envString("FORKING_RPC"), 19976370);

        // fork base.
        l2ForkId = vm.createFork(vm.envString("BASE_FORKING_RPC"), 15104866);
        vm.selectFork(mainnetForkId);
        vm.label(address(0x866E82a600A1414e583f7F13623F1aC5d58b0Afa), "Base L1 Bridge");
        vm.label(BEANSTALK, "Beanstalk");
        vm.label(C.BEAN, "BEAN");

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
        newFacetAddresses[1] = address(new L1TokenFacet()); // deploy the L1TokenFacet.

        IDiamondCut.FacetCutAction[] memory facetCutActions = new IDiamondCut.FacetCutAction[](2);
        facetCutActions[0] = IDiamondCut.FacetCutAction.Add;
        facetCutActions[1] = IDiamondCut.FacetCutAction.Add;
        bytes4[] memory removedSelectors = generateL2MigrationSelectors();
        // upgrade beanstalk with an L2 migration facet.
        upgradeWithNewFacets(
            BEANSTALK, // upgrading beanstalk.
            IMockFBeanstalk(BEANSTALK).owner(), // fetch beanstalk owner.
            facetNames,
            newFacetAddresses,
            facetCutActions,
            address(new ReseedL2Migration()), // deploy the ReseedL2Migration.
            abi.encodeWithSignature("init()"), // call init.
            removedSelectors // remove all selectors from beanstalk.
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

        beanEthBalance = IERC20(C.BEAN_ETH_WELL).balanceOf(BCM);
        bean3crvBalance = IERC20(C.CURVE_BEAN_METAPOOL).balanceOf(BCM);
        wstethBalance = IERC20(C.BEAN_WSTETH_WELL).balanceOf(BCM);

        assertGe(beanEthBalance, 1e18);
        assertGe(bean3crvBalance, 1e18);
    }

    // verify facets have been removed.
    function test_facets() public view {
        IDiamondLoupe.Facet[] memory facets = IDiamondLoupe(BEANSTALK).facets();
        assertEq(facets.length, 6);
        assertEq(facets[0].facetAddress, address(0xDFeFF7592915bea8D040499E961E332BD453C249)); // DiamondCutFacet
        assertEq(facets[1].facetAddress, address(0xB51D5C699B749E0382e257244610039dDB272Da0)); // DiamondLoupeFacet
        assertEq(facets[2].facetAddress, address(0x5D45283Ff53aabDb93693095039b489Af8b18Cf7)); // OwnershipFacet
        assertEq(facets[3].facetAddress, address(0xeab4398f62194948cB25F45fEE4C46Fae2e91229)); // PauseFacet
    }

    // user is able to transfer farm balances out.
    // user is unable to transfer assets into the farm balance.
    // user is able transfer internally between farm balances.
    // user is unable to transfer bean assets.
    function test_transferTokens() public {
        // active address on beanstalk.
        address user = address(0x1c42949f6f326Fc53E6fAaDE1A4cCB9b5b209A80);
        // transfer out.
        address token = address(C.USDC);

        uint256 initialTokenBalance = IERC20(C.USDC).balanceOf(BEANSTALK);
        uint256 initialInternalTokenBalance = bs.getInternalBalance(user, token);

        // initial snapshot.
        uint256 snapshot = vm.snapshot();

        vm.prank(user);
        // verify the user is able to remove internal balances into their external balances.
        bs.transferToken(token, user, 1e6, 1, 0);
        assertEq(IERC20(token).balanceOf(user), 1e6);
        assertEq(initialTokenBalance - IERC20(token).balanceOf(BEANSTALK), 1e6);
        assertEq(initialInternalTokenBalance - bs.getInternalBalance(user, token), 1e6);

        // verify the user is Unable to transfer into internal balances.
        vm.prank(user);
        vm.expectRevert("TokenFacet: EXTERNAL->INTERNAL transfers are disabled.");
        bs.transferToken(token, user, 1e6, 0, 1);

        // revert to snapshot.
        vm.revertTo(snapshot);
        vm.prank(user);
        // verify the user is able to transfer internal balances to other users).
        bs.transferToken(token, address(100010), 1e6, 1, 1);
        assertEq(IERC20(token).balanceOf(user), 0);
        assertEq(IERC20(token).balanceOf(address(100010)), 0);
        assertEq(initialTokenBalance - IERC20(token).balanceOf(BEANSTALK), 0);
        assertEq(initialInternalTokenBalance - bs.getInternalBalance(user, token), 1e6);
        assertEq(bs.getInternalBalance(address(100010), token), 1e6);
    }

    // verifies that the user is able to migrate external beans to L2.
    function test_bean_l2_migration() public {
        vm.startPrank(BS_FARMS);
        IERC20(C.BEAN).approve(BEANSTALK, 1e6);
        BeanL2MigrationFacet(BEANSTALK).migrateL2Beans(BS_FARMS, L2_BEANSTALK, 1e6, 1000000);
    }

    //////// MIGRATION HELPERS ////////
    /**
     * @notice generates the list of selectors that will be removed from beanstalk.
     */
    function generateL2MigrationSelectors() internal view returns (bytes4[] memory facetSelectors) {
        // get all facets from beanstalk.
        facetSelectors = new bytes4[](65535);
        IDiamondLoupe.Facet[] memory facets = IDiamondLoupe(BEANSTALK).facets();
        uint256 k;
        for (uint i; i < facets.length; i++) {
            IDiamondLoupe.Facet memory facet = facets[i];
            bytes4[] memory selectors = facet.functionSelectors;
            if (checkForWhitelistedFacet(facet.facetAddress)) {
                for (uint j; j < selectors.length; j++) {
                    facetSelectors[k++] = selectors[j];
                }
            }
        }
        assembly {
            mstore(facetSelectors, k)
        }
    }

    /**
     * @notice the following facets will not be removed / changed during the migration:
     * diamondLoupeFacet, diamondCutFacet, ownershipFacet, pauseFacet.
     * Part of the token facet will be removed.
     */
    function checkForWhitelistedFacet(address _facet) internal pure returns (bool) {
        return
            _facet != address(0xDFeFF7592915bea8D040499E961E332BD453C249) && // diamondCutFacet
            _facet != address(0xB51D5C699B749E0382e257244610039dDB272Da0) && // diamondLoupeFacet
            _facet != address(0x5D45283Ff53aabDb93693095039b489Af8b18Cf7) && // ownershipFacet
            _facet != address(0xeab4398f62194948cB25F45fEE4C46Fae2e91229); // pauseFacet
    }
}
