/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {Field} from "contracts/beanstalk/storage/Account.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {MigrationData} from "contracts/beanstalk/storage/System.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {LibBalance} from "contracts/libraries/Token/LibBalance.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {IFertilizer} from "contracts/interfaces/IFertilizer.sol";
import {Order} from "contracts/beanstalk/market/MarketplaceFacet/Order.sol";
import {Listing} from "contracts/beanstalk/market/MarketplaceFacet/Listing.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @author Brean
 * @title
 * @notice Allows Beanstalk to receive data from an L1. see {L2MigrationFacet} for more details.
 * Beanstalk-native assets contract owners can delegate their assets to a receiver address on L2,
 * in order to migrate their deposits, plots, fertilizer, and internal balances to L2.
 **/

contract L1ReceiverFacet is ReentrancyGuard {
    // todo: update with correct external beans once L1 Beanstalk has been paused.
    uint256 constant EXTERNAL_L1_BEANS = 1000000e6;

    address constant BRIDGE = address(0x4200000000000000000000000000000000000007);
    address constant L1BEANSTALK = address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);

    // todo: update with correct merkle roots once once L1 Beanstalk has been paused.
    bytes32 internal constant DEPOSIT_MERKLE_ROOT =
        0xe8c85107aea17dd6d4330a7a996c8ec23d62aa22f3feb4c97cdd5368e1fa756b;
    bytes32 internal constant PLOT_MERKLE_ROOT =
        0x8d60edfd9ab5f687b1d92f441b577b43d2ad8cb22e66779e6c37e3dc3b91f3e1;
    bytes32 internal constant INTERNAL_BALANCE_MERKLE_ROOT =
        0x3b6f4a3ceb1dc34f3a00414b79dcc5c16756093de2e4062e726ec22afd36741c;
    bytes32 internal constant FERTILIZER_MERKLE_ROOT =
        0x6329fea484065f1f62d989fbf443406e3487276c4397ad36e0370f60ffbaa2e5;
    // bytes32 internal constant POD_ORDER_MERKLE_ROOT =
    // 0x4a000e44e0820fdb1ef4194538de1404629221d77e7c920fa8c000ce5902d503;

    uint160 internal constant OFFSET = uint160(0x1111000000000000000000000000000000001111);

    struct L1PodOrder {
        Order.PodOrder podOrder;
        uint256 beanAmount;
    }

    /**
     * @notice emitted when L1 Beans are migrated to L2.
     */
    event L1BeansMigrated(address indexed receiver, uint256 amount, LibTransfer.To toMode);

    /**
     * @notice emitted when an account recieves a deposit(s) from L1.
     */
    event L1DepositsMigrated(
        address indexed owner,
        address indexed receiver,
        uint256[] depositIds,
        uint256[] amounts,
        uint256[] bdvs
    );

    /**
     * @notice emitted when an account recieves a plot(s) from L1.
     */
    event L1PlotsMigrated(
        address indexed owner,
        address indexed receiver,
        uint256[] index,
        uint256[] pods
    );

    /**
     * @notice emitted when an account recieves internal balances from L1.
     */
    event L1InternalBalancesMigrated(
        address indexed owner,
        address indexed receiver,
        address[] tokens,
        uint256[] amounts
    );

    /**
     * @notice emitted when an account recieves fertilizer from L1.
     */
    event L1FertilizerMigrated(
        address indexed owner,
        address indexed receiver,
        uint256[] fertIds,
        uint128[] amounts,
        uint128 lastBpf
    );

    event L1OrdersMigrated(address indexed owner, address indexed receiver, L1PodOrder[] orders);

    /**
     * @notice emitted when an account approves a receiver to receive their assets.
     */
    event ReceiverApproved(address indexed owner, address receiver);

    /**
     * @dev Claims the Grown Stalk for user.
     */
    modifier mowAll() {
        address[] memory tokens = LibWhitelistedTokens.getSiloTokens();
        for (uint256 i; i < tokens.length; i++) {
            LibSilo._mow(LibTractor._user(), tokens[i]);
        }
        _;
    }

    /**
     * @notice migrates `amount` of Beans to L2,
     * issued to `receiver`.
     */
    function recieveL1Beans(
        address receiver,
        uint256 amount,
        LibTransfer.To toMode
    ) external nonReentrant {
        // To check that message came from L1, we check that the sender is the L1 contract's L2 alias.
        require(msg.sender == applyL1ToL2Alias(L1BEANSTALK), "recieveL1Beans only callable by L1");
        s.sys.l2Migration.migratedL1Beans += amount;
        require(
            EXTERNAL_L1_BEANS >= s.sys.l2Migration.migratedL1Beans,
            "L2Migration: exceeds maximum migrated"
        );
        LibTransfer.mintToken(IBean(s.sys.tokens.bean), amount, receiver, toMode);

        emit L1BeansMigrated(receiver, amount, toMode);
    }

    /**
     * @notice approves a receiver to receive the beanstalk native assets of a sender.
     * @dev only able to be called by a bridge contract, or the diamond owner.
     */
    function approveReceiver(address owner, address receiver) external nonReentrant {
        // To check that message came from L1, we check that the sender is
        // 1) the L1 contract's L2 alias (i.e came from the arbitrum bridge)
        // 2) the diamond owner.
        require(
            msg.sender == applyL1ToL2Alias(L1BEANSTALK) || msg.sender == LibDiamond.contractOwner(),
            "L1ReceiverFacet: Invalid Caller"
        );

        s.sys.l2Migration.account[owner].receiver = receiver;

        emit ReceiverApproved(owner, receiver);
    }

    /**
     * @notice issues deposits to `receiver`. Uses a merkle tree in order to verify deposits.
     * @dev global silo variables (`totalDeposited` and `totalDepositedBdv`) do not need to be updated,
     * as the deposits were included in the initial L2 Migration.
     */
    function issueDeposits(
        address owner,
        uint256[] calldata depositIds,
        uint256[] calldata amounts,
        uint256[] calldata bdvs,
        bytes32[] calldata proof
    ) external mowAll nonReentrant {
        MigrationData storage account = s.sys.l2Migration.account[owner];
        address receiver = LibTractor._user();
        require(
            account.receiver != address(0) && account.receiver == receiver,
            "L2Migration: Invalid Receiver"
        );
        require(!account.migratedDeposits, "L2Migration: Deposits have been migrated");

        // verify depositId and amount validity:
        require(
            verifyDepositMerkleProof(owner, depositIds, amounts, bdvs, proof),
            "L2Migration: Invalid deposits"
        );

        // add migrated deposits to the account.
        uint256 stalk = addMigratedDepositsToAccount(receiver, depositIds, amounts, bdvs);

        // increment receiver stalk:
        LibSilo.mintActiveStalk(receiver, stalk);

        // set migrated deposits to true.
        account.migratedDeposits = true;

        emit L1DepositsMigrated(owner, receiver, depositIds, amounts, bdvs);
    }

    /**
     * @notice issues plots to `receiver`. Uses a merkle tree in order to verify plots.
     * @dev global field variables (`totalUnharvested`) do not need to be updated,
     * as the plots were included in the initial L2 Migration.
     */
    function issuePlots(
        address owner,
        uint256[] calldata index,
        uint256[] calldata pods,
        bytes32[] calldata proof
    ) external nonReentrant {
        MigrationData storage account = s.sys.l2Migration.account[owner];
        address receiver = LibTractor._user();
        require(
            account.receiver != address(0) && account.receiver == receiver,
            "L2Migration: Invalid Receiver"
        );
        require(!account.migratedPlots, "L2Migration: Plots have been migrated");

        // verify index and pods validity:
        require(verifyPlotMerkleProof(owner, index, pods, proof), "L2Migration: Invalid plots");

        // add migrated plots to the account.
        addMigratedPlotsToAccount(receiver, index, pods);

        // set migrated plots to true.
        account.migratedPlots = true;
        emit L1PlotsMigrated(owner, receiver, index, pods);
    }

    /**
     * @notice issues InternalBalances to `receiver`. Uses a merkle tree in order to verify balances.
     * @dev global internal balance variables (`internalTokenBalanceTotal`) do not need to be updated,
     * as the internal balances were included in the initial L2 Migration.
     */
    function issueInternalBalances(
        address owner,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata proof
    ) external nonReentrant {
        MigrationData storage account = s.sys.l2Migration.account[owner];
        address receiver = LibTractor._user();
        require(
            account.receiver != address(0) && account.receiver == receiver,
            "L2Migration: Invalid Receiver"
        );
        require(
            !account.migratedInternalBalances,
            "L2Migration: Internal Balances have been migrated"
        );

        // verify internal balances validity:
        require(
            verifyInternalBalanceMerkleProof(owner, tokens, amounts, proof),
            "L2Migration: Invalid internal balances"
        );

        // add migrated internal balances to the account.
        addMigratedInternalBalancesToAccount(receiver, tokens, amounts);

        // set migrated internal balances to true.
        account.migratedInternalBalances = true;
        emit L1InternalBalancesMigrated(owner, receiver, tokens, amounts);
    }

    /**
     * @notice issues Fertilizer to `receiver`. Uses a merkle tree in order to verify fertilizer.
     * @dev global internal balance variables (`fertilizer, unfertilizedIndex`, etc) do not need to be updated,
     * as the internal balances were included in the initial L2 Migration.
     */
    function issueFertilizer(
        address owner,
        uint256[] calldata fertIds,
        uint128[] calldata amounts,
        uint128 lastBpf,
        bytes32[] calldata proof
    ) external nonReentrant {
        MigrationData storage account = s.sys.l2Migration.account[owner];
        address receiver = LibTractor._user();
        require(
            account.receiver != address(0) && account.receiver == receiver,
            "L2Migration: Invalid Receiver"
        );
        require(!account.migratedFert, "L2Migration: Fertilizer have been migrated");

        // verify internal balances validity:
        require(
            verifyFertilizerMerkleProof(owner, fertIds, amounts, lastBpf, proof),
            "L2Migration: Invalid Fertilizer"
        );

        // add migrated internal balances to the account.
        addMigratedFertilizerToAccount(receiver, fertIds, amounts, lastBpf);

        // set migrated internal balances to true.
        account.migratedFert = true;
        emit L1FertilizerMigrated(owner, receiver, fertIds, amounts, lastBpf);
    }

    /**
     * @notice Recreates the PodOrders for contract addresses.
     * @dev Listings are not migrated from contracts (as no bean is
     * locked, and that the listed plot may have been already filled),
     * and will need to be recreated.
     *
     * There are no pod orders owned by contracts, so this function is commented out.
     */
    /*function issuePodOrders(
        address owner,
        L1PodOrder[] memory orders,
        bytes32[] calldata proof
    ) external nonReentrant {
        MigrationData storage account = s.sys.l2Migration.account[owner];
        address receiver = LibTractor._user();
        require(
            account.receiver != address(0) && account.receiver == receiver,
            "L2Migration: Invalid Receiver"
        );
        require(!account.migratedPodOrders, "L2Migration: Orders have been migrated");

        // verify order validity:
        require(verifyOrderProof(owner, orders, proof), "L2Migration: Invalid Order");

        // add migrated orders to account.
        addPodOrders(receiver, orders);

        // set migrated order to true.
        account.migratedPodOrders = true;

        emit L1OrdersMigrated(owner, receiver, orders);
    }
    */

    //////////// MERKLE PROOF VERIFICATION ////////////

    /**
     * @notice verifies the Deposit merkle proof is valid.
     */
    function verifyDepositMerkleProof(
        address owner,
        uint256[] calldata depositIds,
        uint256[] calldata amounts,
        uint256[] calldata bdvs,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(owner, keccak256(abi.encode(owner, depositIds, amounts, bdvs)))
                )
            )
        );
        return MerkleProof.verify(proof, DEPOSIT_MERKLE_ROOT, leaf);
    }

    /**
     * @notice verifies the Plot merkle proof is valid.
     */
    function verifyPlotMerkleProof(
        address owner,
        uint256[] calldata index,
        uint256[] calldata amounts,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(owner, keccak256(abi.encode(owner, index, amounts)))))
        );
        return MerkleProof.verify(proof, PLOT_MERKLE_ROOT, leaf);
    }

    /**
     * @notice verifies the InternalBalance merkle proof is valid.
     */
    function verifyInternalBalanceMerkleProof(
        address owner,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(abi.encode(owner, keccak256(abi.encode(owner, tokens, amounts))))
            )
        );
        return MerkleProof.verify(proof, INTERNAL_BALANCE_MERKLE_ROOT, leaf);
    }

    /**
     * @notice verifies the Fertilizer merkle proof is valid.
     */
    function verifyFertilizerMerkleProof(
        address owner,
        uint256[] calldata fertIds,
        uint128[] calldata amounts,
        uint128 lastBpf,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(owner, keccak256(abi.encode(owner, fertIds, amounts, lastBpf)))
                )
            )
        );
        return MerkleProof.verify(proof, FERTILIZER_MERKLE_ROOT, leaf);
    }

    /*
    // no pod orders owned by contracts, commenting this functionality out
    function verifyOrderProof(
        address owner,
        L1PodOrder[] memory orders,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(owner, keccak256(abi.encode(owner, orders)))))
        );
        return MerkleProof.verify(proof, POD_ORDER_MERKLE_ROOT, leaf);
    }*/

    //////////// MIGRATION HELPERS ////////////

    /**
     * @notice adds the migrated deposits to the account.
     */
    function addMigratedDepositsToAccount(
        address receiver,
        uint256[] calldata depositIds,
        uint256[] calldata amounts,
        uint256[] calldata bdvs
    ) internal returns (uint256 stalk) {
        for (uint i; i < depositIds.length; i++) {
            (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositIds[i]);
            uint256 stalkIssuedPerBdv = s.sys.silo.assetSettings[token].stalkIssuedPerBdv;
            int96 stemTip = LibTokenSilo.stemTipForToken(token);
            LibTokenSilo.addDepositToAccount(
                receiver,
                token,
                stem,
                amounts[i],
                bdvs[i],
                LibTokenSilo.Transfer.emitTransferSingle
            );

            // calculate the stalk assoicated with the deposit and increment.
            stalk += (bdvs[i] * stalkIssuedPerBdv) + (uint256(uint96(stemTip - stem)) * bdvs[i]);
        }
    }

    /**
     * @notice adds the migrated plots to the account.
     * @dev active field is hardcoded here to conform with L1 field id.
     */
    function addMigratedPlotsToAccount(
        address receiver,
        uint256[] calldata index,
        uint256[] calldata pods
    ) internal {
        uint256 activeField = 0;
        Field storage field = s.accts[receiver].fields[activeField];
        for (uint i; i < index.length; i++) {
            field.plots[index[i]] = pods[i];
            field.plotIndexes.push(index[i]);
            field.piIndex[index[i]] = field.plotIndexes.length - 1;
        }
    }

    /**
     * @notice adds the migrated internal balances to the account.
     * Since global internal balances set in ReseedGlobal also reflect smart contract balances,
     * we do not need to update global internal balances here,
     * only balances for the individual account.
     */
    function addMigratedInternalBalancesToAccount(
        address receiver,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) internal {
        for (uint i; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            s.accts[receiver].internalTokenBalance[token] += amounts[i];
            emit LibBalance.InternalBalanceChanged(receiver, token, SafeCast.toInt256(amounts[i]));
        }
    }

    /**
     * @notice adds the migrated Fertilizer to the account.
     */
    function addMigratedFertilizerToAccount(
        address receiver,
        uint256[] calldata fertIds,
        uint128[] calldata amounts,
        uint128 lastBpf
    ) internal {
        for (uint i; i < fertIds.length; i++) {
            IFertilizer(s.sys.tokens.fertilizer).beanstalkMint(
                receiver,
                fertIds[i],
                amounts[i],
                lastBpf
            );
        }
    }

    /**
     * @notice adds the migrated pod orders to the account.
     * @dev `orderer` is updated to the receiver.
     */
    function addPodOrders(address receiver, L1PodOrder[] memory orders) internal {
        for (uint i; i < orders.length; i++) {
            // change orders[i].podOrder.orderer to the receiver.
            orders[i].podOrder.orderer = receiver;

            // calculate new order id from new receiver, and set mapping.
            bytes32 id = _getOrderId(orders[i].podOrder);
            s.sys.podOrders[id] = orders[i].beanAmount;

            emit Order.PodOrderCreated(
                orders[i].podOrder.orderer,
                id,
                orders[i].beanAmount,
                orders[i].podOrder.fieldId,
                orders[i].podOrder.pricePerPod,
                orders[i].podOrder.maxPlaceInLine,
                orders[i].podOrder.minFillAmount
            );

            // note: s.sys.orderLockedBeans is not updated, unlike in `_createPodOrder`,
            // as the reseed has already included these beans in orderLockedBeans.
            // (see {ReseedGlobal.setSilo()})
        }
    }

    function getReceiver(address owner) external view returns (address) {
        return s.sys.l2Migration.account[owner].receiver;
    }

    /**
     * @notice returns the deposit Merkle Root.
     */
    function getDepositMerkleRoot() external pure returns (bytes32) {
        return DEPOSIT_MERKLE_ROOT;
    }

    /**
     * @notice returns the Plot Merkle Root.
     */
    function getPlotMerkleRoot() external pure returns (bytes32) {
        return PLOT_MERKLE_ROOT;
    }

    /**
     * @notice returns the Fertilizer Merkle Root.
     */
    function getFertilizerMerkleRoot() external pure returns (bytes32) {
        return FERTILIZER_MERKLE_ROOT;
    }

    /**
     * @notice returns the Internal Balance Merkle Root.
     */
    function getInternalBalanceMerkleRoot() external pure returns (bytes32) {
        return INTERNAL_BALANCE_MERKLE_ROOT;
    }

    /**
     * @notice Utility function that converts the address in the L1 that submitted a tx to
     * the inbox to the msg.sender viewed in the L2
     * @param l1Address the address in the L1 that triggered the tx to L2
     * @return l2Address L2 address as viewed in msg.sender
     */
    function applyL1ToL2Alias(address l1Address) internal pure returns (address l2Address) {
        unchecked {
            l2Address = address(uint160(l1Address) + OFFSET);
        }
    }

    /*
     * @notice internal orderId
     */
    function _getOrderId(Order.PodOrder memory podOrder) internal pure returns (bytes32 id) {
        return
            keccak256(
                abi.encodePacked(
                    podOrder.orderer,
                    podOrder.fieldId,
                    podOrder.pricePerPod,
                    podOrder.maxPlaceInLine,
                    podOrder.minFillAmount
                )
            );
    }
}
