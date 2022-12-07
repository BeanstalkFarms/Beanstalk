/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../C.sol";
import "./LibAppStorage.sol";

/**
 * @title Lib Permit
 * @author 0xm00neth
 **/
library LibPermit {
    function useNonce(bytes4 selector, address account) internal returns (uint256 current) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        current = s.a[account].permitNonces[selector];
        ++s.a[account].permitNonces[selector];
    }

    function nonces(bytes4 selector, address account)
        internal
        view
        returns (uint256 current)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        current = s.a[account].permitNonces[selector];
    }

    function getEIP712DomainHash()
        internal
        view
        returns (bytes32 eip712DomainHash)
    {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        eip712DomainHash = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("Beanstalk")),
                keccak256(bytes("1")),
                chainId,
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
        return keccak256(abi.encodePacked("\x19\x01", getEIP712DomainHash(), structHash));
    }
}