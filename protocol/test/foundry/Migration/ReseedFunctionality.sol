// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import "forge-std/console.sol";
import {Deposit} from "contracts/beanstalk/storage/Account.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {IFertilizer} from "contracts/interfaces/IFertilizer.sol";
import "forge-std/StdUtils.sol";
import {BeanstalkPrice, WellPrice} from "contracts/ecosystem/price/BeanstalkPrice.sol";
import {P} from "contracts/ecosystem/price/P.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

interface IBeanstalkPrice {
    function price() external view returns (P.Prices memory p);
}

/**
 * @notice Verfifies state and functionality of the new L2 Beanstalk
 */
contract ReseedFunctionality is TestHelper {
    struct FertDepositData {
        uint256 fertId;
        uint256 amount;
        uint256 lastBpf;
    }

    // contracts for testing:
    address constant L2_BEANSTALK = address(0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70);
    address constant FERTILIZER = address(0xC59f881074Bf039352C227E21980317e6b969c8A);
    address constant BEANSTALK_PRICE = address(0xC218F5a782b0913931DCF502FA2aA959b36Ac9E7);

    uint256 constant FIELD_ID = 0;

    // bean tokens
    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

    address[] nonBeanTokens = [
        address(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1), // WETH
        address(0x5979D7b546E38E414F7E9822514be443A4800529), // WstETH
        address(0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe), // WEETH
        address(0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f), // WBTC
        address(0xaf88d065e77c8cC2239327C5EDb3A432268e5831), // USDC
        address(0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9) // USDT
    ];

    address[] whiteListedWellTokens = [
        address(0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB), // BEAN/WETH
        address(0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8), // BEAN/WstETH
        address(0xBEA00865405A02215B44eaADB853d0d2192Fc29D), // BEAN/WEETH
        address(0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA), // BEAN/WBTC
        address(0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279), // BEAN/USDC
        address(0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b) // BEAN/USDT
    ];

    address[] whitelistedTokens = [
        L2BEAN,
        L2URBEAN,
        L2URLP,
        address(0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB), // BEAN/WETH
        address(0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8), // BEAN/WstETH
        address(0xBEA00865405A02215B44eaADB853d0d2192Fc29D), // BEAN/WEETH
        address(0xBEA008aC57c2bEfe82E87d1D8Fb9f4784d0B73cA), // BEAN/WBTC
        address(0xBEA00dAf62D5549D265c5cA6D6BE87eF17881279), // BEAN/USDC
        address(0xBEA00bE150FEF7560A8ff3C68D07387693Ddfd0b) // BEAN/USDT
    ];

    IMockFBeanstalk l2Beanstalk;

    string constant HEX_PREFIX = "0x";

    string constant ACCOUNTS_PATH = "./test/foundry/Migration/data/accounts.txt";
    string constant FERT_ACCOUNTS_PATH = "./test/foundry/Migration/data/fert_accounts.txt";

    address constant DEFAULT_ACCOUNT = address(0xC5581F1aE61E34391824779D505Ca127a4566737);

    address constant realUser = 0xC2820F702Ef0fBd8842c5CE8A4FCAC5315593732;
    address constant beanWethWell = 0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB;
    address constant beanWstethWell = 0xBEA0093f626Ce32dd6dA19617ba4e7aA0c3228e8;

    uint256 accountNumber;

    function setUp() public {
        // parse accounts and populate the accounts.txt file
        // the number of accounts to parse, for testing purposes
        // the total number of accounts is 3665
        uint256 numAccounts = 10000;
        accountNumber = parseAccounts(numAccounts);
        console.log("Number of accounts: ", accountNumber);
        l2Beanstalk = IMockFBeanstalk(L2_BEANSTALK);
        // skip(100_000_000);
        // l2Beanstalk.gm(address(this), 1);
    }

    function test_Sunrise() public {
        // jump forward one hour in vm
        vm.warp(block.timestamp + 3600);
        console.log("calling sunrise");
        l2Beanstalk.sunrise();
    }

    function test_pipelineConvert() public {
        int96[] memory stems = new int96[](1);
        stems[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        // simply verify the function exists
        vm.expectRevert("Convert: Input token must be Bean or a well");
        l2Beanstalk.pipelineConvert(
            address(0),
            stems,
            amounts,
            address(0),
            new IMockFBeanstalk.AdvancedPipeCall[](0)
        );
    }

    function test_pipelineConvertRealUserLPToBean() public {
        address realUser = 0x0b8e605A7446801ae645e57de5AAbbc251cD1e3c; // first user in deposits with bean:weth
        address beanWethWell = 0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB;

        address token;
        int96 stem;
        uint256 amount;

        IMockFBeanstalk.TokenDepositId[] memory deposits = l2Beanstalk.getDepositsForAccount(
            realUser
        );
        for (uint256 i; i < deposits.length; i++) {
            if (deposits[i].token == address(beanWethWell)) {
                (token, stem) = l2Beanstalk.getAddressAndStem(deposits[i].depositIds[0]);
                amount = deposits[i].tokenDeposits[0].amount;
                break;
            }
        }

        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        IMockFBeanstalk.AdvancedPipeCall[] memory calls = createLPToBeanPipeCalls(
            amount,
            beanWethWell
        );

        // previously this would revert with "Well: Bean reserve is less than the minimum"
        vm.prank(realUser);
        l2Beanstalk.pipelineConvert(beanWethWell, stems, amounts, L2BEAN, calls);
    }

    function test_pipelineConvertLowLiquidity() public {
        address realUser = 0x0b8e605A7446801ae645e57de5AAbbc251cD1e3c; // first user in deposits with bean:weth
        address beanWethWell = 0xBEA00A3F7aaF99476862533Fe7DcA4b50f6158cB;
        address beanWeethWell = 0xBEA00865405A02215B44eaADB853d0d2192Fc29D;

        // add liquidity to beanWeethWell
        addLiquidityToWellArb(
            realUser,
            beanWeethWell,
            1e6, // 1 bean,
            0.001 ether // 0.001 weeth
        );

        address token;
        int96 stem;
        uint256 amount;

        IMockFBeanstalk.TokenDepositId[] memory deposits = l2Beanstalk.getDepositsForAccount(
            realUser
        );
        for (uint256 i; i < deposits.length; i++) {
            if (deposits[i].token == address(beanWethWell)) {
                (token, stem) = l2Beanstalk.getAddressAndStem(deposits[i].depositIds[0]);
                amount = deposits[i].tokenDeposits[0].amount;
                break;
            }
        }

        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        IMockFBeanstalk.AdvancedPipeCall[] memory calls = createLPToBeanPipeCalls(
            amount,
            beanWethWell
        );

        // previously this would revert with "Well: Bean reserve is less than the minimum"
        vm.prank(realUser);
        l2Beanstalk.pipelineConvert(beanWethWell, stems, amounts, L2BEAN, calls);
    }

    /**
     * @dev this test will fail once the user has withdrawn their LP tokens.
     * This can prevented by forking at an earlier block.
     */
    function test_pipelineConvertRealUserLPToLP() public {
        address token;
        int96 stem;
        uint256 amount;

        IMockFBeanstalk.TokenDepositId[] memory deposits = l2Beanstalk.getDepositsForAccount(
            realUser
        );
        for (uint256 i; i < deposits.length; i++) {
            if (deposits[i].token == address(beanWstethWell)) {
                (token, stem) = l2Beanstalk.getAddressAndStem(deposits[i].depositIds[0]);
                amount = deposits[i].tokenDeposits[0].amount;
                break;
            }
        }

        int96[] memory stems = new int96[](1);
        stems[0] = stem;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        IMockFBeanstalk.AdvancedPipeCall[] memory calls = createLPToLPPipeCalls(
            amount,
            beanWstethWell,
            beanWethWell
        );

        // previously this would revert with "Well: Bean reserve is less than the minimum"
        vm.prank(realUser);
        (
            int96 toStem,
            uint256 fromAmount,
            uint256 toAmount,
            uint256 fromBdv,
            uint256 toBdv
        ) = l2Beanstalk.pipelineConvert(beanWstethWell, stems, amounts, beanWethWell, calls);

        console.log("toStem: ");
        console.logInt(toStem);
        console.log("fromAmount: ", fromAmount);
        console.log("toAmount: ", toAmount);
        console.log("fromBdv: ", fromBdv);
        console.log("toBdv: ", toBdv);
    }

    function createLPToLPPipeCalls(
        uint256 amountOfLP,
        address inputWell,
        address outputWell
    ) private pure returns (IMockFBeanstalk.AdvancedPipeCall[] memory output) {
        // setup approve max call
        bytes memory approveEncoded = abi.encodeWithSelector(
            IERC20.approve.selector,
            outputWell,
            type(uint256).max
        );

        // encode remove liqudity.
        bytes memory removeLiquidityEncoded = abi.encodeWithSelector(
            IWell.removeLiquidityOneToken.selector,
            amountOfLP, // lpAmountIn
            L2BEAN, // tokenOut
            0, // min out
            PIPELINE, // recipient
            type(uint256).max // deadline
        );

        uint256[] memory emptyAmountsIn = new uint256[](2);

        // encode add liquidity
        bytes memory addLiquidityEncoded = abi.encodeWithSelector(
            IWell.addLiquidity.selector,
            emptyAmountsIn, // to be pasted in
            0, // min out
            PIPELINE, // recipient
            type(uint256).max // deadline
        );

        // Fabricate advancePipes:
        IMockFBeanstalk.AdvancedPipeCall[]
            memory advancedPipeCalls = new IMockFBeanstalk.AdvancedPipeCall[](3);

        // Action 0: approve the Bean-Eth well to spend pipeline's bean.
        advancedPipeCalls[0] = IMockFBeanstalk.AdvancedPipeCall(
            L2BEAN, // target
            approveEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // Action 1: remove beans from well.
        advancedPipeCalls[1] = IMockFBeanstalk.AdvancedPipeCall(
            inputWell, // target
            removeLiquidityEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // returnDataItemIndex, copyIndex, pasteIndex
        bytes memory clipboard = abi.encodePacked(
            bytes2(0x0100), // clipboard type 1
            uint80(1), // from result of call at index 1
            uint80(32), // take the first param
            uint80(196) // paste into the 6th 32 bytes of the clipboard
        );

        // Action 2: add beans to wsteth:bean well.
        advancedPipeCalls[2] = IMockFBeanstalk.AdvancedPipeCall(
            outputWell, // target
            addLiquidityEncoded, // calldata
            clipboard
        );

        return advancedPipeCalls;
    }

    function createLPToBeanPipeCalls(
        uint256 amountOfLP,
        address well
    ) private pure returns (IMockFBeanstalk.AdvancedPipeCall[] memory output) {
        // setup approve max call
        bytes memory approveEncoded = abi.encodeWithSelector(
            IERC20.approve.selector,
            well,
            type(uint256).max
        );

        uint256[] memory tokenAmountsIn = new uint256[](2);
        tokenAmountsIn[0] = amountOfLP;
        tokenAmountsIn[1] = 0;

        // encode remove liqudity.
        bytes memory removeLiquidityEncoded = abi.encodeWithSelector(
            IWell.removeLiquidityOneToken.selector,
            amountOfLP, // tokenAmountsIn
            L2BEAN, // tokenOut
            0, // min out
            PIPELINE, // recipient
            type(uint256).max // deadline
        );

        // Fabricate advancePipes:
        IMockFBeanstalk.AdvancedPipeCall[]
            memory advancedPipeCalls = new IMockFBeanstalk.AdvancedPipeCall[](2);

        // Action 0: approve the Bean-Eth well to spend pipeline's bean.
        advancedPipeCalls[0] = IMockFBeanstalk.AdvancedPipeCall(
            L2BEAN, // target
            approveEncoded, // calldata
            abi.encode(0) // clipboard
        );

        // Action 2: Remove One sided Liquidity into the well.
        advancedPipeCalls[1] = IMockFBeanstalk.AdvancedPipeCall(
            well, // target
            removeLiquidityEncoded, // calldata
            abi.encode(0) // clipboard
        );

        return advancedPipeCalls;
    }

    function addLiquidityToWellArb(
        address user,
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal returns (uint256 lpOut) {
        (address nonBeanToken, ) = l2Beanstalk.getNonBeanTokenAndIndexFromWell(well);

        if (runningOnFork()) {
            console.log("dealing tokens on fork");
            deal(address(L2BEAN), well, beanAmount, true);
            deal(address(nonBeanToken), well, nonBeanTokenAmount, true);
        } else {
            // mint and sync.
            MockToken(BEAN).mint(well, beanAmount);
            MockToken(nonBeanToken).mint(well, nonBeanTokenAmount);
        }

        lpOut = IWell(well).sync(user, 0);

        // sync again to update reserves.
        IWell(well).sync(user, 0);
    }

    // LibUsdOracle: 0x5003dF9E48dA96e4B4390373c8ae70EbFA5415A7
    function test_beanstalkPrice() public view {
        // Get beanstalk price
        IBeanstalkPrice beanstalkPrice = IBeanstalkPrice(BEANSTALK_PRICE);
        P.Prices memory prices = beanstalkPrice.price();
    }

    //////////////////// Account Deposits ////////////////////

    function test_AccountDeposits() public {
        vm.pauseGasMetering();

        uint256 totalStalkBefore = l2Beanstalk.totalStalk();
        assertGt(totalStalkBefore, 0, "stalk greater than zero before withdrawals");

        uint256 totalRootsBefore = l2Beanstalk.totalRoots();
        assertGt(totalRootsBefore, 0, "roots greater than zero before withdrawals");

        // verify ratio is 1:1 on reseed
        assertEq(
            totalStalkBefore * 1e12,
            totalRootsBefore,
            "stalk and roots equal ratio before withdrawals"
        );

        address[] memory tokens = l2Beanstalk.getWhitelistedTokens();

        // for every account
        for (uint256 i = 0; i < accountNumber; i++) {
            address account = vm.parseAddress(vm.readLine(ACCOUNTS_PATH));
            // get all deposits of all tokens --> order of whitelist
            IMockFBeanstalk.TokenDepositId[] memory accountDepositsStorage = l2Beanstalk
                .getDepositsForAccount(account);

            // for all tokens
            for (uint256 j = 0; j < accountDepositsStorage.length; j++) {
                // for all deposits --> if no deposits of a particular token, the for loop is skipped
                for (uint256 k = 0; k < accountDepositsStorage[j].depositIds.length; k++) {
                    (address token, int96 stem) = l2Beanstalk.getAddressAndStem(
                        accountDepositsStorage[j].depositIds[k]
                    );

                    // withdraw deposit
                    vm.prank(account);
                    l2Beanstalk.withdrawDeposit(
                        accountDepositsStorage[j].token,
                        stem,
                        accountDepositsStorage[j].tokenDeposits[k].amount,
                        0
                    );
                }
            }
        }

        uint256 totalStalk = l2Beanstalk.totalStalk();
        assertEq(totalStalk, 0, "total stalk not zero after withdrawals");

        uint256 totalRoots = l2Beanstalk.totalRoots();
        assertEq(totalRoots, 0, "total roots not zero after withdrawals");

        uint256 totalRainRoots = l2Beanstalk.totalRainRoots();
        assertEq(totalRainRoots, 0, "total rain roots not zero after withdrawals");

        uint256 getTotalBdv = l2Beanstalk.getTotalBdv();
        assertEq(getTotalBdv, 0, "total bdv not zero after withdrawals");

        uint256[] memory depositedAmounts = l2Beanstalk.getTotalSiloDeposited();
        for (uint256 i = 0; i < depositedAmounts.length; i++) {
            assertEq(
                depositedAmounts[i],
                0,
                "deposited amount of silo deposited not zero after withdrawals"
            );
        }

        uint256[] memory depositedBdvs = l2Beanstalk.getTotalSiloDepositedBdv();
        for (uint256 i = 0; i < depositedBdvs.length; i++) {
            assertEq(
                depositedBdvs[i],
                0,
                "deposited bdv of silo deposited not zero after withdrawals"
            );
        }

        // loop through whitelisted tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = whitelistedTokens[i];
            uint256 totalDeposited = l2Beanstalk.getTotalDeposited(token);
            assertEq(totalDeposited, 0, "total deposited of token not zero after withdrawals");
            uint256 totalDepositedBdv = l2Beanstalk.getTotalDepositedBdv(token);
            assertEq(
                totalDepositedBdv,
                0,
                "total deposited bdv of token not zero after withdrawals"
            );
        }
    }

    //////////////////// Helpers ////////////////////

    function parseAccounts(uint256 numAccounts) public returns (uint256) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/getAccounts.js"; // script
        inputs[2] = vm.toString(numAccounts);
        bytes memory res = vm.ffi(inputs);
        // decode the number of accounts
        uint256 accountNumber = vm.parseUint(vm.toString(res));
        return accountNumber;
    }

    function searchAccountDeposits(address account) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/depositFinder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20736200.json"; // json file
        inputs[3] = vm.toString(account);
        bytes memory accountDeposits = vm.ffi(inputs);
        return accountDeposits;
    }
}
