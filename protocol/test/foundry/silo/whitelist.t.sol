// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {WhitelistFacet} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistFacet.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {OracleFacet} from "contracts/beanstalk/sun/OracleFacet.sol";

/**
 * @notice Tests the functionality of whitelisting.
 */
contract WhitelistTest is TestHelper {
    address constant wBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    // events
    event AddWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );
    event DewhitelistToken(address indexed token);

    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    // reverts if not owner.
    function test_whitelistRevertOwner(uint i) public {
        vm.prank(address(bytes20(keccak256(abi.encode(i)))));
        vm.expectRevert("LibDiamond: Must be contract or owner");
        bs.whitelistToken(
            address(0),
            bytes4(0),
            0,
            0,
            bytes4(0),
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        vm.expectRevert("LibDiamond: Must be contract or owner");
        bs.whitelistTokenWithEncodeType(
            address(0),
            bytes4(0),
            0,
            0,
            bytes1(0),
            bytes4(0),
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );
    }

    // reverts with invalid BDV selector.
    function test_whitelistRevertInvalidBDVSelector(uint i) public prank(BEANSTALK) {
        bytes4 bdvSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid BDV selector");
        bs.whitelistToken(
            address(0),
            bdvSelector,
            0,
            0,
            bytes4(0),
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        vm.expectRevert("Whitelist: Invalid BDV selector");
        bs.whitelistTokenWithEncodeType(
            address(0),
            bdvSelector,
            0,
            0,
            bytes1(0x01),
            bytes4(0),
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );
    }

    function test_whitelistRevertInvalidGaugePointSelector(uint i) public prank(BEANSTALK) {
        bytes4 bdvSelector = IMockFBeanstalk.beanToBDV.selector;
        bytes4 gaugePointSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid GaugePoint selector");
        bs.whitelistToken(
            address(0),
            bdvSelector,
            0,
            0,
            gaugePointSelector,
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        vm.expectRevert("Whitelist: Invalid GaugePoint selector");
        bs.whitelistTokenWithEncodeType(
            address(0),
            bdvSelector,
            0,
            0,
            bytes1(0),
            gaugePointSelector,
            bytes4(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );
    }

    function test_whitelistRevertInvalidLiquidityWeightSelector(uint i) public prank(BEANSTALK) {
        bytes4 bdvSelector = IMockFBeanstalk.beanToBDV.selector;
        bytes4 gaugePointSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 liquidityWeightSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid LiquidityWeight selector");
        bs.whitelistToken(
            address(0),
            bdvSelector,
            0,
            0,
            gaugePointSelector,
            liquidityWeightSelector,
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        vm.expectRevert("Whitelist: Invalid LiquidityWeight selector");
        bs.whitelistTokenWithEncodeType(
            address(0),
            bdvSelector,
            0,
            0,
            bytes1(0),
            gaugePointSelector,
            liquidityWeightSelector,
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );
    }

    function test_whitelistRevertExistingWhitelistedToken() public prank(BEANSTALK) {
        bytes4 bdvSelector = IMockFBeanstalk.beanToBDV.selector;
        bytes4 gaugePointSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 liquidityWeightSelector = IMockFBeanstalk.maxWeight.selector;
        address token = address(C.bean());

        vm.expectRevert("Whitelist: Token already whitelisted");
        bs.whitelistToken(
            token,
            bdvSelector,
            0,
            0,
            gaugePointSelector,
            liquidityWeightSelector,
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        vm.expectRevert("Whitelist: Token already whitelisted");
        bs.whitelistTokenWithEncodeType(
            token,
            bdvSelector,
            0,
            0,
            bytes1(0),
            gaugePointSelector,
            liquidityWeightSelector,
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );
    }

    //// WHITELIST ////
    // Theorically, a number of tokens that may be used within the beanstalk system can be whitelisted.
    // However, this is not enforced on the contract level and thus is not tested here.
    // For example, the contract assumes further silo whitelisted assets will be an LP token.

    /**
     * @notice validates general whitelist functionality.
     */
    function test_whitelistTokenBasic(
        uint32 stalkEarnedPerSeason,
        uint32 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) public prank(BEANSTALK) {
        address token = address(new MockToken("Mock Token", "MTK"));
        bytes4 bdvSelector = IMockFBeanstalk.beanToBDV.selector;
        bytes4 gaugePointSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 liquidityWeightSelector = IMockFBeanstalk.maxWeight.selector;

        vm.expectEmit();
        emit AddWhitelistStatus(token, 5, true, true, false, false);
        vm.expectEmit();
        emit WhitelistToken(
            token,
            bdvSelector,
            stalkEarnedPerSeason == 0 ? 1 : stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
        bs.whitelistToken(
            token,
            bdvSelector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        verifyWhitelistState(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            true,
            true,
            false
        );
    }

    /**
     * @notice validates general whitelist functionality.
     */
    function test_whitelistTokenWithEncodeType(
        uint32 stalkEarnedPerSeason,
        uint32 stalkIssuedPerBdv,
        uint8 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) public prank(BEANSTALK) {
        address token = address(new MockToken("Mock Token", "MTK"));
        bytes4 bdvSelector = IMockFBeanstalk.beanToBDV.selector;
        bytes4 gaugePointSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 liquidityWeightSelector = IMockFBeanstalk.maxWeight.selector;
        encodeType = encodeType % 2; // 0 or 1
        verifyWhitelistEvents(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            false
        );
        bs.whitelistTokenWithEncodeType(
            token,
            bdvSelector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            bytes1(encodeType),
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0))
        );

        verifyWhitelistState(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv,
            true,
            true,
            false
        );
    }

    /**
     * @notice validates general dewhitelist functionality.
     */
    function test_dewhitelist(uint256 i, uint256 season) public prank(BEANSTALK) {
        season = bound(season, 1, type(uint32).max);
        bs.teleportSunrise(uint32(season));
        address[] memory tokens = bs.getWhitelistedTokens();
        i = bound(i, 0, tokens.length - 1);
        address token = tokens[i];
        // initial milestone stem and season
        IMockFBeanstalk.AssetSettings memory ss = bs.tokenSettings(token);

        vm.expectEmit();
        emit DewhitelistToken(token);
        bs.dewhitelistToken(token);

        verifyWhitelistState(token, 0, 1, 10000, 0, 0, 0, 0, false, false, false);
        // verify that the milestone stem and season are updated and are kept, as
        // existing deposits are still valid.
        IMockFBeanstalk.AssetSettings memory newSS = bs.tokenSettings(token);
        assertEq(int256(newSS.milestoneStem), bs.stemTipForToken(token));
        assertEq(uint256(newSS.milestoneSeason), season);
    }

    function test_whitelistTokenWithExternalImplementation(
        uint32 stalkEarnedPerSeason,
        uint32 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) public prank(BEANSTALK) {
        address token = address(new MockToken("Mock Token", "MTK"));
        bytes4 liquidityWeightSelector = IMockFBeanstalk.maxWeight.selector;
        bytes1 encodeType = 0x01;

        IMockFBeanstalk.Implementation memory oracleImplementation = IMockFBeanstalk.Implementation(
            address(0),
            bytes4(0),
            bytes1(0)
        );

        IMockFBeanstalk.Implementation memory gaugePointImplementation = IMockFBeanstalk
            .Implementation(
                address(0),
                IMockFBeanstalk.defaultGaugePointFunction.selector,
                bytes1(0)
            );

        IMockFBeanstalk.Implementation memory liquidityWeightImplementation = IMockFBeanstalk
            .Implementation(address(0), liquidityWeightSelector, bytes1(0));

        verifyWhitelistEvents(
            token,
            IMockFBeanstalk.beanToBDV.selector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            bytes4(0),
            bytes4(0),
            gaugePoints,
            optimalPercentDepositedBdv,
            false
        );
        bs.whitelistTokenWithExternalImplementation(
            token,
            IMockFBeanstalk.beanToBDV.selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            encodeType,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gaugePointImplementation,
            liquidityWeightImplementation
        );
    }

    function verifyWhitelistEvents(
        address token,
        bytes4 bdvSelector,
        uint32 stalkEarnedPerSeason,
        uint32 stalkIssuedPerBdv,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        bool isSoppable
    ) public {
        vm.expectEmit();
        emit AddWhitelistStatus(token, 5, true, true, false, isSoppable);
        vm.expectEmit();
        emit WhitelistToken(
            token,
            bdvSelector,
            stalkEarnedPerSeason == 0 ? 1 : stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
    }

    function verifyWhitelistState(
        address token,
        bytes4 bdvSelector,
        uint32 stalkEarnedPerSeason,
        uint32 stalkIssuedPerBdv,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell
    ) internal view {
        IMockFBeanstalk.AssetSettings memory ss = bs.tokenSettings(token);
        assertEq(ss.selector, bdvSelector);
        assertEq(uint256(ss.stalkIssuedPerBdv), stalkIssuedPerBdv);
        assertEq(
            uint256(ss.stalkEarnedPerSeason),
            stalkEarnedPerSeason == 0 ? 1 : stalkEarnedPerSeason
        );
        assertEq(uint256(ss.stalkIssuedPerBdv), stalkIssuedPerBdv);
        assertEq(ss.gaugePointImplementation.selector, gaugePointSelector);
        assertEq(ss.liquidityWeightImplementation.selector, liquidityWeightSelector);
        assertEq(uint256(ss.gaugePoints), gaugePoints);
        assertEq(uint256(ss.optimalPercentDepositedBdv), optimalPercentDepositedBdv);

        IMockFBeanstalk.WhitelistStatus memory ws = bs.getWhitelistStatus(token);
        assertEq(ws.token, token);
        assertEq(ws.isWhitelisted, isWhitelisted);
        assertEq(ws.isWhitelistedLp, isWhitelistedLp);
        assertEq(ws.isWhitelistedWell, isWhitelistedWell);
    }
}
