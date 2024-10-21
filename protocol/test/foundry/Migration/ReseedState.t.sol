// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1ReceiverFacet} from "contracts/beanstalk/migration/L1ReceiverFacet.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import "forge-std/console.sol";
import {Deposit} from "contracts/beanstalk/storage/Account.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell, Call} from "contracts/interfaces/basin/IWell.sol";
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
contract ReseedStateTest is TestHelper {
    struct FertDepositData {
        uint256 fertId;
        uint256 amount;
        uint256 lastBpf;
    }

    // contracts for testing:
    address constant L2_BEANSTALK = address(0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70);
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
        address(0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce), // BEAN/WETH
        address(0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F), // BEAN/WstETH
        address(0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c), // BEAN/WEETH
        address(0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c), // BEAN/WBTC
        address(0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7), // BEAN/USDC
        address(0xbEA00fF437ca7E8354B174339643B4d1814bED33) // BEAN/USDT
    ];

    address[] whitelistedTokens = [
        L2BEAN,
        L2URBEAN,
        L2URLP,
        address(0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce), // BEAN/WETH
        address(0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F), // BEAN/WstETH
        address(0xBeA00Cc9F93E9a8aC0DFdfF2D64Ba38eb9C2e48c), // BEAN/WEETH
        address(0xBea00DDe4b34ACDcB1a30442bD2B39CA8Be1b09c), // BEAN/WBTC
        address(0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7), // BEAN/USDC
        address(0xbEA00fF437ca7E8354B174339643B4d1814bED33) // BEAN/USDT
    ];

    IMockFBeanstalk l2Beanstalk;

    string constant HEX_PREFIX = "0x";

    string constant ACCOUNTS_PATH = "./test/foundry/Migration/data/accounts.txt";
    string constant FERT_ACCOUNTS_PATH = "./test/foundry/Migration/data/fert_accounts.txt";

    address constant DEFAULT_ACCOUNT = address(0xC5581F1aE61E34391824779D505Ca127a4566737);

    address constant realUser = 0xC2820F702Ef0fBd8842c5CE8A4FCAC5315593732;
    address constant beanWethWell = 0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce;
    address constant beanWstethWell = 0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F;

    uint256 accountNumber;

    function setUp() public {
        // parse accounts and populate the accounts.txt file
        // the number of accounts to parse, for testing purposes
        // the total number of accounts is 3665
        uint256 numAccounts = 10;
        // offset to start parsing from:
        // Note: Upon migration, update offset to parse accounts in batches of 500
        uint256 offset = 20;
        accountNumber = parseAccounts(numAccounts, offset);
        // console.log("Number of accounts: ", accountNumber);
        l2Beanstalk = IMockFBeanstalk(L2_BEANSTALK);
        // uint256 fertAccountNumber = parseFertAccounts(numAccounts, offset);
        // console.log("Number of fert accounts: ", fertAccountNumber);
    }

    function test_WhitelistingState() public {
        // address L2_BEANSTALK = address(0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70);
        // IMockFBeanstalk l2Beanstalk = IMockFBeanstalk(L2_BEANSTALK);

        // get AssetSettings of L2BEAN
        IMockFBeanstalk.AssetSettings memory assetSettings = l2Beanstalk.tokenSettings(L2BEAN);

        // log milestone stem and season
        console.log("Milestone stem: ", assetSettings.milestoneStem);
        console.log("Milestone season: ", assetSettings.milestoneSeason);
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
        // get smart contract stalk to subtract the total stalk
        uint256 smartContractStalk = getSmartContractStalk();
        totalStalkJsonDecoded -= smartContractStalk;
        assertEq(totalStalk, totalStalkJsonDecoded);
    }

    function test_totalRoots() public {
        uint256 roots = l2Beanstalk.totalRoots();
        bytes memory rootsJson = searchGlobalPropertyData("silo.roots");
        // decode the roots from json
        uint256 rootsJsonDecoded = vm.parseUint(vm.toString(rootsJson));
        // get smart contract roots to subtract the total roots
        uint256 smartContractRoots = getSmartContractStalk();
        // multiply by 1e12 to match the precision
        smartContractRoots *= 1e12;
        // subtract the smart contract roots from the total roots
        rootsJsonDecoded -= smartContractRoots;
        assertEq(roots, rootsJsonDecoded);
    }

    function test_totalEarnedBeans() public {
        bytes memory earnedBeansJson = searchGlobalPropertyData("silo.earnedBeans");
        uint256 earnedBeans = l2Beanstalk.totalEarnedBeans();
        // decode the earnedBeans from json
        uint256 earnedBeansJsonDecoded = vm.parseUint(vm.toString(earnedBeansJson));
        assertEq(earnedBeans, earnedBeansJsonDecoded);
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
        uint256 totalPlotsAmount;
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

                // find the matching plot indexes to compare the amount
                for (uint256 k = 0; k < plots.length; k++) {
                    if (plots[k].index == plotindexesJsonDecoded[j]) {
                        // compare the plot amount and index
                        // log the index and amount form the json and the storage
                        assertEq(accountPlotAmountJsonDecoded, plots[k].pods);
                    }
                }
            }
        }
    }

    //////////////////// Account Deposits ////////////////////

    function test_AccountDeposits() public {
        vm.pauseGasMetering();

        uint256 totalStalkBefore = l2Beanstalk.totalStalk();
        assertGt(totalStalkBefore, 0);

        uint256 totalRootsBefore = l2Beanstalk.totalRoots();
        assertGt(totalRootsBefore, 0);

        // verify ratio is 1:1 on reseed
        assertEq(totalStalkBefore * 1e12, totalRootsBefore);

        // get the account list:
        address[] memory accounts = new address[](accountNumber);
        for (uint256 i = 0; i < accountNumber; i++) {
            accounts[i] = vm.parseAddress(vm.readLine(ACCOUNTS_PATH));
        }

        // decode into bytes[]
        bytes[] memory depositDataJsons = abi.decode(
            batchSearchAccountDeposits(accounts),
            (bytes[])
        );

        address[] memory tokens = new address[](5);
        tokens[0] = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
        tokens[1] = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
        tokens[2] = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);
        tokens[3] = address(0xBeA00Aa8130aCaD047E137ec68693C005f8736Ce);
        tokens[4] = address(0xBEa00BbE8b5da39a3F57824a1a13Ec2a8848D74F);

        for (uint256 i = 0; i < accountNumber; i++) {
            address account = accounts[i];
            // get all deposits of all tokens --> order of whitelist
            IMockFBeanstalk.TokenDepositId[] memory accountDepositsStorage = l2Beanstalk
                .getDepositsForAccount(account, tokens);

            // decode the deposit data from json
            IMockFBeanstalk.TokenDepositId[] memory accountDepositsJson = abi.decode(
                depositDataJsons[i],
                (IMockFBeanstalk.TokenDepositId[])
            );

            // for all tokens
            for (uint256 j = 0; j < accountDepositsStorage.length; j++) {
                // for all deposits --> if no deposits of a particular token, the for loop is skipped
                if (accountDepositsStorage[j].depositIds.length == 0) {
                    continue;
                }
                for (uint256 k = 0; k < accountDepositsStorage[j].depositIds.length; k++) {
                    // assert the token
                    assertEq(accountDepositsStorage[j].token, accountDepositsJson[j].token);

                    for (uint256 l = 0; l < accountDepositsJson[j].depositIds.length; l++) {
                        uint256 depositId = accountDepositsJson[j].depositIds[l];
                        if (accountDepositsStorage[j].depositIds[k] != depositId) {
                            continue;
                        }
                        uint256 amount = accountDepositsJson[j].tokenDeposits[l].amount;
                        uint256 bdv = accountDepositsJson[j].tokenDeposits[l].bdv;
                        // assert the deposit id
                        assertEq(accountDepositsStorage[j].depositIds[k], depositId);
                        // assert the amount
                        assertEq(accountDepositsStorage[j].tokenDeposits[k].amount, amount);
                        // assert the bdv
                        assertEq(accountDepositsStorage[j].tokenDeposits[k].bdv, bdv);
                    }
                }
            }
        }
    }

    //////////////////// Fertilizer ////////////////////
    function test_fertilizerProperties() public {
        uint256 activeFertilizerJson = getGlobalPropertyUint("fert.activeFertilizer");
        uint256 activeFertilizer = l2Beanstalk.getActiveFertilizer();
        assertEq(activeFertilizer, activeFertilizerJson, "active fertilizer");

        uint256 fertilizedIndexJson = getGlobalPropertyUint("fert.fertilizedIndex");
        uint256 fertilizedIndex = l2Beanstalk.totalFertilizedBeans();
        assertEq(fertilizedIndex, fertilizedIndexJson, "fertilized index");

        uint256 unfertilizedIndexJson = getGlobalPropertyUint("fert.unfertilizedIndex");
        uint256 unfertilizedIndex = l2Beanstalk.totalFertilizerBeans();
        assertEq(unfertilizedIndex, unfertilizedIndexJson, "unfertilized index");

        uint256 fertilizedPaidIndexJson = getGlobalPropertyUint("fert.fertilizedPaidIndex");
        uint256 fertilizedPaidIndex = l2Beanstalk.rinsedSprouts();
        assertEq(fertilizedPaidIndex, fertilizedPaidIndexJson, "fertilized paid index");

        uint256 fertFirstJson = getGlobalPropertyUint("fert.fertFirst");
        uint256 fertFirst = l2Beanstalk.getFirst();
        assertEq(fertFirst, fertFirstJson, "fert first");

        uint256 fertLastJson = getGlobalPropertyUint("fert.fertLast");
        uint256 fertLast = l2Beanstalk.getLast();
        assertEq(fertLast, fertLastJson, "fert last");
    }

    function test_AccountFertilizer() public {
        // for every account
        for (uint256 i = 0; i < accountNumber; i++) {
            address account = vm.parseAddress(vm.readLine(FERT_ACCOUNTS_PATH));

            // get fert id
            // loop through storage-fertilizer json, parse into FertDepositData
            FertDepositData[] memory jsonBalances = abi.decode(
                searchAccountFertilizer(account),
                (FertDepositData[])
            );

            // loop through jsonBalances' fertIds and compare to balanceOfFertilizer
            for (uint256 j = 0; j < jsonBalances.length; j++) {
                uint256 fertId = jsonBalances[j].fertId;
                uint256 amount = jsonBalances[j].amount;
                uint256 lastBpf = jsonBalances[j].lastBpf;

                // get balanceOfFertilizer
                IMockFBeanstalk.Balance memory balance = l2Beanstalk.balanceOfFertilizer(
                    account,
                    fertId
                );

                // compare balanceOfFertilizer to jsonBalances
                assertEq(balance.amount, amount, "amount");
                assertEq(balance.lastBpf, lastBpf, "lastBpf");
            }
        }
    }

    //////////////////// Helpers ////////////////////

    function getGlobalPropertyUint(string memory property) public returns (uint256) {
        bytes memory globalPropertyJson = searchGlobalPropertyData(property);
        return vm.parseUint(vm.toString(globalPropertyJson));
    }

    function parseAccounts(uint256 numAccounts, uint256 offset) public returns (uint256) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/getAccounts.js"; // script
        inputs[2] = vm.toString(numAccounts);
        inputs[3] = vm.toString(offset);
        bytes memory res = vm.ffi(inputs);
        // decode the number of accounts
        uint256 accountNumber = vm.parseUint(vm.toString(res));
        return accountNumber;
    }

    function searchGlobalPropertyData(string memory property) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/finder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-system20921737.json"; // json file
        inputs[3] = property;
        bytes memory propertyValue = vm.ffi(inputs);
        return propertyValue;
    }

    function searchAccountPropertyData(string memory property) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/finder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20921737.json"; // json file
        inputs[3] = property;
        bytes memory propertyValue = vm.ffi(inputs);
        return propertyValue;
    }

    function searchAccountDeposits(address account) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/depositFinder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20921737.json"; // json file
        inputs[3] = vm.toString(account);
        bytes memory accountDeposits = vm.ffi(inputs);
        return accountDeposits;
    }

    function batchSearchAccountDeposits(address[] memory accounts) public returns (bytes memory) {
        string[] memory inputs = new string[](3 + accounts.length);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/depositFinder2.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20921737.json"; // json file
        for (uint256 i = 0; i < accounts.length; i++) {
            inputs[i + 3] = vm.toString(accounts[i]);
        }
        bytes memory accountDeposits = vm.ffi(inputs);
        return accountDeposits;
    }

    function searchAccountFertilizer(address account) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/fertilizerFinder.js"; // script
        inputs[2] = "./reseed/data/exports/storage-fertilizer20921737.json"; // json file
        inputs[3] = vm.toString(account);
        bytes memory accountFertilizer = vm.ffi(inputs);
        return accountFertilizer;
    }

    function getSmartContractStalk() public returns (uint256) {
        string[] memory inputs = new string[](3);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/getContractStalk.js"; // script
        inputs[2] = "./reseed/data/exports/storage-accounts20921737.json"; // json file
        bytes memory contractStalk = vm.ffi(inputs);
        return vm.parseUint(vm.toString(contractStalk));
    }

    function parseFertAccounts(uint256 numAccounts, uint256 offset) public returns (uint256) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./scripts/migrationFinderScripts/getFertAccounts.js"; // script
        inputs[2] = vm.toString(numAccounts);
        inputs[3] = vm.toString(offset);
        bytes memory res = vm.ffi(inputs);
        // decode the number of accounts
        uint256 accountNumber = vm.parseUint(vm.toString(res));
        return accountNumber;
    }
}
