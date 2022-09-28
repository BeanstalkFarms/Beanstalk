/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../Nonce.sol";
import "../../../libraries/Silo/LibDelegate.sol";

/*
 * @author Publius
 * @title DelegateFacet handles delegating authority for Beanstalk functions.
 */
contract DelegateFacet is Nonce {
    /**
     * @notice approveDelegate sets approval value for delegation
     * @param selector function selector
     * @param delegatee contract/EOA address to delegate to
     * @param approval approval value bytes32 of uint256 or bool
     */
    function approveDelegate(
        bytes4 selector,
        address delegatee,
        bytes32 approval
    ) external {
        _approveDelegate(msg.sender, selector, delegatee, approval);
    }

    /// @notice permitDelegate sets function approval using permit
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee contract/EOA address to delegate to
    /// @param approval approval value bytes32 of uint256 or bool
    /// @param deadline permit deadline
    /// @param signature user's permit signature
    function permitDelegate(
        address account,
        bytes4 selector,
        address delegatee,
        bytes32 approval,
        uint256 deadline,
        bytes memory signature
    ) external {
        require(block.timestamp <= deadline, "DelegateFacet: expired deadline");

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        bytes32 eip712DomainHash = keccak256(
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

        bytes32 hashStruct = keccak256(
            abi.encode(
                keccak256(
                    "PermitDelegate(address account,bytes4 selector,address delegatee,bytes32 approval,uint256 nonce,uint256 deadline)"
                ),
                account,
                selector,
                delegatee,
                approval,
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

    /**
     * @notice delegateAllowance returns current allowance
     * @param account account address
     * @param selector function selector
     * @param delegatee delegatee address
     * @return allowance current allowance
     */
    function delegateAllowance(
        address account,
        bytes4 selector,
        address delegatee
    ) external view returns (uint256 allowance) {
        allowance = LibDelegate.getAllowance(account, selector, delegatee);
    }

    //////////////////////////////////////
    ///////// INTERNAL FUNCTIONS /////////
    //////////////////////////////////////

    /**
     * @dev sets function approval
     * @param account account address
     * @param selector function selector
     * @param delegatee delegatee address
     */
    function _approveDelegate(
        address account,
        bytes4 selector,
        address delegatee,
        bytes32 approval
    ) internal {
        LibDelegate.setAllowance(account, selector, delegatee, approval);
    }
}
