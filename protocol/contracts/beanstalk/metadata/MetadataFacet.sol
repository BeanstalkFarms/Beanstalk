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
        require(token != address(0), "Silo: metadata does not exist");
        bytes memory attributes = abi.encodePacked(
            '\n\nToken Symbol: ', getTokenName(token),
            '\nToken Address: ', LibStrings.toHexString(uint256(token), 20),
            '\nId: ', depositId.toHexString(32),
            '\nDeposit stem: ', int256(stem).toString(),
            '\nDeposit inital stalk per BDV: ', uint256(LibTokenSilo.stalkIssuedPerBdv(token)).toString(),
            '\nDeposit grown stalk per BDV": ', uint256(LibTokenSilo.stemTipForToken(token) - stem).toString(),
            '\nDeposit seeds per BDV": ', uint256(LibLegacyTokenSilo.getSeedsPerToken(token)).toString(),
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

    function name() external pure returns (string memory){
        return "Beanstalk Deposit";
    }

    function symbol() external pure returns (string memory){
        return "BS-DEP";
    }
}
