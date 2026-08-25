// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TestHelper, MockToken} from "test/foundry/utils/TestHelper.sol";
import {InitProtectedUnderlying} from "contracts/beanstalk/init/InitProtectedUnderlying.sol";
import {UnripeFacet} from "contracts/beanstalk/barn/UnripeFacet.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";

contract ProtectedUnderlyingTest is TestHelper {
    UnripeFacet internal unripeFacet = UnripeFacet(BEANSTALK);
    address internal underlyingLp;
    uint256 internal localUnderlying;
    uint256 internal protectedUnderlying;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        vm.startPrank(users[0]);
        MockToken(UNRIPE_LP).mint(users[0], 20_000_000e6);
        underlyingLp = bs.getUnderlyingToken(UNRIPE_LP);
        localUnderlying = addLiquidityToWell(underlyingLp, 2_000_000e6, 20_000 ether);
        MockToken(underlyingLp).approve(BEANSTALK, type(uint256).max);
        bs.addUnderlying(UNRIPE_LP, localUnderlying);
        vm.stopPrank();

        protectedUnderlying = (localUnderlying * 9) / 10;
    }

    function test_InitMovesBackingWithoutChangingClaimsOrLockedBeans() public {
        uint256 lockedBeansBefore = bs.getLockedBeansUnderlyingUnripeLP();
        uint256 holderUnderlyingBefore = bs.getUnderlying(UNRIPE_LP, 1e6);
        uint256 holderBdvBefore = bs.unripeLPToBDV(1e6);
        uint256 custodianBalanceBefore = MockToken(underlyingLp).balanceOf(users[1]);

        _protectUnderlying(protectedUnderlying);

        assertEq(unripeFacet.getProtectedUnderlying(UNRIPE_LP), protectedUnderlying);
        assertEq(bs.getTotalUnderlying(UNRIPE_LP), localUnderlying);
        assertEq(MockToken(underlyingLp).balanceOf(BEANSTALK), localUnderlying - protectedUnderlying);
        assertEq(MockToken(underlyingLp).balanceOf(users[1]), custodianBalanceBefore + protectedUnderlying);
        assertEq(unripeFacet.getProtectedUnderlyingCustodian(UNRIPE_LP), users[1]);
        assertEq(bs.getLockedBeansUnderlyingUnripeLP(), lockedBeansBefore);
        assertEq(bs.getUnderlying(UNRIPE_LP, 1e6), holderUnderlyingBefore);
        assertEq(bs.unripeLPToBDV(1e6), holderBdvBefore);
    }

    function test_RestoreMovesBackingToLocalWithoutChangingTotal() public {
        _protectUnderlying(protectedUnderlying);
        uint256 restoreAmount = protectedUnderlying / 3;

        vm.startPrank(users[1]);
        MockToken(underlyingLp).approve(BEANSTALK, restoreAmount);
        unripeFacet.restoreProtectedUnderlying(restoreAmount);
        vm.stopPrank();

        assertEq(unripeFacet.getProtectedUnderlying(UNRIPE_LP), protectedUnderlying - restoreAmount);
        assertEq(bs.getTotalUnderlying(UNRIPE_LP), localUnderlying);
        assertEq(MockToken(underlyingLp).balanceOf(BEANSTALK), localUnderlying - protectedUnderlying + restoreAmount);
    }

    function test_RestoreRejectsDiamondOwnerWhenOwnerIsNotCustodian() public {
        _protectUnderlying(protectedUnderlying);

        vm.prank(users[0]);
        vm.expectRevert("Unripe: Not protected custodian");
        unripeFacet.restoreProtectedUnderlying(1);
    }

    function test_RestoreRejectsOtherNonCustodian() public {
        _protectUnderlying(protectedUnderlying);

        vm.prank(users[2]);
        vm.expectRevert("Unripe: Not protected custodian");
        unripeFacet.restoreProtectedUnderlying(1);
    }

    function test_InitRejectsCustodianReplacement() public {
        _protectUnderlying(protectedUnderlying);
        InitProtectedUnderlying init = new InitProtectedUnderlying();
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](0);

        vm.prank(users[0]);
        vm.expectRevert("Init: Protected custodian mismatch");
        IDiamondCut(BEANSTALK)
            .diamondCut(cut, address(init), abi.encodeCall(init.init, (users[2], 1)));
    }

    function test_InitRejectsMoreThanLocalBacking() public {
        InitProtectedUnderlying init = new InitProtectedUnderlying();
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](0);

        vm.prank(users[0]);
        vm.expectRevert("Init: Insufficient local underlying");
        IDiamondCut(BEANSTALK)
            .diamondCut(cut, address(init), abi.encodeCall(init.init, (users[0], localUnderlying + 1)));
    }

    function testFuzz_ChopValueDependsOnTotalBackingNotCustodySplit(
        uint256 rawProtectedAmount,
        uint256 rawChopAmount,
        uint16 rawRecapBps
    ) public {
        uint256 supply = MockToken(UNRIPE_LP).totalSupply();
        uint256 chopAmount = bound(rawChopAmount, supply / 1_000, supply / 2);
        uint256 recapBps = bound(uint256(rawRecapBps), 1, 10_000);
        uint256 totalRecapDollarsNeeded = bs.getTotalRecapDollarsNeeded();

        bs.setPenaltyParams((totalRecapDollarsNeeded * recapBps) / 10_000, 0);

        vm.prank(users[0]);
        MockToken(UNRIPE_LP).approve(BEANSTALK, type(uint256).max);

        uint256 quoteBefore = bs.getPenalizedUnderlying(UNRIPE_LP, chopAmount);
        uint256 protectedAmount = bound(rawProtectedAmount, 1, localUnderlying - quoteBefore);

        uint256 snapshot = vm.snapshot();
        uint256 balanceBefore = MockToken(underlyingLp).balanceOf(users[0]);
        vm.prank(users[0]);
        uint256 payoutBefore = bs.chop(UNRIPE_LP, chopAmount, 0, 0);
        assertEq(payoutBefore, quoteBefore);
        assertEq(MockToken(underlyingLp).balanceOf(users[0]) - balanceBefore, quoteBefore);
        vm.revertTo(snapshot);

        _protectUnderlying(protectedAmount);

        uint256 quoteAfter = bs.getPenalizedUnderlying(UNRIPE_LP, chopAmount);
        assertEq(quoteAfter, quoteBefore);

        balanceBefore = MockToken(underlyingLp).balanceOf(users[0]);
        vm.prank(users[0]);
        uint256 payoutAfter = bs.chop(UNRIPE_LP, chopAmount, 0, 0);
        assertEq(payoutAfter, quoteBefore);
        assertEq(MockToken(underlyingLp).balanceOf(users[0]) - balanceBefore, quoteBefore);
    }

    function _protectUnderlying(uint256 amount) internal {
        InitProtectedUnderlying init = new InitProtectedUnderlying();
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](0);

        vm.prank(users[0]);
        IDiamondCut(BEANSTALK).diamondCut(cut, address(init), abi.encodeCall(init.init, (users[1], amount)));
    }
}
