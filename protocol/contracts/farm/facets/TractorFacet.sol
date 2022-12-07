/// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../ReentrancyGuard.sol";
import "../../libraries/LibBytes.sol";
import "../../libraries/LibFarm.sol";

/**
 * @title TractorFacet handles tractor and blueprint operations.
 * @author 0xm00neth
 */
contract TractorFacet is ReentrancyGuard {
    /*********/
    /* Enums */
    /*********/

    /// @notice Blueprint type enum
    enum BlueprintType {
        NORMAL,
        ADVANCED
    }

    /**********/
    /* Events */
    /**********/

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

    /// @dev Emitted on tractor()
    /// @param operator The operator address
    /// @param blueprintHash Blueprint Hash
    event Tractor(address indexed operator, bytes32 blueprintHash);

    /******************/
    /* User Functions */
    /******************/

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
        // get publisher address
        address publisher = msg.sender;

        // create Blueprint instantce
        Blueprint memory blueprint = Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });

        // get blueprint hash
        bytes32 hash = keccak256(abi.encode(blueprint));

        // load blueprint state from storage
        BlueprintState storage bs = s.blueprintStates[hash];

        // blueprint must be inactive
        require(!bs.isActive, "TractorFacet: Blueprint already exist");

        // mark blueprint as active
        bs.isActive = true;

        // store initial predicate states for blueprint
        uint256 length = initialPredicateStates.length;
        for (uint256 i; i != length; ++i) {
            bytes memory ps = initialPredicateStates[i];
            if (ps.length > 0) {
                bs.predicateStates[i] = ps;
            }
        }

        // emits event
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
        // get publisher address
        address publisher = msg.sender;

        // create Blueprint instantce
        Blueprint memory blueprint = Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });

        // get blueprint hash
        bytes32 hash = keccak256(abi.encode(blueprint));

        // blueprint must be active
        require(
            s.blueprintStates[hash].isActive,
            "TractorFacet: Blueprint does not exist"
        );

        // destroy blueprint
        delete s.blueprintStates[hash];

        // emits event
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
        // create Blueprint instantce
        Blueprint memory blueprint = Blueprint({
            publisher: publisher,
            predicates: predicates,
            data: data,
            calldataCopyParams: calldataCopyParams
        });

        // get blueprint hash
        bytes32 hash = keccak256(abi.encode(blueprint));

        // get blueprint state
        BlueprintState storage bs = s.blueprintStates[hash];
        isActive = bs.isActive;

        // if blueprint is active, get current predicate states
        if (isActive) {
            uint256 length = predicates.length;
            predicateStates = new bytes[](length);

            for (uint256 i; i != length; ++i) {
                predicateStates[i] = bs.predicateStates[i];
            }
        }
    }

    /// @notice View blueprint state
    /// @param blueprintHash Blueprint hash
    /// @return isActive Boolean flag indicating whether blueprint is active or not
    function viewBlueprint(bytes32 blueprintHash)
        external
        view
        returns (bool isActive)
    {
        return s.blueprintStates[blueprintHash].isActive;
    }

    function tractor(Blueprint memory blueprint, bytes calldata callData)
        external
    {
        // get hash for blueprint
        bytes32 hash = keccak256(abi.encode(blueprint));

        // get blueprint state
        BlueprintState storage bs = s.blueprintStates[hash];

        // gheck if blueprint is active
        require(bs.isActive, "TractorFacet: Blueprint is not active");

        // extract blueprint type and data from blueprint.data
        bytes1 blueprintType;
        bytes memory blueprintData;
        {
            blueprintData = blueprint.data;
            bytes1 blueprintType = blueprintData[0];

            // copy callData
            uint256 length = blueprint.calldataCopyParams.length;
            for (uint256 i; i != length; ++i) {
                // bytes32 copyParams
                // [ 2 bytes | 10 bytes  |  10 bytes  | 10 bytes ]
                // [   N/A   | copyIndex | pasteIndex |  length  ]
                bytes32 copyParams = blueprint.calldataCopyParams[i];
                uint80 copyIndex = uint80(uint256((copyParams << 16) >> 176));
                uint80 pasteIndex = uint80(uint256((copyParams << 96) >> 176));
                uint80 length = uint80(uint256((copyParams << 176) >> 176));

                if (copyIndex == type(uint80).max) {
                    LibFunction.paste32Bytes(
                        abi.encodePacked(msg.sender),
                        blueprintData,
                        0,
                        pasteIndex
                    );
                } else {
                    LibFunction.pasteBytes(
                        callData,
                        blueprintData,
                        copyIndex,
                        pasteIndex,
                        length
                    );
                }
            }

            blueprintData = LibBytes.sliceFrom(blueprintData, 1);
        }

        bytes[] memory results;

        if (uint8(blueprintType) == uint8(BlueprintType.NORMAL)) {
            // decode farm calldata
            bytes[] memory data = abi.decode(blueprintData, (bytes[]));

            // call farm function
            results = new bytes[](data.length);
            for (uint256 i; i != data.length; ++i) {
                results[i] = LibFarm.farmMem(data[i]);
            }
        } else if (uint8(blueprintType) == uint8(BlueprintType.ADVANCED)) {
            // decode farm calldata
            LibFarm.AdvancedData[] memory data = abi.decode(
                blueprintData,
                (LibFarm.AdvancedData[])
            );

            // call advancedFarm function
            results = new bytes[](data.length);
            for (uint256 i = 0; i < data.length; ++i) {
                results[i] = LibFarm.advancedFarmMem(data[i], results);
            }
        } else {
            revert("TractorFacet: Unknown blueprint type");
        }

        // emits event
        emit Tractor(msg.sender, hash);
    }
}
