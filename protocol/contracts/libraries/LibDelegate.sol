/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../C.sol";
import "./LibAppStorage.sol";
import "./LibBytes.sol";

/**
 * @title Lib Delegate
 * @author 0xm00neth
 **/
library LibDelegate {
    using SafeMath for uint256;

    /// @notice approval type enum
    enum Type {
        BOOLEAN,
        UINT256,
        EXTERNAL
    }

    /************/
    /* Delegate */
    /************/

    /// @notice getApproval returns approval value
    /// @param account account address
    /// @param selector function selector
    /// @return approval generic bytes approval value
    function getApproval(address account, bytes4 selector)
        internal
        view
        returns (bytes memory approval)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        approval = s.a[account].functionApprovals[selector];
    }

    /// @notice setApproval sets approval value
    /// @param account account address
    /// @param selector function selector
    /// @param approval generic bytes approval value
    function setApproval(
        address account,
        bytes4 selector,
        bytes memory approval
    ) internal {
        require(approval.length >= 3, "LibDelegate: Invalid Approval");

        bytes1 place = extractApprovalPlace(approval);
        bytes1 approvalType = extractApprovalType(approval);
        require(
            place == 0x00 || place == 0x01,
            "LibDelegate: Invalid Approval Place"
        );
        require(
            isBooleanType(approvalType) ||
                isUint256Type(approvalType) ||
                isExternalType(approvalType),
            "LibDelegate: Invalid Approval Type"
        );

        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].functionApprovals[selector] = approval;
    }

    /// @notice getApprovalDetails returns approval place, type and data
    /// @param account account address
    /// @param selector function selector
    /// @return place bytes1 value representing where to perform check approval; pre/post approval
    /// @return approvalType byte1 value representing approval type
    /// @return approvalData bytes value representing approval data
    function getApprovalDetails(address account, bytes4 selector)
        internal
        view
        returns (
            bytes1 place,
            bytes1 approvalType,
            bytes memory approvalData
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bytes memory approval = s.a[account].functionApprovals[selector];
        (place, approvalType, approvalData) = extractApprovalDetails(approval);
    }

    /// @notice extractApprovalDetails extracts approval place, type and data from approval value
    /// @dev 1st byte represents place, 2nd byte represents approvalType, rest represents approvalData
    ///      place = approval[0]
    ///      approvalType = approval[1]
    ///      approvalData = approval[2:]
    /// @param approval generic bytes approval value
    /// @return place bytes1 value representing where to perform check approval; pre/post silo action
    /// @return approvalType byte1 value representing approval type
    /// @return approvalData bytes value representing approval data
    function extractApprovalDetails(bytes memory approval)
        internal
        pure
        returns (
            bytes1 place,
            bytes1 approvalType,
            bytes memory approvalData
        )
    {
        require(approval.length >= 3, "LibDelegate: Invalid Approval");
        place = extractApprovalPlace(approval);
        approvalType = extractApprovalType(approval);
        approvalData = extractApprovalData(approval);
    }

    /// @notice extractApprovalPlace extracts approval place from approval value
    /// @dev 1st byte represents place
    ///      place = approval[0]
    /// @param approval generic bytes approval value
    /// @return place bytes1 value representing where to perform check approval; pre/post silo action
    function extractApprovalPlace(bytes memory approval)
        internal
        pure
        returns (bytes1 place)
    {
        place = approval[0];
    }

    /// @notice extractApprovalType extracts approval type from approval value
    /// @dev 2nd byte represents approvalType
    ///      approvalType = approval[1]
    /// @param approval generic bytes approval value
    /// @return approvalType byte1 value representing approval type
    function extractApprovalType(bytes memory approval)
        internal
        pure
        returns (bytes1 approvalType)
    {
        approvalType = approval[1];
    }

    /// @notice extractApprovalData extracts approval data from approval value
    /// @dev approvalData = approval[2:]
    /// @param approval generic bytes approval value
    /// @return approvalData bytes value representing approval data
    function extractApprovalData(bytes memory approval)
        internal
        pure
        returns (bytes memory approvalData)
    {
        require(approval.length >= 3, "LibDelegate: Empty Approval Data");
        approvalData = LibBytes.sliceFrom(approval, 2);
    }

    /// @notice checkApproval checks approval with given info
    /// @param account user address
    /// @param selector function selector
    /// @param caller caller address
    /// @param place approval place
    /// @param approvalType approval type
    /// @param approvalData approval data
    /// @param callData call data
    /// @param returnData return data
    function checkApproval(
        address account,
        bytes4 selector,
        address caller,
        bytes1 place,
        bytes1 approvalType,
        bytes memory approvalData,
        bytes memory callData,
        bytes memory returnData
    ) internal {
        if (isBooleanType(approvalType)) {
            _checkBooleanApproval(caller, approvalData);
        } else if (isUint256Type(approvalType)) {
            _checkUint256Approval(
                account,
                selector,
                caller,
                place,
                approvalType,
                approvalData,
                returnData
            );
        } else if (isExternalType(approvalType)) {
            _checkExternalApproval(
                account,
                selector,
                caller,
                place,
                approvalType,
                approvalData,
                callData,
                returnData
            );
        } else {
            revert("LibDelegate: Invalid Approval Type");
        }
    }

    /// @notice _checkBooleanApproval checks approval with given info
    /// @param caller caller address
    /// @param approvalData approval data
    function _checkBooleanApproval(
        address caller,
        bytes memory approvalData
    ) internal pure {
        (address expectedCaller, bool approve) = abi.decode(
            approvalData,
            (address, bool)
        );
        _checkCaller(caller, expectedCaller);

        require(approve, "LibDelegate: Unauthorized");
    }

    /// @notice _checkUint256Approval checks approval with given info
    /// @param account user address
    /// @param selector function selector
    /// @param caller caller address
    /// @param place approval place
    /// @param approvalType approval type
    /// @param approvalData approval data
    /// @param returnData return data
    function _checkUint256Approval(
        address account,
        bytes4 selector,
        address caller,
        bytes1 place,
        bytes1 approvalType,
        bytes memory approvalData,
        bytes memory returnData
    ) internal {
        (address expectedCaller, uint256 allowance) = abi.decode(
            approvalData,
            (address, uint256)
        );
        _checkCaller(caller, expectedCaller);

        uint256 spend = abi.decode(returnData, (uint256));
        if (spend > 0) {
            allowance -= spend;
            bytes memory newApproval = abi.encodePacked(
                place,
                approvalType,
                abi.encode(expectedCaller, allowance)
            );
            setApproval(account, selector, newApproval);
        }
    }

    /// @notice _checkExternalApproval checks approval with given info
    /// @param account user address
    /// @param selector function selector
    /// @param caller caller address
    /// @param place approval place
    /// @param approvalType approval type
    /// @param approvalData approval data
    /// @param callData call data
    /// @param returnData return data
    function _checkExternalApproval(
        address account,
        bytes4 selector,
        address caller,
        bytes1 place,
        bytes1 approvalType,
        bytes memory approvalData,
        bytes memory callData,
        bytes memory returnData
    ) internal {
        (
            address externalContract,
            bytes memory stateData
        ) = abi.decode(approvalData, (address, bytes));

        (bool success, bytes memory returnValue) = externalContract.staticcall(
            abi.encodeWithSignature(
                "check(address,bytes,bytes,bytes)",
                caller,
                callData,
                returnData,
                stateData
            )
        );
        require(success, "LibDelegate: Unauthorized");

        returnValue = abi.decode(returnValue, (bytes));
        (bool approve, bytes memory newStateData) = abi.decode(
            returnValue,
            (bool, bytes)
        );
        require(approve, "LibDelegate: Unauthorized");

        if (
            stateData.length != newStateData.length ||
            keccak256(stateData) != keccak256(newStateData)
        ) {
            setApproval(
                account,
                selector,
                abi.encodePacked(
                    place,
                    approvalType,
                    abi.encode(externalContract, newStateData)
                )
            );
        }
    }

    /// @notice _checkCaller checks if the caller is approved
    /// @param caller caller address
    /// @param expectedCaller expected caller address
    function _checkCaller(address caller, address expectedCaller)
        internal
        pure
    {
        require(
            expectedCaller == address(0) || expectedCaller == caller,
            "LibDelegate: Unauthorized Caller"
        );
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
}
