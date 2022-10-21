/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibPermit.sol";

/**
 * @author Publius
 * @title Lib Silo Permit
 **/
library LibSiloPermit {

    bytes32 private constant DEPOSIT_PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,address token,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant DEPOSITS_PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,address[] tokens,uint256[] values,uint256 nonce,uint256 deadline)");

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
        bytes32 structHash = keccak256(abi.encode(DEPOSIT_PERMIT_TYPEHASH, owner, spender, token, value, LibPermit.useNonce(msg.sig, owner), deadline));
        bytes32 hash = LibPermit._hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "Silo: permit invalid signature");
    }

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
        bytes32 structHash = keccak256(abi.encode(DEPOSITS_PERMIT_TYPEHASH, owner, spender, keccak256(abi.encodePacked(tokens)), keccak256(abi.encodePacked(values)), LibPermit.useNonce(msg.sig, owner), deadline));
        bytes32 hash = LibPermit._hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "Silo: permit invalid signature");
    }
}