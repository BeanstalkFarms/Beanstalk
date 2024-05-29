// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {MockSiloFacet} from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";

/**
 * @notice Tests the functionality of the Silo.
 */
contract SiloTest is TestHelper {
    // Interfaces.
    MockSiloFacet silo = MockSiloFacet(BEANSTALK);

    // test accounts
    address[] farmers;

    function setUp() public {
        initializeBeanstalkTestState(true, false);

        // initalize farmers from farmers (farmer0 == diamond deployer)
        farmers.push(users[1]);
        farmers.push(users[2]);

        // max approve.
        maxApproveBeanstalk(farmers);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            C.BEAN_ETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );

        addLiquidityToWell(
            C.BEAN_WSTETH_WELL,
            10000e6, // 10,000 Beans
            10 ether // 10 ether.
        );
    }

    /**
     * @notice verfies that a farmer's deposit list is updated correctly.
     * @dev partial transfers, withdraws, and converts are tested here. See {SiloTest.test_siloDepositList} for full deposits.
     */
    function test_siloDepositList(uint256 amount, uint256 portion) public {
        uint256[] memory depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        IMockFBeanstalk.TokenDepositId memory deposit = bs.getTokenDepositsForAccount(
            farmers[0],
            C.BEAN
        );
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 0);

        amount = bound(amount, 100, 1e22);
        portion = bound(portion, 1, amount - 1);
        mintTokensToUser(farmers[0], C.BEAN, amount);

        //////////// DEPOSIT ////////////
        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, portion, 0);

        // verify depositList.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        IMockFBeanstalk.TokenDepositId[] memory allDeposits = bs.getDepositsForAccount(farmers[0]);

        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositIds[0]);
        assertEq(token, deposit.token);
        assertEq(stem, bs.stemTipForToken(token));
        assertEq(deposit.tokenDeposits[0].amount, portion);
        for (uint i; i < allDeposits.length; i++) {
            assertEq(allDeposits[i].token, bs.getWhitelistedTokens()[i]);
            if (allDeposits[i].token != C.BEAN) {
                assertEq(allDeposits[i].depositIds.length, 0);
                assertEq(allDeposits[i].tokenDeposits.length, 0);
            }
        }

        vm.prank(farmers[0]);
        bs.deposit(C.BEAN, amount - portion, 0);

        // verify depositList index does not increase.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        (token, stem) = LibBytes.unpackAddressAndStem(depositIds[0]);
        assertEq(token, deposit.token);
        assertEq(stem, bs.stemTipForToken(token));
        assertEq(deposit.tokenDeposits[0].amount, amount);

        uint256 snapshot = vm.snapshot();

        //////////// TRANSFER ////////////
        vm.prank(farmers[0]);
        bs.transferDeposit(farmers[0], farmers[1], C.BEAN, stem, portion);

        // verify depositList for sender.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        assertEq(deposit.tokenDeposits[0].amount, amount - portion);

        // verify depositList for recipient.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[1], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[1], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        assertEq(deposit.tokenDeposits[0].amount, portion);

        vm.revertTo(snapshot);

        // withdraw `portion` of deposit.
        vm.prank(farmers[0]);
        bs.withdrawDeposit(C.BEAN, stem, portion, 0);

        // verify depositList.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        assertEq(deposit.tokenDeposits[0].amount, amount - portion);

        //////////// CONVERT ////////////

        vm.revertTo(snapshot);
        // increase deltaB. 1e22 / 1e6 = 1e16 ethers.
        addLiquidityToWell(C.BEAN_ETH_WELL, 0, 1e16 ether);

        bytes memory convertData = createBeanToLPConvert(C.BEAN_ETH_WELL, portion);

        int96[] memory stems = new int96[](1);
        stems[0] = stem;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = portion;

        // skip germination as germinating deposits cannot be converted.
        bs.siloSunrise(0);
        bs.siloSunrise(0);

        vm.prank(farmers[0]);
        bs.convert(convertData, stems, amounts);

        // verify depositList.
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 1);
        assertEq(deposit.tokenDeposits[0].amount, amount - portion);

        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN_ETH_WELL);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN_ETH_WELL);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN_ETH_WELL, 1);
        assertGe(deposit.tokenDeposits[0].amount, 0);
    }

    /**
     * @notice performs a series of interactions with deposits and verifies that the depositlist is updated correctly.
     * 1. depositing properly increments the depositId index, if the deposit occured in different seasons.
     * 2. transfering a deposit properly decrements the senders' depositId,
     * and increments the recipients' depositId.
     * 3. withdrawing a deposit properly decrements the depositId list.
     * 4. converting a deposit properly decrements the depositId list.
     */
    function test_siloMultipleDepositLists() public {
        //////////// DEPOSIT ////////////
        uint256 depositAmount = rand(1, 10e6);
        uint256 deposits = rand(1, 50);
        for (uint256 i; i < deposits; i++) {
            mintTokensToUser(farmers[0], C.BEAN, depositAmount);
            vm.prank(farmers[0]);
            bs.deposit(C.BEAN, depositAmount, 0);
            bs.siloSunrise(0);
        }

        // verify depositList.
        uint256[] memory depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        IMockFBeanstalk.TokenDepositId memory deposit = bs.getTokenDepositsForAccount(
            farmers[0],
            C.BEAN
        );
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, deposits);
        for (uint256 i; i < deposits; i++) {
            assertEq(deposit.tokenDeposits[i].amount, depositAmount);
        }

        //////////// TRANSFER ////////////

        // transfers a random amount of deposits to farmer[1].
        uint256 transfers = rand(1, ((deposits - 1) / 2) + 1);
        vm.startPrank(farmers[0]);
        uint256 _stalkEarnedPerSeason = stalkEarnedPerSeason(C.BEAN);
        int96[] memory stems = new int96[](transfers);
        uint256[] memory amounts = new uint256[](transfers);
        for (uint256 i; i < transfers; i++) {
            stems[i] = int96(uint96(i * _stalkEarnedPerSeason));
            amounts[i] = depositAmount;
        }
        bs.transferDeposits(farmers[0], farmers[1], C.BEAN, stems, amounts);
        vm.stopPrank();

        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, deposits - transfers);

        depositIds = bs.getTokenDepositIdsForAccount(farmers[1], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[1], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, transfers);

        //////////// CONVERT ////////////

        // increase deltaB.
        addLiquidityToWell(C.BEAN_ETH_WELL, 0, 100 ether);
        // skip germination as germinating deposits cannot be converted.
        bs.siloSunrise(0);
        bs.siloSunrise(0);

        // converts deposits for farmer[1].
        vm.startPrank(farmers[1]);
        bs.convert(
            createBeanToLPConvert(C.BEAN_ETH_WELL, depositAmount * transfers),
            stems,
            amounts
        );
        vm.stopPrank();

        depositIds = bs.getTokenDepositIdsForAccount(farmers[1], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[1], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 0);

        depositIds = bs.getTokenDepositIdsForAccount(farmers[1], C.BEAN_ETH_WELL);
        deposit = bs.getTokenDepositsForAccount(farmers[1], C.BEAN_ETH_WELL);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN_ETH_WELL, 1);

        //////////// WITHDRAW ////////////

        // withdraws deposits from farmer[0]
        stems = new int96[](deposits - transfers);
        amounts = new uint256[](deposits - transfers);
        for (uint256 i; i < deposits - transfers; i++) {
            stems[i] = int96(uint96((i + transfers) * _stalkEarnedPerSeason));
            amounts[i] = depositAmount;
        }
        vm.startPrank(farmers[0]);
        bs.withdrawDeposits(C.BEAN, stems, amounts, 0);
        depositIds = bs.getTokenDepositIdsForAccount(farmers[0], C.BEAN);
        deposit = bs.getTokenDepositsForAccount(farmers[0], C.BEAN);
        verifyDepositIdLengths(depositIds, deposit, C.BEAN, 0);
    }

    // silo list helpers //
    function verifyDepositIdLengths(
        uint256[] memory depositIds,
        IMockFBeanstalk.TokenDepositId memory deposit,
        address token,
        uint256 length
    ) internal pure {
        assertEq(depositIds.length, length);
        assertEq(depositIds.length, deposit.depositIds.length);
        assertEq(depositIds.length, deposit.tokenDeposits.length);
        assertEq(deposit.token, token);
    }

    function stalkEarnedPerSeason(address token) internal returns (uint32) {
        return (bs.tokenSettings(token)).stalkEarnedPerSeason;
    }
}
