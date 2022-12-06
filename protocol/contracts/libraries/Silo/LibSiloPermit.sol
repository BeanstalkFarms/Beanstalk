/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Silo Permit
 * @notice Set Silo Deposit allowance with permits.
 * 
 * @dev Permits must be signed off-chain.
 * See https://github.com/BeanstalkFarms/Beanstalk/blob/d2a9a232f50e1d474d976a2e29488b70c8d19461/protocol/utils/permit.js
 * for details on signing Silo Deposit permits.
 * 
 **/
library LibSiloPermit {

    bytes32 private constant DEPOSIT_PERMIT_HASHED_NAME = keccak256(bytes("SiloDeposit"));
    bytes32 private constant DEPOSIT_PERMIT_HASHED_VERSION = keccak256(bytes("1"));
    bytes32 private constant DEPOSIT_PERMIT_EIP712_TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant DEPOSIT_PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,address token,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant DEPOSITS_PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,address[] tokens,uint256[] values,uint256 nonce,uint256 deadline)");

    /**
     * @dev Permits `spender` to spend `value` of `token` Deposits on behalf of `owner`.
     * Only perits signed using the current nonce returned by {nonces} will be approved.
     * Sign permit with {signSiloDepositTokenPermit} found here:
     * https://github.com/BeanstalkFarms/Beanstalk/blob/d2a9a232f50e1d474d976a2e29488b70c8d19461/protocol/utils/permit.js
     */
    function permit(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        require(block.timestamp <= deadline, "Silo: permit expired deadline");
        bytes32 structHash = keccak256(abi.encode(DEPOSIT_PERMIT_TYPEHASH, owner, spender, token, value, _useNonce(owner), deadline));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "Silo: permit invalid signature");
    }

    /**
     * @dev Permits `spender` to spend `values` of multiple `tokens` Deposits on behalf of `owner`.
     * Sign permit with {signSiloDepositTokensPermit} found here:
     * https://github.com/BeanstalkFarms/Beanstalk/blob/master/protocol/utils/permit.js
     * 
     */
    function permits(
        address owner,
        address spender,
        address[] memory tokens,
        uint256[] memory values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        require(block.timestamp <= deadline, "Silo: permit expired deadline");
        bytes32 structHash = keccak256(abi.encode(DEPOSITS_PERMIT_TYPEHASH, owner, spender, keccak256(abi.encodePacked(tokens)), keccak256(abi.encodePacked(values)), _useNonce(owner), deadline));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "Silo: permit invalid signature");
    }

    /**
     * @dev Returns the current `nonce` for `owner`.
     * Use the current nonce to sign permits.
     */
    function nonces(address owner) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[owner].depositPermitNonces;
    }

    /**
     * @dev Returns and increments the current `nonce` for `owner`.
     */
    function _useNonce(address owner) internal returns (uint256 current) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        current = s.a[owner].depositPermitNonces;
        ++s.a[owner].depositPermitNonces;
    }

    /**
     * @dev Returns the domain separator for the current chain.
     */
    function _domainSeparatorV4() internal view returns (bytes32) {
        return _buildDomainSeparator(DEPOSIT_PERMIT_EIP712_TYPE_HASH, DEPOSIT_PERMIT_HASHED_NAME, DEPOSIT_PERMIT_HASHED_VERSION);
    }

    /**
     * @dev See {_domainSeparatorV4}.
     */
    function _buildDomainSeparator(bytes32 typeHash, bytes32 name, bytes32 version) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                typeHash,
                name,
                version,
                C.getChainId(),
                address(this)
            )
        );
    }

    /**
     * @dev Given an already https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct[hashed struct], this
     * function returns the hash of the fully encoded EIP712 message for this domain.
     *
     * This hash can be used together with {ECDSA-recover} to obtain the signer of a message. For example:
     *
     * ```solidity
     * bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
     *     keccak256("Mail(address to,string contents)"),
     *     mailTo,
     *     keccak256(bytes(mailContents))
     * )));
     * address signer = ECDSA.recover(digest, signature);
     * ```
     */
    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }
}