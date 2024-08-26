// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {L1RecieverFacet} from "contracts/beanstalk/migration/L1RecieverFacet.sol";
import {LibBytes} from "contracts/Libraries/LibBytes.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import "forge-std/console.sol";
import {Deposit} from "contracts/beanstalk/storage/Account.sol";

/**
 * @notice Verfifies state and functionality of the new L2 Beanstalk
 */
contract ReseedTest is TestHelper {
    // contracts for testing:
    address constant L2_BEANSTALK = address(0xD1A0060ba708BC4BCD3DA6C37EFa8deDF015FB70);
    address constant FERTILIZER = address(0xC59f881074Bf039352C227E21980317e6b969c8A);

    uint256 constant FIELD_ID = 0;

    address constant L2BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant L2URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant L2URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

    address[] whiteListedWellTokens = [
        address(0xBEA00ebA46820994d24E45dffc5c006bBE35FD89), // BEAN/WETH
        address(0xBEA0039bC614D95B65AB843C4482a1A5D2214396), // BEAN/WstETH
        address(0xBEA000B7fde483F4660041158D3CA53442aD393c), // BEAN/WEETH
        address(0xBEA0078b587E8f5a829E171be4A74B6bA1565e6A), // BEAN/WBTC
        address(0xBEA00C30023E873D881da4363C00F600f5e14c12), // BEAN/USDC
        address(0xBEA00699562C71C2d3fFc589a848353151a71A61) // BEAN/USDT
    ];

    address[] whitelistedTokens = [
        L2BEAN,
        L2URBEAN,
        L2URLP,
        address(0xBEA00ebA46820994d24E45dffc5c006bBE35FD89), // BEAN/WETH
        address(0xBEA0039bC614D95B65AB843C4482a1A5D2214396), // BEAN/WstETH
        address(0xBEA000B7fde483F4660041158D3CA53442aD393c), // BEAN/WEETH
        address(0xBEA0078b587E8f5a829E171be4A74B6bA1565e6A), // BEAN/WBTC
        address(0xBEA00C30023E873D881da4363C00F600f5e14c12), // BEAN/USDC
        address(0xBEA00699562C71C2d3fFc589a848353151a71A61) // BEAN/USDT
    ];

    IMockFBeanstalk l2Beanstalk;

    string constant HEX_PREFIX = "0x";

    address constant DEFAULT_ACCOUNT = address(0xC5581F1aE61E34391824779D505Ca127a4566737);

    function setUp() public {
        l2Beanstalk = IMockFBeanstalk(L2_BEANSTALK);
        // l2Beanstalk.gm(address(this), 1);
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
        assertEq(vm.toString(totalStalk), string(totalStalkJson));
    }

    function test_totalEarnedBeans() public {
        bytes memory earnedBeansJson = searchGlobalPropertyData("silo.earnedBeans");
        uint256 earnedBeans = l2Beanstalk.totalEarnedBeans();
        assertEq(vm.toString(earnedBeans), string(earnedBeansJson));
    }

    function test_totalRoots() public {
        uint256 roots = l2Beanstalk.totalRoots();
        bytes memory rootsJson = searchGlobalPropertyData("silo.roots");
        assertEq(vm.toString(roots), string(rootsJson));
    }

    //////////////////// Global State Season ////////////////////
    
    function test_seasonNumber() public {
        uint32 season = l2Beanstalk.season();
        bytes memory seasonJson = searchGlobalPropertyData("season.current");
        assertEq(vm.toString(season), string(seasonJson));
    }

    //////////////////// Global State Field ////////////////////

    function test_maxTemperature() public {
        uint256 maxTemperature = l2Beanstalk.maxTemperature();
        bytes memory maxTemperatureJson = searchGlobalPropertyData("weather.temp");
        // add precision to the temperaturejson to match the maxTemperature
        string memory tempPrecision = "000000";
        assertEq(vm.toString(maxTemperature), string.concat(string(maxTemperatureJson), tempPrecision));
    }

    // // pods
    // function test_totalPods() public {
    //     uint256 pods = l2Beanstalk.totalPods(FIELD_ID);
    //     bytes memory podsJson = searchGlobalPropertyData("fields.0.pods");
    //     assertEq(vm.toString(pods), string(podsJson));
    // }

    function test_totalHarvested() public {
        uint256 harvested = l2Beanstalk.totalHarvested(FIELD_ID);
        string memory finalHarvested = string.concat(HEX_PREFIX, vm.toString(harvested));
        bytes memory harvestedJson = searchGlobalPropertyData("fields.0.harvested");
        assertEq(finalHarvested, vm.toString(harvestedJson));
    }

    function test_totalSoil() public {
        uint256 soil = l2Beanstalk.totalSoil();
        bytes memory soilJson = searchGlobalPropertyData("soil");
        // soil will be 0 before the oracle is initialized
        assertEq(soil, 0);
    }

    //////////////////// Account State ////////////////////

    function test_AccountStalk() public {
        // test the L2 Beanstalk
        uint256 beanBalance = l2Beanstalk.balanceOfStalk(
            address(0x0000002e4F99CB1e699042699b91623B1334D2F7)
        );
        console.log("balanceOfStalk: ", beanBalance);
    }

    //////////////////// Account Plots ////////////////////

    function test_AccountPlots() public {
        // test the L2 Beanstalk
        console.log("Checking account: ", address(DEFAULT_ACCOUNT));
        IMockFBeanstalk.Plot[] memory plots = l2Beanstalk.getPlotsFromAccount(
            address(DEFAULT_ACCOUNT),
            0
        );
        console.log("plots count: ", plots.length);
        for (uint256 i = 0; i < plots.length; i++) {
            console.log("index: ", plots[i].index);
            console.log("pods: ", plots[i].pods);
        }
    }

    //////////////////// Account Deposits ////////////////////

    function test_getDepositsForAccount() public {
        // test the L2 Beanstalk
        IMockFBeanstalk.TokenDepositId[] memory tokenDeposits = l2Beanstalk.getDepositsForAccount(
            address(DEFAULT_ACCOUNT)
        );
        console.log("Checking account: ", address(DEFAULT_ACCOUNT));
        console.log("token deposits count: ", tokenDeposits.length);
        for (uint256 i = 0; i < tokenDeposits.length; i++) {
            console.log("token: ", tokenDeposits[i].token);
            console.log("depositIds count: ", tokenDeposits[i].depositIds.length);
            for (uint256 j = 0; j < tokenDeposits[i].depositIds.length; j++) {
                console.log("depositId: ", tokenDeposits[i].depositIds[j]);
            }
        }
    }

    //////////////////// Helpers ////////////////////

    function searchGlobalPropertyData(string memory property) public returns (bytes memory) {
        string[] memory inputs = new string[](4);
        inputs[0] = "node";
        inputs[1] = "./test/foundry/Migration/finderScripts/findGlobal.js";
        inputs[2] = "./reseed/data/exports/storage-system20577510.json";
        inputs[3] = property;
        bytes memory propertyValue = vm.ffi(inputs);
        return propertyValue;
    }
}
