// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L2MigrationFacet} from "contracts/beanstalk/migration/L2MigrationFacet.sol";
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

    address internal constant CURVE_BEAN_METAPOOL = 0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49;
    address internal constant BEAN_ETH = address(0xBEA0e11282e2bB5893bEcE110cF199501e872bAd);
    address internal constant BEAN_WSTETH = address(0xBeA0000113B0d182f4064C86B71c315389E4715D);

    // mainnet fork id.
    uint256 mainnetForkId;

    // L2 fork Id
    uint256 l2ForkId;

    function setUp() public {
        bs = IMockFBeanstalk(BEANSTALK);
        // fork mainnet.
        mainnetForkId = vm.createFork(vm.envString("FORKING_RPC"), 20584419);

        // fork base.
        l2ForkId = vm.createFork(vm.envString("ARBITRUM_FORKING_RPC"), 245539862);
        vm.selectFork(mainnetForkId);
        vm.label(address(0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f), "Arbitrum L1 Bridge");
        vm.label(BEANSTALK, "Beanstalk");

        // perform step 1 of the migration process. (transferring assets to the BCM).
        // this is done on L1.

        string[] memory facetNames = new string[](2);
        facetNames[0] = "L2MigrationFacet";
        facetNames[1] = "L1TokenFacet";
        address[] memory newFacetAddresses = new address[](2);
        newFacetAddresses[0] = address(new L2MigrationFacet()); // deploy the L2MigrationFacet.
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
    function test_bcm_transfer() public view {
        uint256 beanEthBalance = IERC20(BEAN_ETH).balanceOf(BEANSTALK);
        uint256 bean3crvBalance = IERC20(CURVE_BEAN_METAPOOL).balanceOf(BEANSTALK);
        uint256 wstethBalance = IERC20(BEAN_WSTETH).balanceOf(BEANSTALK);

        assertEq(beanEthBalance, 0);
        assertEq(bean3crvBalance, 0);
        assertEq(wstethBalance, 0);

        beanEthBalance = IERC20(BEAN_ETH).balanceOf(BCM);
        bean3crvBalance = IERC20(CURVE_BEAN_METAPOOL).balanceOf(BCM);
        wstethBalance = IERC20(BEAN_WSTETH).balanceOf(BCM);

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

    // user is able to transfer farm balances in/out.
    // user is able transfer internally between farm balances.
    // user is unable to transfer bean assets.
    function test_transferTokens() public {
        // active address on beanstalk.
        address user = address(0x1c42949f6f326Fc53E6fAaDE1A4cCB9b5b209A80);
        // transfer out.
        address token = address(USDC);

        uint256 initialTokenBalance = IERC20(USDC).balanceOf(BEANSTALK);
        uint256 initialUserBalance = IERC20(USDC).balanceOf(user);
        uint256 initialInternalTokenBalance = bs.getInternalBalance(user, token);

        vm.prank(user);
        IERC20(USDC).approve(BEANSTALK, type(uint256).max);

        vm.prank(user);
        // verify the user is able to deposit into internal balances.
        bs.transferToken(token, user, 1e6, 0, 1);
        assertEq(initialUserBalance - IERC20(token).balanceOf(user), 1e6);
        assertEq(IERC20(token).balanceOf(BEANSTALK) - initialTokenBalance, 1e6);
        assertEq(bs.getInternalBalance(user, token) - initialInternalTokenBalance, 1e6);

        // initial snapshot.
        uint256 snapshot = vm.snapshot();

        initialUserBalance = IERC20(USDC).balanceOf(user);
        initialInternalTokenBalance = bs.getInternalBalance(user, token);
        initialTokenBalance = IERC20(USDC).balanceOf(BEANSTALK);
        vm.prank(user);
        // verify the user is able to transfer internal balances to other users).
        bs.transferToken(token, address(100010), 1e6, 1, 1);
        assertEq(initialUserBalance - IERC20(token).balanceOf(user), 0);
        assertEq(IERC20(token).balanceOf(address(100010)), 0);
        assertEq(initialTokenBalance - IERC20(token).balanceOf(BEANSTALK), 0);
        assertEq(initialInternalTokenBalance - bs.getInternalBalance(user, token), 1e6);
        assertEq(bs.getInternalBalance(address(100010), token), 1e6);

        vm.revertTo(snapshot);

        vm.prank(user);
        // verify the user is able to remove internal balances into their external balances.
        bs.transferToken(token, user, 1e6, 1, 0);
        assertEq(IERC20(token).balanceOf(user) - initialUserBalance, 1e6);
        assertEq(initialTokenBalance - IERC20(token).balanceOf(BEANSTALK), 1e6);
        assertEq(initialInternalTokenBalance - bs.getInternalBalance(user, token), 1e6);
    }

    // verifies that the user is able to migrate external beans to L2 and approve a receiver on L2.
    function test_bean_l2_migration_external() public {
        vm.startPrank(BS_FARMS);
        IERC20(BEAN).approve(BEANSTALK, 1e6);
        L2MigrationFacet(BEANSTALK).migrateL2Beans{value: 0.005 ether}(
            BS_FARMS,
            L2_BEANSTALK,
            1e6,
            LibTransfer.To.EXTERNAL,
            2e14, // max submission cost = 200k gas * 10 gwei
            200000, // 200k gas to execute on L2
            10e9 // @10 gwei
        );

        vm.startPrank(BS_FARMS);
        L2MigrationFacet(BEANSTALK).approveL2Receiver{value: 0.005 ether}(
            BS_FARMS,
            L2_BEANSTALK,
            2e14, // max submission cost = 200k gas * 10 gwei
            200000, // 200k gas to execute on L2
            10e9 // @10 gwei
        );
    }

    function test_bean_l2_migration_internal() public {
        vm.startPrank(BS_FARMS);
        IERC20(BEAN).approve(BEANSTALK, 1e6);
        L2MigrationFacet(BEANSTALK).migrateL2Beans{value: 0.005 ether}(
            BS_FARMS,
            L2_BEANSTALK,
            1e6,
            LibTransfer.To.INTERNAL,
            2e14, // max submission cost = 200k gas * 10 gwei
            200000, // 200k gas to execute on L2
            10e9 // @10 gwei
        );

        vm.startPrank(BS_FARMS);
        L2MigrationFacet(BEANSTALK).approveL2Receiver{value: 0.005 ether}(
            BS_FARMS,
            L2_BEANSTALK,
            2e14, // max submission cost = 200k gas * 10 gwei
            200000, // 200k gas to execute on L2
            10e9 // @10 gwei
        );
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
