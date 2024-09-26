// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TestHelper, C, LibTransfer} from "test/foundry/utils/TestHelper.sol";

import {MockToken} from "contracts/mocks/MockToken.sol";
import {TokenFacet} from "contracts/beanstalk/farm/TokenFacet.sol";
import {SiloFacet} from "contracts/beanstalk/silo/SiloFacet/SiloFacet.sol";
import {PipeCall} from "contracts/interfaces/IPipeline.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {DepotFacet} from "contracts/beanstalk/farm/DepotFacet.sol";

/**
 * @notice Tests the functionality of Farm call sequences.
 */
contract FarmTest is TestHelper {
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, true);
        MockToken(C.WETH).mint(BEANSTALK, 100_000);

        farmers = createUsers(2);
        mintTokensToUsers(farmers, BEAN, 100_000e6);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            BEAN_ETH_WELL,
            10_000_000e6, // 10,000,000 Beans
            10_000 ether // 10,000 ether.
        );
    }

    /**
     * @notice Revert on bad Farm calls.
     */
    function test_farmRevert(uint256 theftAmount) public {
        bytes[] memory farmCalls = new bytes[](1);

        // Revert if invalid function.
        farmCalls[0] = bytes("0x696969");
        vm.expectRevert("Diamond: Function does not exist");
        vm.prank(farmers[0]);
        bs.farm(farmCalls);

        // Revert if function itself reverts.
        farmCalls[0] = abi.encode(TokenFacet.wrapEth.selector);
        vm.expectRevert();
        vm.prank(farmers[0]);
        bs.farm(farmCalls);
    }

    /**
     * @notice Tranfer token to internal balance then deposit from internal balance.
     */
    function test_farmTransferAndDeposit() public {
        bytes[] memory farmCalls = new bytes[](2);

        farmCalls[0] = abi.encodeWithSelector(
            TokenFacet.transferToken.selector,
            BEAN,
            farmers[0],
            100e6,
            LibTransfer.From.EXTERNAL,
            LibTransfer.To.INTERNAL
        );
        farmCalls[1] = abi.encodeWithSelector(
            SiloFacet.deposit.selector,
            BEAN,
            50e6,
            LibTransfer.From.INTERNAL
        );

        vm.prank(farmers[0]);
        bs.farm(farmCalls);

        assertEq(bs.getInternalBalance(farmers[0], BEAN), 50e6);
    }

    /**
     * @notice Wraps ETH, sends to Pipeline, then calls Well swap through Pipeline.
     */
    function test_farmWrapAndExchange() public {
        uint256 farmerInitialBeans = IERC20(BEAN).balanceOf(farmers[0]);

        bytes[] memory farmCalls = new bytes[](3);

        farmCalls[0] = abi.encodeWithSelector(
            TokenFacet.wrapEth.selector,
            1e18,
            LibTransfer.To.INTERNAL
        );

        farmCalls[1] = abi.encodeWithSelector(
            TokenFacet.transferToken.selector,
            C.WETH,
            C.PIPELINE,
            1e18,
            LibTransfer.From.INTERNAL,
            LibTransfer.To.EXTERNAL
        );

        PipeCall memory pipeCall = PipeCall(
            BEAN_ETH_WELL,
            abi.encodeWithSelector(
                IWell.swapFrom.selector,
                C.WETH,
                BEAN,
                1e18,
                0,
                farmers[0],
                type(uint256).max
            )
        );
        farmCalls[2] = abi.encodeWithSelector(DepotFacet.pipe.selector, pipeCall);

        deal(farmers[0], 1e18);
        vm.prank(C.PIPELINE);
        IERC20(C.WETH).approve(BEAN_ETH_WELL, type(uint256).max);

        vm.prank(farmers[0]);
        bs.farm{value: 1e18}(farmCalls);

        assertGt(IERC20(BEAN).balanceOf(farmers[0]), farmerInitialBeans);
    }
}
