// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C} from "test/foundry/utils/TestHelper.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {WhitelistFacet} from "contracts/beanstalk/silo/WhitelistFacet/WhitelistFacet.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {OracleFacet} from "contracts/beanstalk/sun/OracleFacet.sol";
import {LibChainlinkOracle} from "contracts/libraries/Oracle/LibChainlinkOracle.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {MockOracle} from "contracts/mocks/MockOracle.sol";
import {GaugePointFacet} from "contracts/beanstalk/sun/GaugePoints/GaugePointFacet.sol";
import {LiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";

contract MockWellToken {
    function tokens() public returns (IERC20[] memory) {
        IERC20[] memory _tokens = new IERC20[](2);
        _tokens[0] = IERC20(C.WETH);
        _tokens[1] = IERC20(C.WETH);
        return _tokens;
    }
}

/**
 * @notice Tests the functionality of whitelisting.
 */
contract WhitelistTest is TestHelper {
    // events
    event AddWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );
    /**
     * @notice Emitted when a token is added to the Silo Whitelist.
     * @param token ERC-20 token being added to the Silo Whitelist.
     * @param selector The function selector that returns the BDV of a given token.
     * @param stalkEarnedPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalkIssuedPerBdv The Stalk per BDV given from depositing `token`.
     * @param gaugePoints The gauge points of the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the oracle implementation for a token is updated.
     */
    event UpdatedOracleImplementationForToken(
        address indexed token,
        IMockFBeanstalk.Implementation oracleImplementation
    );

    /**
     * @notice Emitted when the gauge point implementation for a token is updated.
     */
    event UpdatedGaugePointImplementationForToken(
        address indexed token,
        IMockFBeanstalk.Implementation gpImplementation
    );

    /**
     * @notice Emitted when the liquidity weight implementation for a token is updated.
     */
    event UpdatedLiquidityWeightImplementationForToken(
        address indexed token,
        IMockFBeanstalk.Implementation lwImplementation
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
            bytes1(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0))
        );
    }

    function test_whitelistRevertInvalidgpImplementation(uint i) public prank(BEANSTALK) {
        bytes4 gpSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid GaugePoint Implementation");
        bs.whitelistToken(
            address(0),
            IMockFBeanstalk.beanToBDV.selector,
            0,
            0,
            bytes1(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), gpSelector, bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0))
        );
    }

    function test_whitelistRevertInvalidlwImplementation(uint i) public prank(BEANSTALK) {
        bytes4 gpSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 lwSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid LiquidityWeight Implementation");
        bs.whitelistToken(
            address(0),
            IMockFBeanstalk.beanToBDV.selector,
            0,
            0,
            bytes1(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), gpSelector, bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), lwSelector, bytes1(0), new bytes(0))
        );
    }

    function test_whitelistRevertInvalidOracleImplementation(uint i) public prank(BEANSTALK) {
        address token = address(new MockWellToken());
        bytes4 gpSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 lwSelector = IMockFBeanstalk.maxWeight.selector;
        bytes4 oSelector = bytes4(keccak256(abi.encode(i)));

        vm.expectRevert("Whitelist: Invalid Oracle Implementation");
        bs.whitelistToken(
            token,
            IMockFBeanstalk.wellBdv.selector,
            0,
            0,
            bytes1(0x01),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), oSelector, bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), gpSelector, bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), lwSelector, bytes1(0), new bytes(0))
        );
    }

    function test_whitelistRevertExistingWhitelistedToken() public prank(BEANSTALK) {
        bytes4 gpSelector = IMockFBeanstalk.defaultGaugePointFunction.selector;
        bytes4 lwSelector = IMockFBeanstalk.maxWeight.selector;

        vm.expectRevert("Whitelist: Token already whitelisted");
        bs.whitelistToken(
            BEAN,
            IMockFBeanstalk.beanToBDV.selector,
            0,
            0,
            bytes1(0),
            0,
            0,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0x01), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), gpSelector, bytes1(0), new bytes(0)),
            IMockFBeanstalk.Implementation(address(0), lwSelector, bytes1(0), new bytes(0))
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
        uint48 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) public prank(BEANSTALK) {
        address token = address(new MockWellToken());
        bytes4 bdvSelector = IMockFBeanstalk.wellBdv.selector;
        IMockFBeanstalk.Implementation memory oracleImplementation = IMockFBeanstalk.Implementation(
            address(ETH_USD_CHAINLINK_PRICE_AGGREGATOR),
            bytes4(0),
            bytes1(0x01),
            new bytes(0)
        );

        IMockFBeanstalk.Implementation memory gpImplementation = IMockFBeanstalk.Implementation(
            address(0),
            IMockFBeanstalk.defaultGaugePointFunction.selector,
            bytes1(0x01),
            new bytes(0)
        );

        IMockFBeanstalk.Implementation memory lwImplementation = IMockFBeanstalk.Implementation(
            address(0),
            IMockFBeanstalk.maxWeight.selector,
            bytes1(0x01),
            new bytes(0)
        );

        verifyWhitelistEvents(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gpImplementation,
            lwImplementation
        );

        bs.whitelistToken(
            token,
            bdvSelector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            bytes1(0),
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gpImplementation,
            lwImplementation
        );

        verifyWhitelistState(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gpImplementation.selector,
            lwImplementation.selector,
            gaugePoints,
            optimalPercentDepositedBdv,
            true,
            true,
            true
        );
    }

    function test_whitelistTokenWithExternalImplementation(
        uint32 stalkEarnedPerSeason,
        uint48 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) public prank(BEANSTALK) {
        address token = address(new MockWellToken());
        bytes4 bdvSelector = IMockFBeanstalk.wellBdv.selector;

        // deploy mock Oracle:
        IMockFBeanstalk.Implementation memory oracleImplementation = IMockFBeanstalk.Implementation(
            address(new MockOracle(1e6, 1e6)),
            MockOracle.getPrice.selector,
            bytes1(0),
            new bytes(0)
        );

        IMockFBeanstalk.Implementation memory gpImplementation = IMockFBeanstalk.Implementation(
            address(new GaugePointFacet()),
            GaugePointFacet.defaultGaugePointFunction.selector,
            bytes1(0),
            new bytes(0)
        );

        IMockFBeanstalk.Implementation memory lwImplementation = IMockFBeanstalk.Implementation(
            address(new LiquidityWeightFacet()),
            LiquidityWeightFacet.maxWeight.selector,
            bytes1(0),
            new bytes(0)
        );

        verifyWhitelistEvents(
            token,
            bdvSelector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gpImplementation,
            lwImplementation
        );
        bs.whitelistToken(
            token,
            bdvSelector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            0x01,
            gaugePoints,
            optimalPercentDepositedBdv,
            oracleImplementation,
            gpImplementation,
            lwImplementation
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

        verifyWhitelistState(token, 0, 1, 1e10, 0, 0, 0, 0, false, false, false);
        // verify that the milestone stem and season are updated and are kept, as
        // existing deposits are still valid.
        IMockFBeanstalk.AssetSettings memory newSS = bs.tokenSettings(token);
        assertEq(int256(newSS.milestoneStem), bs.stemTipForToken(token));
        assertEq(uint256(newSS.milestoneSeason), season);
    }

    function verifyWhitelistEvents(
        address token,
        bytes4 bdvSelector,
        uint32 stalkEarnedPerSeason,
        uint48 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        IMockFBeanstalk.Implementation memory oracleImplementation,
        IMockFBeanstalk.Implementation memory gpImplementation,
        IMockFBeanstalk.Implementation memory lwImplementation
    ) public {
        (address _token, ) = bs.getNonBeanTokenAndIndexFromWell(token);
        vm.expectEmit();
        emit AddWhitelistStatus(token, 5, true, true, true, true);
        vm.expectEmit();
        emit UpdatedOracleImplementationForToken(_token, oracleImplementation);
        vm.expectEmit();
        emit WhitelistToken(
            token,
            bdvSelector,
            stalkEarnedPerSeason == 0 ? 1 : stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePoints,
            optimalPercentDepositedBdv
        );
        vm.expectEmit();
        emit UpdatedGaugePointImplementationForToken(token, gpImplementation);
        vm.expectEmit();
        emit UpdatedLiquidityWeightImplementationForToken(token, lwImplementation);
    }

    function verifyWhitelistState(
        address token,
        bytes4 bdvSelector,
        uint32 stalkEarnedPerSeason,
        uint48 stalkIssuedPerBdv,
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
