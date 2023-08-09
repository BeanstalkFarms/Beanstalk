/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./MetadataImage.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";


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
    using LibStrings for int256;

    event URI(string _uri, uint256 indexed _id);

    /**
     * @notice Returns the URI for a given depositId.
     * @param depositId - the id of the deposit
     * @dev the URI is a base64 encoded JSON object that contains the metadata and base64 encoded svg.
     * Deposits are stored as a mapping of a uint256 to a Deposit struct.
     * ERC20 deposits are represented by the concatination of the token address and the stem. (20 + 12 bytes).
     */
    function uri(uint256 depositId) external view returns (string memory) {
        (address token, int96 stem) = LibBytes.unpackAddressAndStem(depositId);
        int96 stemTip = LibTokenSilo.stemTipForToken(token);
        require(token != address(0), "Silo: metadata does not exist");
        bytes memory attributes = abi.encodePacked(
            '\\n\\nToken Symbol: ', getTokenName(token),
            '\\nToken Address: ', LibStrings.toHexString(uint256(token), 20),
            '\\nId: ', depositId.toHexString(32),
            '\\nstem: ', int256(stem).toString(),
            '\\ninital stalk per BDV: ', uint256(LibTokenSilo.stalkIssuedPerBdv(token)).toString(),
            '\\ngrown stalk per BDV: ', uint256(stemTip - stem).toString(),
            '\\nstalk grown per BDV per season: ', uint256(LibTokenSilo.stalkEarnedPerSeason(token)).toString(),
            '\\n\\nDISCLAIMER: Due diligence is imperative when assessing this NFT. Opensea and other NFT marketplaces cache the svg output and thus, may require the user to refresh the metadata to properly show the correct values."'
        );
        return string(abi.encodePacked("data:application/json;base64,",LibBytes64.encode(abi.encodePacked(
                '{',
                    '"name": "Beanstalk Silo Deposits", "description": "An ERC1155 representing an asset deposited in the Beanstalk Silo. Silo Deposits gain stalk and bean seignorage.',
                    attributes,
                    string(abi.encodePacked(', "image": "', imageURI(token, stem, stemTip), '"')),
                '}'
            ))
        ));
    }

    function name() external pure returns (string memory){
        return "Beanstalk Silo Deposits";
    }

    function symbol() external pure returns (string memory){
        return "DEPOSIT";
    }
}
