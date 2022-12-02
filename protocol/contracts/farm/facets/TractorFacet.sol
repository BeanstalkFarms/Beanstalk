/// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../ReentrancyGuard.sol";

/// @author m00n
/// @title TractorFacet handles tractor and blueprint operations.
contract TractorFacet is ReentrancyGuard {
    /// @dev Emitted on publishBlueprint()
    /// @param publisher The publisher address
    /// @param predicates Predicates data
    /// @param data Blueprint data
    /// @param calldataCopyParams Blueprint calldata copy params
    event PublishBlueprint(
        address indexed publisher,
        bytes[] predicates,
        bytes data,
        bytes32[] calldataCopyParams
    );

    /// @dev Emitted on destroyBlueprint()
    /// @param blueprintHash Blueprint Hash
    event DestroyBlueprint(bytes32 blueprintHash);

    /// @notice Publish new blueprint
    ///
    /// Emits {PublishBlueprint} event
    ///
    /// @param predicates An array of predicates data
    /// @param data Blueprint data
    /// @param calldataCopyParams Blueprint calldata copy params
    /// @param initialPredicateStates The initial predicate states
    function publishBlueprint(
        bytes[] calldata predicates,
        bytes calldata data,
        bytes32[] calldata calldataCopyParams,
        bytes[] calldata initialPredicateStates
    ) external {
        address publisher = msg.sender;
        Tractor.Blueprint memory blueprint = Tractor.Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });
        bytes32 hash = keccak256(abi.encode(blueprint));
        Tractor.BlueprintState storage bs = s.blueprintStates[hash];

        require(!bs.isActive, "TractorFacet: Blueprint already exist");

        bs.isActive = true;

        uint256 length = initialPredicateStates.length;
        for (uint256 i; i != length; ++i) {
            bytes memory ps = initialPredicateStates[i];
            if (ps.length > 0) {
                bs.predicateStates[i] = ps;
            }
        }

        emit PublishBlueprint(publisher, predicates, data, calldataCopyParams);
    }

    /// @notice Destroy existing blueprint
    ///
    /// Emits {DestroyBlueprint} event
    ///
    /// @param predicates An array of predicates data
    /// @param data Blueprint data
    /// @param calldataCopyParams Blueprint calldata copy params
    function destroyBlueprint(
        bytes[] calldata predicates,
        bytes calldata data,
        bytes32[] calldata calldataCopyParams
    ) external {
        address publisher = msg.sender;
        Tractor.Blueprint memory blueprint = Tractor.Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });
        bytes32 hash = keccak256(abi.encode(blueprint));

        require(
            s.blueprintStates[hash].isActive,
            "TractorFacet: Blueprint does not exist"
        );

        delete s.blueprintStates[hash];

        emit DestroyBlueprint(hash);
    }

    /// @notice View blueprint state
    /// @param publisher Publisher address
    /// @param predicates An array of predicates data
    /// @param data Blueprint data
    /// @param calldataCopyParams Blueprint calldata copy params
    /// @return isActive Boolean flag indicating whether blueprint is active or not
    /// @return predicateStates Current predicate states of the blueprint. Empty if blueprint is not active
    function viewBlueprint(
        address publisher,
        bytes[] calldata predicates,
        bytes calldata data,
        bytes32[] calldata calldataCopyParams
    ) external view returns (bool isActive, bytes[] memory predicateStates) {
        Tractor.Blueprint memory blueprint = Tractor.Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });
        bytes32 hash = keccak256(abi.encode(blueprint));

        Tractor.BlueprintState storage bs = s.blueprintStates[hash];
        isActive = bs.isActive;

        if (isActive) {
            uint256 length = predicates.length;
            predicateStates = new bytes[](length);

            for (uint256 i; i != length; ++i) {
                predicateStates[i] = bs.predicateStates[i];
            }
        }
    }
}
