/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibLegacyTokenSilo} from "contracts/libraries/Silo/LibLegacyTokenSilo.sol";
import "./MetadataImage.sol";


/**
 * @title MetadataFacet
 * @author Brean
 * @notice MetadataFacet is a contract that provides metadata for beanstalk ERC1155 deposits, 
 * as well as other auxiliary functions related to ERC1155 deposits.
 * 
 * @dev Deposits are represented by a uint256, which is the concatination of the token address and the stem.
 */
contract MetadataFacet is MetadataImage {
    using LibStrings for uint256;

    struct Metadata {
        address token; // the address of the token for a deposit 
        int96 stem; // the grown stalk per BDV assoiated with the deposit
        uint256 id; // the id of the deposit
    }

    /**
     * @notice Returns the URI for a given depositId.
     * @param depositId - the id of the deposit
     * @dev the URI is a base64 encoded JSON object that contains the metadata and base64 encoded svg.
     * Deposits are stored as a mapping of a uint256 to a Deposit struct.
     * ERC20 deposits are represented by the concatination of the token address and the stem. (20 + 12 bytes).
     */
    function uri(uint256 depositId) external view returns (string memory) {
        Metadata memory depositMetadata = getDepositMetadata(depositId);
        require(depositMetadata.token != address(0), "Silo: metadata does not exist");
        bytes memory attributes = abi.encodePacked(
            '\n\nToken Symbol: ', getTokenName(depositMetadata.token),
            '\nToken Address: ', LibStrings.toHexString(uint256(depositMetadata.token), 20),
            '\nId: ', depositMetadata.id.toHexString(32),
            '\nDeposit stem: ', uint256(depositMetadata.stem).toString(),
            '\nDeposit stalk per BDV": ', uint256(LibTokenSilo.stemTipForToken(depositMetadata.token)).toString(),
            '\nDeposit seeds per BDV": ', uint256(LibLegacyTokenSilo.getSeedsPerToken(depositMetadata.token)).toString(),
            '\n\nDISCLAIMER: Due diligence is imperative when assessing this NFT. Opensea and other NFT marketplaces cache the svg output and thus, may require the user to refresh the metadata to properly show the correct values."'
        );
        return string(abi.encodePacked("data:application/json;base64,",LibBytes64.encode(abi.encodePacked(
                '{',
                    '"name": "Beanstalk Deposit", "description": "A Beanstalk Deposit.',
                    attributes,
                    string(abi.encodePacked(', "image": "', imageURI(depositId), '"')),
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
    function getDepositMetadata(uint256 depositId) public pure returns (Metadata memory depositMetadata) {
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositId);
        depositMetadata.token = token;
        depositMetadata.id = depositId;
        depositMetadata.stem = stem;
        return depositMetadata;
    }
}
