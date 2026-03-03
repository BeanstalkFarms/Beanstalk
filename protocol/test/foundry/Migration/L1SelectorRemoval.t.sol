// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IDiamondCut {
    struct FacetCut {
        address facetAddress;
        uint8 action;
        bytes4[] functionSelectors;
    }

    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;
}

interface IDiamondLoupe {
    function facetAddress(bytes4 _functionSelector) external view returns (address);
}

interface IBeanstalk {
    function transferToken(
        address token,
        address recipient,
        uint256 amount,
        uint8 fromMode,
        uint8 toMode
    ) external payable;

    function transferInternalTokenFrom(
        address token,
        address sender,
        address recipient,
        uint256 amount,
        uint8 toMode
    ) external payable;

    function getInternalBalance(address account, address token) external view returns (uint256);

    function owner() external view returns (address);
}

/**
 * @notice EBIP-22: Remove transferInternalTokenFrom selector from L1 Diamond.
 * @dev Run with:
 *   cd protocol
 *   ETH_RPC_URL=<ethereum-mainnet-rpc> FOUNDRY_PROFILE=l1fork forge test \
 *     --match-path test/foundry/Migration/L1SelectorRemoval.t.sol -vv
 */
contract L1SelectorRemovalTest is Test {
    address private constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;
    address private constant BEAN = 0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab;
    uint8 private constant FROM_INTERNAL = 1;
    uint8 private constant TO_EXTERNAL = 0;
    uint8 private constant TO_INTERNAL = 1;
    uint256 private constant FORK_BLOCK = 24_547_453;

    address private constant HOLDER = 0xaa75c70b7ce3A00cdFa1Bf401756bdf5C70889Cc;

    bytes4 private constant SELECTOR_TRANSFER_INTERNAL_TOKEN_FROM = 0xd3f4ec6f;

    function setUp() external {
        uint256 forkId = vm.createFork(vm.envString("ETH_RPC_URL"), FORK_BLOCK);
        vm.selectFork(forkId);
    }

    /**
     * @notice Execute the EBIP-22 diamond cut: remove transferInternalTokenFrom selector.
     */
    function _executeDiamondCut() internal {
        address owner = IBeanstalk(BEANSTALK).owner();

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = SELECTOR_TRANSFER_INTERNAL_TOKEN_FROM;

        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: 2, // Remove
            functionSelectors: selectors
        });

        vm.prank(owner);
        IDiamondCut(BEANSTALK).diamondCut(cut, address(0), "");
    }

    /**
     * @notice Verify that transferInternalTokenFrom is callable BEFORE the fix
     *         and reverts AFTER the diamond cut.
     */
    function test_TransferInternalTokenFromRevertsAfterFix() external {
        IBeanstalk beanstalk = IBeanstalk(BEANSTALK);

        uint256 internalBefore = beanstalk.getInternalBalance(HOLDER, BEAN);
        assertGt(internalBefore, 0, "precondition: HOLDER has no internal BEAN");

        uint256 amount = 1e6;
        if (amount > internalBefore) amount = internalBefore;

        // Before fix: transferInternalTokenFrom succeeds.
        vm.prank(HOLDER);
        beanstalk.transferInternalTokenFrom(BEAN, HOLDER, address(0xBEEF), amount, TO_EXTERNAL);
        assertEq(IERC20(BEAN).balanceOf(address(0xBEEF)), amount, "before fix: bypass works");

        _executeDiamondCut();

        // After fix: transferInternalTokenFrom reverts (selector removed from Diamond).
        vm.prank(HOLDER);
        vm.expectRevert();
        beanstalk.transferInternalTokenFrom(BEAN, HOLDER, address(0xBEEF), amount, TO_EXTERNAL);
    }

    /**
     * @notice Verify that the selector is removed from the Diamond loupe.
     */
    function test_SelectorRemovedFromLoupe() external {
        // Before: selector is mapped to a facet.
        address facetBefore = IDiamondLoupe(BEANSTALK).facetAddress(SELECTOR_TRANSFER_INTERNAL_TOKEN_FROM);
        assertTrue(facetBefore != address(0), "precondition: selector should exist");

        _executeDiamondCut();

        // After: selector maps to address(0).
        address facetAfter = IDiamondLoupe(BEANSTALK).facetAddress(SELECTOR_TRANSFER_INTERNAL_TOKEN_FROM);
        assertEq(facetAfter, address(0), "selector should be removed");
    }

    /**
     * @notice Verify that other L1TokenFacet functions still work after the fix.
     */
    function test_OtherFunctionsStillWorkAfterFix() external {
        IBeanstalk beanstalk = IBeanstalk(BEANSTALK);

        _executeDiamondCut();

        // getInternalBalance should still work.
        uint256 balance = beanstalk.getInternalBalance(HOLDER, BEAN);
        assertGt(balance, 0, "getInternalBalance should work");

        // transferToken should still revert with checkBeanAsset for BEAN.
        vm.prank(HOLDER);
        vm.expectRevert(bytes("TokenFacet: Beans cannot be transferred."));
        beanstalk.transferToken(BEAN, HOLDER, 1e6, FROM_INTERNAL, TO_EXTERNAL);

        // owner() should still work.
        address owner = beanstalk.owner();
        assertTrue(owner != address(0), "owner should work");
    }
}
