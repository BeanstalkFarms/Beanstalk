/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import "contracts/C.sol";
import "contracts/beanstalk/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";

/**
 * @author Brean
 * @title L2ContractMigrationFacet enables migration of assets owned by contracts.
 **/
contract L2ContractMigrationFacet is Invariable, ReentrancyGuard {
    using LibBytes for uint256;

    struct AccountInternalBalance {
        address token;
        uint256 amount;
    }

    /**
     * @notice MigrationDepositData is a struct that contains the silo deposits for a given account.
     */
    struct AccountDepositData {
        address token;
        uint256[] depositIds;
        uint128[] amounts;
        uint128[] bdvs;
    }

    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);

    bytes32 private constant MIGRATION_HASHED_NAME = keccak256(bytes("Migration"));
    bytes32 private constant MIGRATION_HASHED_VERSION = keccak256(bytes("1"));
    bytes32 private constant EIP712_TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant REDEEM_DEPOSIT_TYPE_HASH =
        keccak256(
            "redeemDepositsAndInternalBalances(address owner,address reciever,uint256 deadline)"
        );

    // todo: update with the correct merkle root.
    bytes32 private constant MERKLE_ROOT =
        0xa84dc86252c556839dff46b290f0c401088a65584aa38a163b6b3f7dd7a5b0e8;

    /**
     * @notice AddDeposit event is emitted when a deposit is added to the silo. See {TokenSilo.AddDeposit}
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice TransferSingle event is emitted when a transfer is made. See {IERC1155.TransferSingle}
     */
    event TransferSingle(
        address indexed operator,
        address indexed sender,
        address indexed recipient,
        uint256 depositId,
        uint256 amount
    );

    /**
     * @notice allows an contract that owns deposits and bean-asset internal balances to redeem onto an address on L2.
     * @param owner address of the contract on L1.
     * @param reciever address of the contract on L2.
     * @param deposits deposits to redeem.
     * @param internalBalances internal balances to redeem.
     * @param ownerRoots underlying roots of the owner.
     * @param proof proof of ownership.
     * @param deadline deadline for the signature.
     * @param signature signature of the owner.
     * @dev the signature is signed on the L1 blockchain.
     */
    function redeemDepositsAndInternalBalances(
        address owner,
        address reciever,
        AccountDepositData[] calldata deposits,
        AccountInternalBalance[] calldata internalBalances,
        uint256 ownerRoots,
        bytes32[] calldata proof,
        uint256 deadline,
        bytes calldata signature
    ) external payable fundsSafu noSupplyChange nonReentrant {
        // verify deposits are valid.
        // note: if the number of contracts that own deposits is small,
        // deposits can be stored in bytecode rather than relying on a merkle tree.
        verifyDepositsAndInternalBalances(owner, deposits, internalBalances, ownerRoots, proof);

        // signature verification.
        verifySignature(owner, reciever, deadline, signature);

        // set deposits for `reciever`.
        uint256 accountStalk;
        for (uint256 i; i < deposits.length; i++) {
            accountStalk += addMigratedDepositsToAccount(reciever, deposits[i]);
        }

        // set stalk for account.
        setStalk(reciever, accountStalk, ownerRoots);
    }

    /**
     * @notice verfies that the input parameters for deposits
     * are correct.
     */
    function verifyDepositsAndInternalBalances(
        address account,
        AccountDepositData[] calldata deposits,
        AccountInternalBalance[] calldata internalBalances,
        uint256 ownerRoots,
        bytes32[] calldata proof
    ) internal pure {
        bytes32 leaf = keccak256(abi.encode(account, deposits, internalBalances, ownerRoots));
        require(MerkleProof.verify(proof, MERKLE_ROOT, leaf), "Migration: invalid proof");
    }

    /**
     * @notice verifies that the signature came from the owner.
     * @dev the signature is signed on the L1 blockchain.
     * the deposit data itself is not needed, as the signature
     */
    function verifySignature(
        address owner,
        address reciever,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        require(block.timestamp <= deadline, "Migration: permit expired deadline");
        bytes32 structHash = keccak256(
            abi.encode(REDEEM_DEPOSIT_TYPE_HASH, owner, reciever, deadline)
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        require(signer == owner, "Migration: permit invalid signature");
    }

    function addMigratedDepositsToAccount(
        address account,
        AccountDepositData calldata depositData
    ) internal returns (uint256 accountStalk) {
        int96 stemTip = LibTokenSilo.stemTipForToken(depositData.token);
        uint256 stalkIssuedPerBdv = s.sys.silo.assetSettings[depositData.token].stalkIssuedPerBdv;
        uint128 totalBdvForAccount;
        uint128 totalDeposited;
        uint128 totalDepositedBdv;
        for (uint256 i; i < depositData.depositIds.length; i++) {
            // verify that depositId is valid.
            uint256 depositId = depositData.depositIds[i];
            (address depositToken, int96 stem) = depositId.unpackAddressAndStem();
            require(depositToken == depositData.token, "Migration: INVALID_DEPOSIT_ID");
            require(stemTip >= stem, "Migration: INVALID_STEM");

            // add deposit to account.
            s.accts[account].deposits[depositId].amount = depositData.amounts[i];
            s.accts[account].deposits[depositId].bdv = depositData.bdvs[i];

            // increment totalBdvForAccount by bdv of deposit:
            totalBdvForAccount += depositData.bdvs[i];

            // increment by grown stalk of deposit.
            accountStalk += uint96(stemTip - stem) * depositData.bdvs[i];

            // emit events.
            emit AddDeposit(
                account,
                depositData.token,
                stem,
                depositData.amounts[i],
                depositData.bdvs[i]
            );
            emit TransferSingle(msg.sender, address(0), account, depositId, depositData.amounts[i]);
        }

        // update mowStatuses for account and token.
        s.accts[account].mowStatuses[depositData.token].bdv = totalBdvForAccount;
        s.accts[account].mowStatuses[depositData.token].lastStem = stemTip;

        // set global state
        s.sys.silo.balances[depositData.token].deposited = totalDeposited;
        s.sys.silo.balances[depositData.token].depositedBdv = totalDepositedBdv;

        // increment stalkForAccount by the stalk issued per BDV.
        // placed outside of loop for gas effiency.
        accountStalk += stalkIssuedPerBdv * totalBdvForAccount;
    }

    /**
     * @notice increments the stalk and roots for an account.
     */
    function setStalk(address account, uint256 accountStalk, uint256 accountRoots) internal {
        s.accts[account].stalk += accountStalk;
        s.accts[account].roots += accountRoots;

        // emit event.
        emit StalkBalanceChanged(account, int256(accountStalk), int256(accountRoots));
    }

    /**
     * @notice Hashes in an EIP712 compliant way.
     * @dev Returns an Ethereum Signed Typed Data, created from a
     * `domainSeparator` and a `structHash`. This produces hash corresponding
     * to the one signed with the
     * https://eips.ethereum.org/EIPS/eip-712[`eth_signTypedData`]
     * JSON-RPC method as part of EIP-712.
     *
     * Sourced from OpenZeppelin 0.8 ECDSA lib.
     */
    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    /**
     * @notice Returns the domain separator for the current chain.
     */
    function _domainSeparatorV4() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_TYPE_HASH,
                    MIGRATION_HASHED_NAME,
                    MIGRATION_HASHED_VERSION,
                    C.getLegacyChainId(),
                    address(this)
                )
            );
    }
}
