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

    address constant BEAN = address(0xBEA0005B8599265D41256905A9B3073D397812E4);
    address constant URBEAN = address(0x1BEA054dddBca12889e07B3E076f511Bf1d27543);
    address constant URLP = address(0x1BEA059c3Ea15F6C10be1c53d70C75fD1266D788);

    address[] whiteListedWellTokens = [
        address(0xBEA02d411690A8Aa418E6606fFf5C964933645E0), // BEAN/WETH
        address(0xBEA046038302b14e2Bab2636d1E8FaacE602e0aa), // BEAN/WstETH
        address(0xBEA0Ee8f9c5bDd6f9aBd9dC687a2D51956508eC9), // BEAN/WEETH
        address(0xBEA0d57e05C78E11817f6B2024805b68f97c0e2b), // BEAN/WBTC
        address(0xBEA0F599087480c49eC21a9aAa66CBE0A53B6741), // BEAN/USDC
        address(0xBEA09220d69Eec94140531877DdB4922E75a75aC) // BEAN/USDT
    ];

    address[] whitelistedTokens = [
        BEAN,
        URBEAN,
        URLP,
        address(0xBEA02d411690A8Aa418E6606fFf5C964933645E0), // BEAN/WETH
        address(0xBEA046038302b14e2Bab2636d1E8FaacE602e0aa), // BEAN/WstETH
        address(0xBEA0Ee8f9c5bDd6f9aBd9dC687a2D51956508eC9), // BEAN/WEETH
        address(0xBEA0d57e05C78E11817f6B2024805b68f97c0e2b), // BEAN/WBTC
        address(0xBEA0F599087480c49eC21a9aAa66CBE0A53B6741), // BEAN/USDC
        address(0xBEA09220d69Eec94140531877DdB4922E75a75aC) // BEAN/USDT
    ];

    IMockFBeanstalk l2Beanstalk;

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

    //////////////////// Globals ////////////////////

    // function totalDeltaB() external view returns (int256 deltaB);

    // function totalEarnedBeans() external view returns (uint256);

    // function totalFertilizedBeans() external view returns (uint256 beans);

    // function totalFertilizerBeans() external view returns (uint256 beans);

    // function totalHarvestable(uint256 fieldId) external view returns (uint256);

    // function totalHarvestableForActiveField() external view returns (uint256);

    // function totalHarvested(uint256 fieldId) external view returns (uint256);

    // function totalPods(uint256 fieldId) external view returns (uint256);

    // function totalRainRoots() external view returns (uint256);

    // function totalRealSoil() external view returns (uint256);

    // function totalRoots() external view returns (uint256);

    // function totalSoil() external view returns (uint256);

    function test_Stalk() public {
        // test the L2 Beanstalk
        uint256 beanBalance = l2Beanstalk.balanceOfStalk(
            address(0x0000002e4F99CB1e699042699b91623B1334D2F7)
        );
        console.log("balanceOfStalk: ", beanBalance);
    }

    // function test_getDepositsForAccount() public {
    //     // test the L2 Beanstalk
    //     IMockFBeanstalk.TokenDepositId[] memory tokenDeposits = l2Beanstalk.getDepositsForAccount(
    //         address(0x0000002e4F99CB1e699042699b91623B1334D2F7)
    //     );
    //     console.log("token deposits count: ", tokenDeposits.length);
    //     for (uint256 i = 0; i < tokenDeposits.length; i++) {
    //         console.log("token: ", tokenDeposits[i].token);
    //         console.log("depositIds count: ", tokenDeposits[i].depositIds.length);
    //         for (uint256 j = 0; j < tokenDeposits[i].depositIds.length; j++) {
    //             console.log("depositId: ", tokenDeposits[i].depositIds[j]);
    //         }
    //     }
    // }

    //     struct TokenDepositId {
    //     address token;
    //     uint256[] depositIds;
    //     Deposit[] tokenDeposits;
    // }

    function test_getDepositsForAccountToken() public {
        // test the L2 Beanstalk
        IMockFBeanstalk.TokenDepositId memory tokenDeposits = l2Beanstalk
            .getTokenDepositsForAccount(address(0x0000002e4F99CB1e699042699b91623B1334D2F7), BEAN);

        console.log("token: ", tokenDeposits.token);
        console.log("depositIds count: ", tokenDeposits.depositIds.length);
        for (uint256 j = 0; j < tokenDeposits.depositIds.length; j++) {
            console.log("depositId: ", tokenDeposits.depositIds[j]);
        }
    }

    function test_getDepositsId() public {
        // test the L2 Beanstalk
        uint256[] memory depositIds = l2Beanstalk
            .getTokenDepositIdsForAccount(0x0000002e4F99CB1e699042699b91623B1334D2F7, BEAN);
        console.log("depositIds count: ", depositIds.length);
        for (uint256 j = 0; j < depositIds.length; j++) {
            console.log("depositId: ", depositIds[j]);
        }
    }

    function test_getindexFromDeposit() public {
        // test the L2 Beanstalk
        uint256 index1 = l2Beanstalk.getIndexForDepositId(
            0x0000002e4F99CB1e699042699b91623B1334D2F7, // ACCOUNT
            BEAN, // TOKEN
            86222139228609838984622303097359211701898488658280287174231757124351089827200 // ID
        );
        console.log("index1: ", index1);

        // test the L2 Beanstalk
        uint256 index2 = l2Beanstalk.getIndexForDepositId(
            0x0000002e4F99CB1e699042699b91623B1334D2F7, // ACCOUNT
            BEAN, // TOKEN
            86222139228609838984622303097359211701898488658201059011717492786803481771076 // ID
        );
        console.log("index2: ", index2);
    }
}
