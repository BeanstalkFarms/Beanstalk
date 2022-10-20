/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../C.sol";
import "./LibAppStorage.sol";

/**
 * @author 0xm00neth
 * @title Lib Permit
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
}