/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {LibBytes} from "~/libraries/LibBytes.sol";
import {LibBytes64} from "~/libraries/LibBytes64.sol";
import {LibStrings} from "~/libraries/LibStrings.sol";
import {LibLegacyTokenSilo} from "~/libraries/Silo/LibLegacyTokenSilo.sol";
import {LibTokenSilo} from "~/libraries/Silo/LibTokenSilo.sol";

/**
 * @title MetadataFacet
 * @author brean
 * @notice MetadataFacet is a contract that provides metadata for beanstalk ERC1155 deposits, 
 * as well as other auxiliary functions related to ERC1155 deposits.
 * 
 * @dev Deposits are represented by a uint256, which is the concatination of the token address and the stem.
 * This means that all the nessecary metadata needed for an ERC1155 can be derived from the depositId.
 * However, in the future, when beanstalk accepts ERC721 and ERC1155 deposits,
 * they will be represented by the *hash* of the token address, id, and stem.
 * The functions are designed to be extensible to support this.
 */
contract MetadataFacet {
    using LibStrings for uint256;

    AppStorage internal s;

    /**
     * @notice Returns the URI for a given depositId.
     * @param depositId - the id of the deposit
     * @dev the URI is a base64 encoded JSON object that contains the metadata and base64 encoded svg.
     * Deposits are stored as a mapping of a uint256 to a Deposit struct.
     * ERC20 deposits are represented by the concatination of the token address and the stem. (20 + 12 bytes).
     * ERC721 and ERC1155 Deposits (not implmented) will be represented by the *hash* of the token address, id, and stem. (32 bytes).
     */
    function uri(uint256 depositId) external view returns (string memory) {
        Storage.Metadata memory depositMetadata = getDepositMetadata(depositId);
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
                    string(abi.encodePacked('"image": "', imageURI())),
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
    function getDepositMetadata(uint256 depositId) public pure returns (Storage.Metadata memory) {
        Storage.Metadata memory depositMetadata;
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositId);
        depositMetadata.token = token;
        depositMetadata.id = depositId;
        depositMetadata.stem = stem;
        return depositMetadata;
    }
    
    /**
     * @notice returns the imageURI for a given depositId.
     */
    function imageURI() public pure returns (string memory){
        return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzgiIGhlaWdodD0iMzkiIHZpZXdCb3g9IjAgMCAzOCAzOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeT0iMC41MTk1MzEiIHdpZHRoPSIzNy45NjI5IiBoZWlnaHQ9IjM3Ljk2MjkiIHJ4PSIxOC45ODE0IiBmaWxsPSIjM0VCOTRFIi8+CjxwYXRoIGQ9Ik0yNC4zMTM1IDQuNTE5NTNMMTMuMjI5IDM0LjEzMjhDMTMuMjI5IDM0LjEzMjggMC45Mzg4NDIgMTMuMTY2NyAyNC4zMTM1IDQuNTE5NTNaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTUuODA0NyAzMi4yOTU1TDIzLjU5NDIgMTEuMTI3QzIzLjU5NDIgMTEuMTI3IDM3Ljk0OTcgMjIuNzQwNCAxNS44MDQ3IDMyLjI5NTVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=";
    }
}
