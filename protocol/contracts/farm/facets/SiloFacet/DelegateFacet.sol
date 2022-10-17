/*
/// SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../Permit.sol";
import "../../../libraries/Silo/LibDelegate.sol";

/// @author Publius
/// @title DelegateFacet handles delegating authority for Beanstalk functions.
contract DelegateFacet is Permit {
    /// @notice approveDelegate sets approval value for delegation
    /// @param selector function selector
    /// @param delegatee contract/EOA address to delegate to
    /// @param approval generic bytes approval data
    function approveDelegate(
        bytes4 selector,
        address delegatee,
        bytes memory approval
    ) external {
        _approveDelegate(msg.sender, selector, delegatee, approval);
    }

    /// @notice permitDelegate sets function approval using permit
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee contract/EOA address to delegate to
    /// @param approval generic bytes approval data
    /// @param deadline permit deadline
    /// @param signature user's permit signature
    function permitDelegate(
        address account,
        bytes4 selector,
        address delegatee,
        bytes memory approval,
        uint256 deadline,
        bytes memory signature
    ) external {
        require(block.timestamp <= deadline, "DelegateFacet: expired deadline");

        bytes32 eip712DomainHash = _getEIP712DomainHash();

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256(
                    "PermitDelegate(address account,bytes4 selector,address delegatee,bytes approval,uint256 nonce,uint256 deadline)"
                ),
                account,
                selector,
                delegatee,
                keccak256(abi.encodePacked(approval)),
                _useNonce(account),
                deadline
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", eip712DomainHash, hashStruct)
        );

        address signer = ECDSA.recover(hash, signature);
        require(signer == account, "DelegateFacet: invalid signature");

        _approveDelegate(account, selector, delegatee, approval);
    }

    //////////////////////////////////////
    /////////// VIEW FUNCTIONS ///////////
    //////////////////////////////////////

    /// @notice delegateApproval returns current approval type and data
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee delegatee address
    /// @return approval approval value
    function delegateApproval(
        address account,
        bytes4 selector,
        address delegatee
    ) external view returns (bytes memory approval) {
        return LibDelegate.getApproval(account, selector, delegatee);
    }

    //////////////////////////////////////
    ///////// INTERNAL FUNCTIONS /////////
    //////////////////////////////////////

    /// @dev sets function approval
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee delegatee address
    /// @param approval generic bytes approval data
    function _approveDelegate(
        address account,
        bytes4 selector,
        address delegatee,
        bytes memory approval
    ) internal {
        LibDelegate.setApproval(account, selector, delegatee, approval);
    }
}
