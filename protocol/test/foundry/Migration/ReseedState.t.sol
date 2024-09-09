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
import "forge-std/StdUtils.sol";
import {BeanstalkPrice, WellPrice} from "contracts/ecosystem/price/BeanstalkPrice.sol";
import {P} from "contracts/ecosystem/price/P.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";

interface IBeanstalkPrice {
    function price() external view returns (P.Prices memory p);
}

/**
 * @notice Verfifies state and functionality of the new L2 Beanstalk
 */
contract ReseedStateTest is TestHelper {
    // contracts for testing:
    address constant L2_BEANSTALK = address(0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70);
    address constant L2_DEPLOYER = address(0xE26367ca850DA09A478076481535D7c1C67d62F8);
    address constant FERTILIZER = address(0xC59f881074Bf039352C227E21980317e6b969c8A);
    address constant BEANSTALK_PRICE = address(0xEfE94bE746681ed73DfD15F932f9a8e8ffDdEE56);

    uint256 constant FIELD_ID = 0;

    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

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

    address constant DEFAULT_ACCOUNT = address(0xC5581F1aE61E34391824779D505Ca127a4566737);

    uint256 accountNumber;

    function setUp() public {
        // parse accounts and populate the accounts.txt file
        // the number of accounts to parse, for testing purposes
        uint256 numAccounts = 10;
        accountNumber = parseAccounts(numAccounts);
        console.log("Number of accounts: ", accountNumber);
        l2Beanstalk = IMockFBeanstalk(L2_BEANSTALK);
        // skip(100_000_000);
        // console.log("Current timestamp before sunrise: ", block.timestamp);
        // l2Beanstalk.gm(address(this), 1);
        // console.log("Current timestamp after sunrise: ", block.timestamp);

        // swapInWell(whiteListedWellTokens[0], address(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1));
        // swapInWell(whiteListedWellTokens[0], address(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1));
        // console.log("Current timestamp: ", block.timestamp);
        // skip(1000);
        // l2Beanstalk.gm(address(this), 1);
        // skip(1000);
    }

    function test_gm() public {
        // perform a gm
        skip(100_000_000);
        l2Beanstalk.gm(address(this), 1);
        skip(1000);
        l2Beanstalk.gm(address(this), 1);
    }

    // LibUsdOracle: 0x5003dF9E48dA96e4B4390373c8ae70EbFA5415A7
    // function test_beanstalkPrice() public {
    //     // Get beanstalk price
    //     IBeanstalkPrice beanstalkPrice = IBeanstalkPrice(BEANSTALK_PRICE);
    //     P.Prices memory prices = beanstalkPrice.price();
    // }

    function test_bdvs() public {
        // get the bdv for all whitelisted tokens
        for (uint256 i = 0; i < whitelistedTokens.length; i++) {
            uint256 bdv = l2Beanstalk.bdv(whitelistedTokens[i], 1e18);
            console.log("BDV for token: ", whitelistedTokens[i], " is: ", bdv);
        }
    }

    function test_largestLiqWell() public {
        // get the largest liquidity well
        console.log("//////////////////////////////////////////////////////");
        console.log("Current timestamp before largest liq well: ", block.timestamp);
        skip(1000);
        address largestLiqWell = l2Beanstalk.getLargestLiqWell();
        console.log("Largest liquidity well: ", largestLiqWell);
    }

    function test_getL2SR() public {
        // get the largest liquidity well
        uint256 l2sr = l2Beanstalk.getLiquidityToSupplyRatio();
        console.log("L2SR: ", l2sr);
    }

    ////////////////// WhiteListed Tokens //////////////////

    function test_whiteListedTokens() public {
        // all whitelisted tokens
        address[] memory tokens = l2Beanstalk.getWhitelistedTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            assertEq(tokens[i], whitelistedTokens[i]);
        }
        // all whitelisted lp tokens
        address[] memory whitelistedLpTokens = l2Beanstalk.getWhitelistedLpTokens();
        for (uint256 i = 0; i < whitelistedLpTokens.length; i++) {
            assertEq(whitelistedLpTokens[i], whiteListedWellTokens[i]);
        }
        // all whitelisted well lp tokens (should be the same)
        address[] memory whitelistedWellLpTokens = l2Beanstalk.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < whitelistedWellLpTokens.length; i++) {
            assertEq(whitelistedWellLpTokens[i], whiteListedWellTokens[i]);
        }
    }

    //////////////////// Global State Silo ////////////////////

    function test_totalStalk() public {
        uint256 totalStalk = l2Beanstalk.totalStalk();
        bytes memory totalStalkJson = searchGlobalPropertyData("silo.stalk");
        // decode the stalk from json
        uint256 totalStalkJsonDecoded = vm.parseUint(vm.toString(totalStalkJson));
        assertEq(totalStalk, totalStalkJsonDecoded);
    }

    function test_totalEarnedBeans() public {
        bytes memory earnedBeansJson = searchGlobalPropertyData("silo.earnedBeans");
        uint256 earnedBeans = l2Beanstalk.totalEarnedBeans();
        // decode the earnedBeans from json
        uint256 earnedBeansJsonDecoded = vm.parseUint(vm.toString(earnedBeansJson));
        assertEq(earnedBeans, earnedBeansJsonDecoded);
    }

    function test_totalRoots() public {
        uint256 roots = l2Beanstalk.totalRoots();
        bytes memory rootsJson = searchGlobalPropertyData("silo.roots");
        // decode the roots from json
        uint256 rootsJsonDecoded = vm.parseUint(vm.toString(rootsJson));
        assertEq(roots, rootsJsonDecoded);
    }

    //////////////////// Global State Season ////////////////////

    function test_seasonNumber() public {
        uint32 season = l2Beanstalk.season();
        bytes memory seasonJson = searchGlobalPropertyData("season.current");
        // decode the season from json
        uint32 seasonJsonDecoded = uint32(vm.parseUint(vm.toString(seasonJson)));
        assertEq(season, seasonJsonDecoded);
    }

    //////////////////// Global State Field ////////////////////

    function test_maxTemperature() public {
        uint256 maxTemperature = l2Beanstalk.maxTemperature();
        bytes memory maxTemperatureJson = searchGlobalPropertyData("weather.temp");
        // decode the maxTemperature from json
        uint256 maxTemperatureJsonDecoded = vm.parseUint(vm.toString(maxTemperatureJson));
        // add precision to the temperaturejson to match the maxTemperature
        maxTemperatureJsonDecoded = maxTemperatureJsonDecoded * 1e6;
        assertEq(maxTemperature, maxTemperatureJsonDecoded);
    }

    function test_totalSoil() public {
        uint256 soil = l2Beanstalk.totalSoil();
        bytes memory soilJson = searchGlobalPropertyData("soil");
        // soil will be 0 before the oracle is initialized
        assertEq(soil, 0);
    }

    // pods
    function test_Pods() public {
        // state
        uint256 totalPods = l2Beanstalk.totalPods(FIELD_ID);
        uint256 totalHarvestable = l2Beanstalk.totalHarvestable(FIELD_ID);
        uint256 totalHarvested = l2Beanstalk.totalHarvested(FIELD_ID);
        // Json data
        bytes memory totalPodsJson = searchGlobalPropertyData("fields.0.pods");
        bytes memory totalHarvestableJson = searchGlobalPropertyData("fields.0.harvestable");
        bytes memory totalHarvestedJson = searchGlobalPropertyData("fields.0.harvested");
        // decode the pods from json
        uint256 totalPodsJsonDecoded = vm.parseUint(vm.toString(totalPodsJson));
        uint256 totalHarvestableJsonDecoded = vm.parseUint(vm.toString(totalHarvestableJson));
        uint256 totalHarvestedJsonDecoded = vm.parseUint(vm.toString(totalHarvestedJson));
        // total pods subtracts harvested pods from the calculation
        totalPodsJsonDecoded -= totalHarvestedJsonDecoded;
        // total harvestable pods subtracts harvested pods from the calculation
        totalHarvestableJsonDecoded -= totalHarvestedJsonDecoded;
        // compare the values
        assertEq(totalPods, totalPodsJsonDecoded);
        assertEq(totalHarvestable, totalHarvestableJsonDecoded);
        assertEq(totalHarvested, totalHarvestedJsonDecoded);
    }

    function test_totalHarvested() public {
        uint256 harvested = l2Beanstalk.totalHarvested(FIELD_ID);
        bytes memory harvestedJson = searchGlobalPropertyData("fields.0.harvested");
        // decode the harvested from json
        uint256 harvestedJsonDecoded = vm.parseUint(vm.toString(harvestedJson));
        assertEq(harvested, harvestedJsonDecoded);
    }

    //////////////////// Account State //////////////////////

    function test_AccountStalk() public {
        string memory account;
        uint256 accountStalk;
        for (uint256 i = 0; i < accountNumber; i++) {
            account = vm.readLine(ACCOUNTS_PATH);
            // get stalk from storage
            accountStalk = l2Beanstalk.balanceOfStalk(vm.parseAddress(account));
            // get stalk from json
            string memory accountStalkPath = string.concat(account, ".stalk");
            bytes memory accountStalkJson = searchAccountPropertyData(accountStalkPath);
            // decode the stalk from json
            uint256 accountStalkJsonDecoded = vm.parseUint(vm.toString(accountStalkJson));
            assertEq(accountStalk, accountStalkJsonDecoded);
        }
    }

    function test_AccountRoots() public {
        string memory account;
        uint256 accountRoots;
        for (uint256 i = 0; i < accountNumber; i++) {
            account = vm.readLine(ACCOUNTS_PATH);
            // get roots from storage
            accountRoots = l2Beanstalk.balanceOfRoots(vm.parseAddress(account));
            // get roots from json
            string memory accountRootsPath = string.concat(account, ".roots");
            bytes memory accountRootsJson = searchAccountPropertyData(accountRootsPath);
            // decode the roots from json
            uint256 accountRootsJsonDecoded = vm.parseUint(vm.toString(accountRootsJson));
            assertEq(accountRoots, accountRootsJsonDecoded);
        }
    }

    ///////////////// Account Internal Balance ////////////////////

    function test_AccountInternalBalance() public {
        string memory account;
        for (uint256 i = 0; i < accountNumber; i++) {
            account = vm.readLine(ACCOUNTS_PATH);
            for (uint256 j = 0; j < whitelistedTokens.length; j++) {
                // get the internal balance from storage
                uint256 tokenInternalBalance = l2Beanstalk.getInternalBalance(
                    vm.parseAddress(account),
                    whitelistedTokens[j]
                );
                // get the internal balance from json
                string memory accountInternalBalancePath = string.concat(
                    account,
                    ".internalTokenBalance."
                );
                accountInternalBalancePath = string.concat(
                    accountInternalBalancePath,
                    vm.toString(whitelistedTokens[j])
                );
                bytes memory accountInternalBalanceJson = searchAccountPropertyData(
                    accountInternalBalancePath
                );
                // decode the internal balance from json
                uint256 accountInternalBalanceJsonDecoded = vm.parseUint(
                    vm.toString(accountInternalBalanceJson)
                );
                assertEq(tokenInternalBalance, accountInternalBalanceJsonDecoded);
            }
        }
    }

    //////////////////// Account Plots ////////////////////

    function test_AccountPlots() public {
        // test the L2 Beanstalk
        string memory account;
        // for every account
        for (uint256 i = 0; i < accountNumber; i++) {
            account = vm.readLine(ACCOUNTS_PATH);
            IMockFBeanstalk.Plot[] memory plots = l2Beanstalk.getPlotsFromAccount(
                vm.parseAddress(account),
                FIELD_ID
            );
            // get plot indexes list
            string memory accountPlotIndexesPath = string.concat(account, ".fields.0.plotIndexes");
            bytes memory plotindexes = searchAccountPropertyData(accountPlotIndexesPath);
            uint256[] memory plotindexesJsonDecoded = abi.decode(plotindexes, (uint256[]));
            // for every plot index --> get the amount
            for (uint256 j = 0; j < plotindexesJsonDecoded.length; j++) {
                // build the search path
                string memory accountPlotAmountPath = string.concat(account, ".fields.0.plots.");
                accountPlotAmountPath = string.concat(
                    accountPlotAmountPath,
                    vm.toString(plotindexesJsonDecoded[j])
                );
                bytes memory accountPlotAmountJson = searchAccountPropertyData(
                    accountPlotAmountPath
                );
                // decode the plot amount from json
                uint256 accountPlotAmountJsonDecoded = vm.parseUint(
                    vm.toString(accountPlotAmountJson)
                );
                // compare the plot amount and index
                assertEq(accountPlotAmountJsonDecoded, plots[j].pods);
                assertEq(plotindexesJsonDecoded[j], plots[j].index);
            }
        }
    }

    //////////////////// Account Deposits ////////////////////

    function test_AccountDeposits() public {
        address[] memory tokens = l2Beanstalk.getWhitelistedTokens();

        // for every account
        for (uint256 i = 0; i < accountNumber; i++) {
            address account = vm.parseAddress(vm.readLine(ACCOUNTS_PATH));
            // get all deposits of all tokens --> order of whitelist
            IMockFBeanstalk.TokenDepositId[] memory accountDepositsStorage = l2Beanstalk
                .getDepositsForAccount(account);

            bytes memory depositDataJson = searchAccountDeposits(account);
            // decode the deposit data from json
            IMockFBeanstalk.TokenDepositId[] memory accountDepositsJson = abi.decode(
                depositDataJson,
                (IMockFBeanstalk.TokenDepositId[])
            );

            // for all tokens
            for (uint256 j = 0; j < accountDepositsStorage.length; j++) {
                // for all deposits --> if no deposits of a particular token, the for loop is skipped
                for (uint256 k = 0; k < accountDepositsStorage[j].depositIds.length; k++) {
                    // assert the token
                    assertEq(accountDepositsStorage[j].token, accountDepositsJson[j].token);
                    // assert the deposit id
                    assertEq(
                        accountDepositsStorage[j].depositIds[k],
                        accountDepositsJson[j].depositIds[k]
                    );
                    // assert the amount
                    assertEq(
                        accountDepositsStorage[j].tokenDeposits[k].amount,
                        accountDepositsJson[j].tokenDeposits[k].amount
                    );
                    // assert the bdv
                    assertEq(
                        accountDepositsStorage[j].tokenDeposits[k].bdv,
                        accountDepositsJson[j].tokenDeposits[k].bdv
                    );
                }
            }
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

    function searchGlobalPropertyData(string memory property) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/finder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-system20577510.json"; // json file
        inputs[3] = property;
        bytes memory propertyValue = vm.ffi(inputs);
        return propertyValue;
    }

    function searchAccountPropertyData(string memory property) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/finder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20577510.json"; // json file
        inputs[3] = property;
        bytes memory propertyValue = vm.ffi(inputs);
        return propertyValue;
    }

    function searchAccountDeposits(address account) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/depositFinder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20577510.json"; // json file
        inputs[3] = vm.toString(account);
        bytes memory accountDeposits = vm.ffi(inputs);
        return accountDeposits;
    }

    function swapInWell(address well, address nonBeantoken) public {
        // perform a swap on bean eth well
        IWell well = IWell(well);
        IERC20 bean = IERC20(L2BEAN);
        // weth
        IERC20 token = IERC20(nonBeantoken);
        vm.startPrank(L2_DEPLOYER);
        well.swapFrom(bean, token, 1e6, 0, L2_DEPLOYER, type(uint256).max);
        vm.stopPrank();
    }
}
