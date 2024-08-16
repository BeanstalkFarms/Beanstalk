// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TestHelper, C, LibTransfer} from "test/foundry/utils/TestHelper.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibClipboard} from "contracts/libraries/LibClipboard.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {PipeCall} from "contracts/interfaces/IPipeline.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {TokenFacet} from "contracts/beanstalk/farm/TokenFacet.sol";
import {SiloFacet} from "contracts/beanstalk/silo/SiloFacet/SiloFacet.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {DepotFacet} from "contracts/beanstalk/farm/DepotFacet.sol";

/**
 * @notice Tests the functionality of AdvancedFarm call sequences.
 */
contract AdvancedFarmTest is TestHelper {
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, false, true);
        MockToken(C.WETH).mint(address(bs), 100_000);

        farmers = createUsers(2);
        mintTokensToUsers(farmers, C.BEAN, 100_000e6);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            C.BEAN_ETH_WELL,
            10_000_000e6, // 10,000,000 Beans
            10_000 ether // 10,000 ether.
        );
    }

    /**
     * @notice Wrap eth, add liquidity from weth, deposit LP into Silo.
     */
    function test_farmAddLiquidityDeposit() public {
        IERC20(C.WETH).approve(C.BEAN_ETH_WELL, type(uint256).max);

        // advancedFarmCall[0], wrap eth.
        IMockFBeanstalk.AdvancedFarmCall memory wrapEth = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(TokenFacet.wrapEth.selector, 1e18, LibTransfer.To.INTERNAL),
            abi.encode("")
        );

        // advancedFarmCall[1], load depot.
        IMockFBeanstalk.AdvancedFarmCall memory loadDepot = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(
                TokenFacet.transferToken.selector,
                C.WETH,
                C.PIPELINE,
                1e18,
                LibTransfer.From.INTERNAL,
                LibTransfer.To.EXTERNAL
            ),
            abi.encode("")
        );

        // advancedFarmCall[2], add liquidity.
        uint256[] memory assetInAmounts = new uint256[](2);
        assetInAmounts[1] = 1e18;
        PipeCall memory AddLpPipeCall = PipeCall(
            C.BEAN_ETH_WELL,
            abi.encodeWithSelector(
                IWell.addLiquidity.selector,
                assetInAmounts,
                0,
                farmers[0],
                type(uint256).max
            )
        ); // lpAmountOut
        IMockFBeanstalk.AdvancedFarmCall memory addLiquidity = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(DepotFacet.pipe.selector, AddLpPipeCall),
            abi.encode("")
        );

        // advancedFarmCall[3], deposit exact LP tokens.
        bytes32[] memory pasteParams = new bytes32[](1);
        // Copy return of previous call and paste into the amount.
        pasteParams[0] = LibBytes.encode(uint80(2), uint80(96), uint80(68)); // Copy data index, copy index, paste index
        IMockFBeanstalk.AdvancedFarmCall memory depositLp = IMockFBeanstalk.AdvancedFarmCall(
            abi.encodeWithSelector(
                SiloFacet.deposit.selector,
                C.BEAN_ETH_WELL,
                0,
                LibTransfer.From.EXTERNAL
            ),
            LibClipboard.encode(0, pasteParams)
        );

        IMockFBeanstalk.AdvancedFarmCall[]
            memory farmCalls = new IMockFBeanstalk.AdvancedFarmCall[](4);
        farmCalls[0] = wrapEth;
        farmCalls[1] = loadDepot;
        farmCalls[2] = addLiquidity;
        farmCalls[3] = depositLp;

        // Simplify by setting up approvals.
        deal(farmers[0], 1e18);
        vm.prank(C.PIPELINE);
        IERC20(C.WETH).approve(C.BEAN_ETH_WELL, type(uint256).max);
        vm.prank(farmers[0]);
        IERC20(C.BEAN_ETH_WELL).approve(address(bs), type(uint256).max);

        vm.prank(farmers[0]);
        bytes[] memory results = bs.advancedFarm{value: 1e18}(farmCalls);
        bytes memory depositResult = results[3];
        (uint256 amount, uint256 _bdv, int96 stem) = abi.decode(
            depositResult,
            (uint256, uint256, int96)
        );

        assertEq(amount, 15810993035897375810, "Incorrect amount of LP tokens deposited");
    }
}
