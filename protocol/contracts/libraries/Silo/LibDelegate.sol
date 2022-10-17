/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @author Publius
 * @title Lib Delegate
 **/
library LibDelegate {
    using SafeMath for uint256;

    /// @notice approval type enum
    enum Type {
        BOOLEAN,
        UINT256,
        EXTERNAL
    }

    /**
     * Delegate
     **/

    /// @notice getApproval returns approval data
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee delegatee address
    /// @return approval generic bytes approval data
    function getApproval(
        address account,
        bytes4 selector,
        address delegatee
    ) internal view returns (bytes memory approval) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        approval = s.a[account].functionApprovals[selector][delegatee];
    }

    /// @notice setApproval sets approval data
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee delegatee address
    /// @param approval generic bytes approval data
    function setApproval(
        address account,
        bytes4 selector,
        address delegatee,
        bytes memory approval
    ) internal {
        (
            bytes1 approvalType,
            bytes memory approvalValue
        ) = extractApprovalDetails(approval);
        require(
            isBooleanType(approvalType) ||
                isUint256Type(approvalType) ||
                isExternalType(approvalType),
            "LibDelegate: Invalid Approval Type"
        );

        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].functionApprovals[selector][delegatee] = approval;
    }

    /// @notice getApprovalDetails returns approval type and value
    /// @param account account address
    /// @param selector function selector
    /// @param delegatee delegatee address
    /// @return approvalType byte1 value representing approval type
    /// @return approvalValue bytes value representing approval value
    function getApprovalDetails(
        address account,
        bytes4 selector,
        address delegatee
    ) internal view returns (bytes1 approvalType, bytes memory approvalValue) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bytes memory approval = s.a[account].functionApprovals[selector][
            delegatee
        ];
        (approvalType, approvalValue) = extractApprovalDetails(approval);
    }

    /// @notice extractApprovalDetails extracts approval type and value from approval data
    /// @dev first byte represents approvalType, rest represents approvalValue
    ///      approvalType = approval[0]
    ///      approvalValue = approval[1:]
    /// @param approval generic bytes approval data
    /// @return approvalType byte1 value representing approval type
    /// @return approvalValue bytes value representing approval value
    function extractApprovalDetails(bytes memory approval)
        internal
        pure
        returns (bytes1 approvalType, bytes memory approvalValue)
    {
        require(approval.length > 0, "LibDelegate: Empty Approval");
        approvalType = approval[0];
        approvalValue = slice(approval, 1, approval.length - 1);
        require(approvalValue.length > 0, "LibDelegate: Empty Approval Value");
    }

    /// @notice isBooleanType checks if approval type is boolean approval
    /// @param approvalType approvalType value
    function isBooleanType(bytes1 approvalType) internal pure returns (bool) {
        return uint8(approvalType) == uint8(Type.BOOLEAN);
    }

    /// @notice isUint256Type checks if approval type is uint256 approval
    /// @param approvalType approvalType value
    function isUint256Type(bytes1 approvalType) internal pure returns (bool) {
        return uint8(approvalType) == uint8(Type.UINT256);
    }

    /// @notice isExternalType checks if approval type is external call approval
    /// @param approvalType approvalType value
    function isExternalType(bytes1 approvalType) internal pure returns (bool) {
        return uint8(approvalType) == uint8(Type.EXTERNAL);
    }

    /// @notice slices bytes memory
    /// @param _bytes bytes array
    /// @param _start start index to slice from
    /// @param _length slice length
    /// @return sliced bytes
    function slice(
        bytes memory _bytes,
        uint256 _start,
        uint256 _length
    ) internal pure returns (bytes memory) {
        require(_length + 31 >= _length, "slice_overflow");
        require(_bytes.length >= _start + _length, "slice_outOfBounds");

        bytes memory tempBytes;

        assembly {
            switch iszero(_length)
            case 0 {
                tempBytes := mload(0x40)

                let lengthmod := and(_length, 31)

                let mc := add(
                    add(tempBytes, lengthmod),
                    mul(0x20, iszero(lengthmod))
                )
                let end := add(mc, _length)

                for {
                    let cc := add(
                        add(
                            add(_bytes, lengthmod),
                            mul(0x20, iszero(lengthmod))
                        ),
                        _start
                    )
                } lt(mc, end) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    mstore(mc, mload(cc))
                }

                mstore(tempBytes, _length)

                mstore(0x40, and(add(mc, 31), not(31)))
            }
            default {
                tempBytes := mload(0x40)
                mstore(tempBytes, 0)

                mstore(0x40, add(tempBytes, 0x20))
            }
        }

        return tempBytes;
    }
}
