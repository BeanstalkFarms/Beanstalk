/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IERC1155Receiver} from "~/interfaces/IERC1155Receiver.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {LibStrings} from "~/libraries/LibStrings.sol";
import {LibLegacyTokenSilo} from "~/libraries/Silo/LibLegacyTokenSilo.sol";
import "./MetadataImage.sol";

/**
 * @title MetadataFacet
 * @author Brean
 * @notice MetadataFacet is a contract that provides metadata for beanstalk ERC1155 deposits, 
 * as well as other auxiliary functions related to ERC1155 deposits.
 * 
 * @dev Deposits are represented by a uint256, which is the concatination of the token address and the stem.
 * This means that all the nessecary metadata needed for an ERC1155 can be derived from the depositId.
 * However, in the future, when beanstalk accepts ERC721 and ERC1155 deposits,
 * they will be represented by the *hash* of the token address, id, and stem.
 * The functions are designed to be extensible to support this.
 */
contract MetadataFacet is MetadataImage, IERC1155Receiver {
    using LibStrings for uint256;

    /**
    * @notice Metadata stores the metadata for a given Deposit.
    * Deposits are stored as a bytes32, which is the hash of the Deposit's metadata for gas efficency. 
    * In the future, there may be a need for a deposit to have metadata of the deposit. 
    * This struct is used to store that metadata.
    * this metadata is not initalized on deposit, but rather when someone calls "setMetadata" for the first time.
    */
    struct Metadata {
        address token; // the address of the token for a deposit 
        int96 stem; // the grown stalk per BDV assoiated with the deposit
        uint256 id; // the id of the deposit
    }

    /**
     * @dev Emitted when the URI for token type `id` changes to `value`, if it is a non-programmatic URI.
     *
     * If an {URI} event was emitted for `id`, the standard
     * https://eips.ethereum.org/EIPS/eip-1155#metadata-extensions[guarantees] that `value` will equal the value
     * returned by {IERC1155MetadataURI-uri}.
     */
    event URI(string value, uint256 indexed id);

    /**
     * @notice Returns the URI for a given depositId.
     * @param depositId - the id of the deposit
     * @dev the URI is a base64 encoded JSON object that contains the metadata and base64 encoded svg.
     * Deposits are stored as a mapping of a uint256 to a Deposit struct.
     * ERC20 deposits are represented by the concatination of the token address and the stem. (20 + 12 bytes).
     * ERC721 and ERC1155 Deposits (not implmented) will be represented by the *hash* of the token address, id, and stem. (32 bytes).
     */
    function uri(uint256 depositId, address account) external view returns (string memory) {
        Metadata memory depositMetadata = getDepositMetadata(depositId);
        require(depositMetadata.token != address(0), "Silo: metadata does not exist");
        bytes memory attributes = abi.encodePacked(
            '{',
                '"token address": "', LibStrings.toHexString(uint256(depositMetadata.token), 20),
                '", "id": ', depositMetadata.id.toString(),
                ', "stem": ', uint256(depositMetadata.stem).toString(),
                ', "total stalk": ', uint256(LibTokenSilo.stemTipForToken(depositMetadata.token)).toString(),
                ', "seeds per BDV": ', uint256(LibLegacyTokenSilo.getSeedsPerToken(depositMetadata.token)).toString(),
            '}'
        );
        return string(abi.encodePacked("data:application/json;base64,",LibBytes64.encode(abi.encodePacked(
                '{',
                    '"name": "Beanstalk Deposit", ',
                    '"description": "A Beanstalk Deposit", ',
                    string(abi.encodePacked('"image": "', imageURI(depositId, account))),
                    string(abi.encodePacked('", "attributes": ', attributes)),
                '}'
            ))
        ));
    }

    /**
     * @notice returns the metadata of a given depositId.
     * 
     * @dev since the silo only supports ERC20 deposits, the metadata can be derived from the depositId.
     * However, the function is designed with future compatability with ERC721 and ERC1155 deposits in mind.
     */
    function getDepositMetadata(uint256 depositId) public pure returns (Metadata memory) {
        Metadata memory depositMetadata;
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositId);
        depositMetadata.token = token;
        depositMetadata.id = depositId;
        depositMetadata.stem = stem;
        return depositMetadata;
    }

    //////////////////////// ERC1155Reciever ////////////////////////

    /**
     * @notice ERC1155Reciever function that allows the silo to receive ERC1155 tokens.
     * 
     * @dev as ERC1155 deposits are not accepted yet, 
     * this function will send the tokens back to the sender.
     */
    function onERC1155Received(
        address,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        IERC1155(msg.sender).safeTransferFrom(address(this), from, id, value, data);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /**
     * @notice onERC1155BatchReceived function that allows the silo to receive ERC1155 tokens.
     * 
     * @dev as ERC1155 deposits are not accepted yet, 
     * this function will send the tokens back to the sender.
     */
    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        IERC1155(msg.sender).safeBatchTransferFrom(address(this), from, ids, values, data);
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
