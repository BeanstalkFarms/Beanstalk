/*
/// SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../ReentrancyGuard.sol";
import "../../libraries/LibDelegate.sol";
import "../../libraries/LibPermit.sol";

/**
 * @title DelegateFacet handles delegating authority for Beanstalk functions.
 * @author 0xm00neth
 */
contract DelegateFacet is ReentrancyGuard {
    /// @notice approveDelegate sets approval value for delegation
    /// @param selector function selector
    /// @param approval generic bytes approval value
    function approveDelegate(bytes4 selector, bytes memory approval) external {
        _approveDelegate(msg.sender, selector, approval);
    }

    /// @notice permitDelegate sets function approval using permit
    /// @param account account address
    /// @param selector function selector
    /// @param approval generic bytes approval value
    /// @param deadline permit deadline
    /// @param signature user's permit signature
    function permitDelegate(
        address account,
        bytes4 selector,
        bytes memory approval,
        uint256 deadline,
        bytes memory signature
    ) external {
        require(block.timestamp <= deadline, "DelegateFacet: expired deadline");

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256(
                    "PermitDelegate(address account,bytes4 selector,bytes approval,uint256 nonce,uint256 deadline)"
                ),
                account,
                selector,
                keccak256(abi.encodePacked(approval)),
                LibPermit.useNonce(msg.sig, account),
                deadline
            )
        );

        bytes32 hash = LibPermit._hashTypedDataV4(hashStruct);

        address signer = ECDSA.recover(hash, signature);
        require(signer == account, "DelegateFacet: invalid signature");

        _approveDelegate(account, selector, approval);
    }

    /******************/
    /* VIEW FUNCTIONS */
    /******************/

    /// @notice delegateApproval returns current approval type and data
    /// @param account account address
    /// @param selector function selector
    /// @return approval approval value
    function delegateApproval(address account, bytes4 selector)
        external
        view
        returns (bytes memory approval)
    {
        return LibDelegate.getApproval(account, selector);
    }

    /**********************/
    /* INTERNAL FUNCTIONS */
    /**********************/

    /// @dev sets function approval
    /// @param account account address
    /// @param selector function selector
    /// @param approval generic bytes approval value
    function _approveDelegate(
        address account,
        bytes4 selector,
        bytes memory approval
    ) internal {
        LibDelegate.setApproval(account, selector, approval);
    }
}
