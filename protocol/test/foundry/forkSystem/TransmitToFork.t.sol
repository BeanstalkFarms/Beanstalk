// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {C} from "contracts/C.sol";
import {LibAltC} from "test/foundry/utils/LibAltC.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";
import {TestHelper} from "test/foundry/utils/TestHelper.sol";
import {LibTransmitOut} from "contracts/libraries/ForkSystem/LibTransmitOut.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {BeanstalkDeployer} from "test/foundry/utils/BeanstalkDeployer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @notice Tests migrations to a child fork from og Beanstalk.
 */
contract TransmitToForkTest is TestHelper {
    IMockFBeanstalk newBs;
    address newBsAddr;

    uint256 SRC_FIELD = 0;
    uint256 DEST_FIELD = 1;

    uint32 constant REPLANT_SEASON = 6074;

    address ZERO_ADDR = LibConstant.ZERO_ADDRESS;

    // test accounts
    address[] farmers;
    address payable newBeanstalk;

    function setUp() public {
        initializeBeanstalkTestState(true, false, false);

        farmers = createUsers(3);

        // max approve.
        maxApproveBeanstalk(farmers);

        // Initialize well to balances. Both source and Destination share this well.
        setReserves(C.BEAN_ETH_WELL, 1_000_000e6, 1000e18);
        initializeUnripeTokens(farmers[0], 100e6, 100e18);

        setUpSiloDeposits(10_000e6, farmers);
        passGermination();

        bs.fastForward(REPLANT_SEASON);

        addFertilizerBasedOnSprouts(REPLANT_SEASON, 100e6);

        // Deploy new Beanstalk fork.
        TestHelper altEcosystem = new TestHelper();
        altEcosystem.initializeBeanstalkTestState(true, true, false);

        newBs = IMockFBeanstalk(altEcosystem.bs());
        newBsAddr = address(newBs);
        vm.prank(deployer);
        newBs.addField();
        newBs.fastForward(100);
    }

    /**
     * @notice Performs migrations that should revert.
     * @dev Can revert at source if assets do not exist or destination if assets not compatible.
     */
    // function test_transmitRevert() public {}

    // fuzz?  if deposit amount == 0 ?

    /**
     * @notice Performs a migration of all asset types from a Source to Destination fork.
     */
    function test_transmitDeposits(uint256 beanDepositAmount, uint256 lpDepositAmount) public {
        beanDepositAmount = bound(beanDepositAmount, 100, 100_000e6);
        lpDepositAmount = bound(lpDepositAmount, 1e18, 5e18);
        address user = farmers[2];

        passGermination();
        depositForUser(user, C.BEAN, beanDepositAmount);
        int96 beanStem = bs.stemTipForToken(C.BEAN);
        depositForUser(user, C.BEAN_ETH_WELL, lpDepositAmount);
        int96 lpStem = bs.stemTipForToken(C.BEAN_ETH_WELL);
        passGermination();

        // Capture Source state.
        (, uint256 beanDepositBdv) = bs.getDeposit(user, C.BEAN, beanStem);
        require(beanDepositBdv > 0, "Source Bean deposit bdv");
        uint256 lpDepositBdv;
        (lpDepositAmount, lpDepositBdv) = bs.getDeposit(user, C.BEAN_ETH_WELL, lpStem);
        require(lpDepositBdv > 0, "Source LP deposit bdv");

        uint256 migrationAmountLp = lpDepositAmount / 2;

        IMockFBeanstalk.SourceDeposit[] memory deposits = new IMockFBeanstalk.SourceDeposit[](3);
        {
            uint256 migrationAmount0 = beanDepositAmount / 10;
            uint256 migrationAmount1 = beanDepositAmount - migrationAmount0;

            deposits[0] = IMockFBeanstalk.SourceDeposit(
                C.BEAN,
                migrationAmount0,
                beanStem,
                new uint256[](2), // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // populated by source
                0, // populated by source
                address(0), // populated by source
                0 // populated by source
            );
            deposits[1] = IMockFBeanstalk.SourceDeposit(
                C.BEAN,
                migrationAmount1,
                beanStem,
                new uint256[](2), // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // Not used for Bean deposits.
                0, // populated by source
                0, // populated by source
                address(0), // populated by source
                0 // populated by source
            );
            uint256[] memory minTokensOut = new uint256[](2);
            minTokensOut[0] = 1;
            minTokensOut[1] = 1;
            deposits[2] = IMockFBeanstalk.SourceDeposit(
                C.BEAN_ETH_WELL,
                migrationAmountLp,
                lpStem,
                minTokensOut,
                migrationAmountLp, // min dest lp amount, 1:1 bc shared bean & well
                type(uint256).max,
                0, // populated by source
                0, // populated by source
                address(0), // populated by source
                0 // populated by source
            );

            // Note that both the source and destination forks use the same Bean contract. This
            // is not how the system is expected to be used, but is a limitation of constants within
            // solidity, particularly in a diamond structure. Ownership limitations of Bean
            // burning and minting are bypassed in MockToken, for testing purposes.

            // Check events for burning and minting of bean token.
            vm.expectEmit();
            emit IERC20.Transfer(address(bs), ZERO_ADDR, migrationAmount0);
            vm.expectEmit();
            emit IERC20.Transfer(address(bs), ZERO_ADDR, migrationAmount1);
            vm.expectEmit(true, true, false, false);
            emit IERC20.Transfer(address(bs), ZERO_ADDR, 0); // LP Burn
            vm.expectEmit(true, true, false, false);
            emit IERC20.Transfer(address(bs), ZERO_ADDR, 0); // Bean half burn
            vm.expectEmit();
            emit IERC20.Transfer(ZERO_ADDR, newBsAddr, migrationAmount0);
            vm.expectEmit();
            emit IERC20.Transfer(ZERO_ADDR, newBsAddr, migrationAmount1);
            vm.expectEmit(true, true, false, false);
            emit IERC20.Transfer(ZERO_ADDR, newBsAddr, 1); // Bean half mint
            vm.expectEmit(true, true, false, false);
            emit IERC20.Transfer(ZERO_ADDR, newBsAddr, 1); // LP mint
        }

        vm.prank(user);
        bs.transmitOut(
            newBsAddr,
            deposits,
            new IMockFBeanstalk.SourcePlot[](0),
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );

        // Verify Source deposits.
        {
            (uint256 sourceDepositAmount, uint256 sourceDepositBdv) = bs.getDeposit(
                user,
                C.BEAN,
                beanStem
            );
            require(sourceDepositAmount == 0, "Source bean deposit amt");
            require(sourceDepositBdv == 0, "Source bean deposit bdv");
            (sourceDepositAmount, sourceDepositBdv) = bs.getDeposit(user, C.BEAN_ETH_WELL, lpStem);
            require(
                sourceDepositAmount == lpDepositAmount - migrationAmountLp,
                "Source lp deposit amt"
            );
            require(sourceDepositBdv < lpDepositBdv, "Source lp deposit bdv");
        }
        // Verify Destination deposits.
        {
            uint256[] memory destDepositIds = newBs
                .getTokenDepositsForAccount(user, C.BEAN)
                .depositIds;
            require(destDepositIds.length == 1, "Dest deposit count");
            (address token, int96 stem) = LibBytes.unpackAddressAndStem(destDepositIds[0]);
            (uint256 destinationDepositAmount, uint256 destinationDepositBdv) = newBs.getDeposit(
                user,
                C.BEAN,
                stem
            );
            require(stem < newBs.stemTipForToken(token), "Dest Bean deposit stem too high");
            require(beanDepositAmount == destinationDepositAmount, "Dest Bean deposit amount");
            require(beanDepositBdv == destinationDepositBdv, "Dest Bean deposit bdv");

            destDepositIds = newBs.getTokenDepositsForAccount(user, C.BEAN_ETH_WELL).depositIds;
            require(destDepositIds.length == 1, "Dest deposit count");
            (token, stem) = LibBytes.unpackAddressAndStem(destDepositIds[0]);
            (destinationDepositAmount, destinationDepositBdv) = newBs.getDeposit(
                user,
                C.BEAN_ETH_WELL,
                stem
            );
            require(stem < newBs.stemTipForToken(C.BEAN_ETH_WELL), "Dest lp dep stem too high");
            require(migrationAmountLp == destinationDepositAmount, "Dest lp deposit amount");
            require(0 < destinationDepositBdv, "Dest lp deposit bdv");
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    function test_transmitPlots(uint256 sowAmount) public {
        sowAmount = bound(sowAmount, 100, 1000e6);
        address user = farmers[2];

        uint256 podsPerSow = sowForUser(user, sowAmount);
        uint256 partialAmt = podsPerSow / 3;
        uint256 remainingAmt = podsPerSow - partialAmt;
        sowForUser(user, sowAmount);

        IMockFBeanstalk.SourcePlot[] memory plots = new IMockFBeanstalk.SourcePlot[](2);
        {
            // Initial Migration of a Plot. With index != 0.
            plots[0] = IMockFBeanstalk.SourcePlot(
                SRC_FIELD, // fieldId
                podsPerSow, // plotId
                podsPerSow, // amount
                0 // prevDestIndex
            );
            // Migration of a plot prior to latest transmitted plot.
            plots[1] = IMockFBeanstalk.SourcePlot(
                SRC_FIELD, // fieldId
                0, // plotId
                partialAmt, // amount
                0 // prevDestIndex
            );
        }

        vm.prank(user);
        bs.transmitOut(
            newBsAddr,
            new IMockFBeanstalk.SourceDeposit[](0),
            plots,
            new IMockFBeanstalk.SourceFertilizer[](0),
            abi.encode("")
        );

        // Verify Source plots.
        {
            require(bs.plot(user, SRC_FIELD, 0) == 0, "1st src amt");
            require(bs.plot(user, SRC_FIELD, partialAmt) == remainingAmt, "1.5 src amt");
            require(bs.plot(user, SRC_FIELD, podsPerSow) == 0, "2nd src amt");
            require(bs.plot(ZERO_ADDR, SRC_FIELD, 0) == partialAmt, "1st src null amt");
            require(bs.plot(ZERO_ADDR, SRC_FIELD, partialAmt) == 0, "1.5 src null amt");
            require(bs.plot(ZERO_ADDR, SRC_FIELD, podsPerSow) == podsPerSow, "2nd src null amt");
        }
        // Verify Destination plots.
        {
            require(newBs.plot(user, DEST_FIELD, 0) == partialAmt, "1st dest amt");
            require(newBs.plot(ZERO_ADDR, DEST_FIELD, partialAmt) == remainingAmt, "1.5 dest amt");
            require(newBs.plot(user, DEST_FIELD, podsPerSow) == podsPerSow, "2nd dest amt");
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination fork.
     */
    function test_transmitFertilizer(uint256 ethAmount) public {
        address user = farmers[2];

        uint128 id0 = bs.getEndBpf();
        uint256 fertAmount0 = buyFertForUser(user, ethAmount);
        uint256 transAmount0 = fertAmount0;
        passGermination(); // change the fert id
        uint128 id1 = bs.getEndBpf();
        uint256 fertAmount1 = buyFertForUser(user, ethAmount);
        uint256 transAmount1 = fertAmount1;
        uint256 totalTrans = transAmount0 + transAmount1;

        // Rinsable sprouts at source. Very small to avoid finishing any fert.
        bs.sunSunrise(100, 0);

        uint256 srcInitUnfert = bs.totalUnfertilizedBeans();
        uint256 srcInitActiveFert = bs.getActiveFertilizer();

        IMockFBeanstalk.SourceFertilizer[] memory ferts = new IMockFBeanstalk.SourceFertilizer[](2);
        {
            ferts[0] = IMockFBeanstalk.SourceFertilizer(
                id0, // id
                transAmount0, // amount
                0 // _remainingBpf
            );
            ferts[1] = IMockFBeanstalk.SourceFertilizer(
                id1, // id
                transAmount1, // amount
                0 // _remainingBpf
            );

            // Note that both the source and destination forks use the same Fertilizer contract. This
            // is not how the system is expected to be used, but is a limitation of constants within
            // solidity, particularly in a diamond structure. Ownership limitations of Fertilizer
            // burning and minting are bypassed in MockFertilizer, for testing purposes.

            // Check events for expected burning and minting of Fertilizer.
            vm.expectEmit();
            emit IERC1155.TransferSingle(address(bs), user, ZERO_ADDR, id0, transAmount0);
            vm.expectEmit();
            emit IERC1155.TransferSingle(address(bs), user, ZERO_ADDR, id1, transAmount1);
            vm.expectEmit();
            emit IERC1155.TransferSingle(newBsAddr, ZERO_ADDR, user, id0, transAmount0);
            vm.expectEmit();
            emit IERC1155.TransferSingle(newBsAddr, ZERO_ADDR, user, id1, transAmount1);
        }

        vm.prank(user);
        bs.transmitOut(
            newBsAddr, // Transmit into self
            new IMockFBeanstalk.SourceDeposit[](0),
            new IMockFBeanstalk.SourcePlot[](0),
            ferts,
            abi.encode("")
        );

        // Verify Source fertilizer state.
        {
            require(bs.totalUnfertilizedBeans() < srcInitUnfert, "Src unfert amt");
            require(bs.getActiveFertilizer() == srcInitActiveFert - totalTrans, "Src afert amt");
        }
        // Verify Destination fertilizer.
        {
            require(newBs.getFertilizer(id0) == transAmount0, "Dest fert0 amt");
            require(newBs.getFertilizer(id1) == transAmount1, "Dest fert1 amt");
            require(newBs.totalUnfertilizedBeans() > totalTrans, "Dest unfert");
            require(newBs.getActiveFertilizer() == totalTrans, "Dest fert1 amt");
        }
        // Balance of Fertilizer is unchanged, since both src and dest use the same Fert contract.
        {
            require(fertilizer.balanceOf(user, id0) == fertAmount0, "fert0 amt");
            require(fertilizer.balanceOf(user, id1) == fertAmount1, "fert1 amt");
        }
        // Fert is rinsible at destination.
        {
            uint256[] memory ids = new uint256[](2);
            ids[0] = id0;
            ids[1] = id1;

            // Empty rinse.
            vm.expectEmit();
            emit IMockFBeanstalk.ClaimFertilizer(ids, 0);
            vm.prank(user);
            newBs.claimFertilized(ids, 0);

            // Non empty rinse.
            // This check will fail if a partial fert is transmitted, due to shared Fert contract.
            uint256 mintedBeans = 300e6;
            newBs.sunSunrise(int256(mintedBeans), 0);
            vm.expectEmit();
            emit IERC20.Transfer(address(newBs), user, mintedBeans / 2 - newBs.leftoverBeans());
            vm.prank(user);
            newBs.claimFertilized(ids, 0);
        }
    }

    /**
     * @notice Performs a migration of all asset types from a Source to Destination Beanstalk.
     */
    // function test_transmitAll() public {}
}
