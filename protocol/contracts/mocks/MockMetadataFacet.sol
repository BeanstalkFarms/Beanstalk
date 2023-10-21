/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/beanstalk/metadata/MetadataImage.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author brean
 * @title MockMetadataFacet is a Mock version of MetadataFacet.
 * @dev used to deploy on testnets to verify that json data and SVG encoding is correct.
 * Steps for testing:
 * 1: deploy MockMetadataFacet
 * 2: deploy MetadataMockERC1155 with the address of the MockMetadataFacet.
 * (MockMetadataFacet with ERC1155 exceeds the contract size limit.)
**/
contract MockMetadataFacet is MetadataImage  {
    using SafeMath for uint256;

    // inital conditions: 2 seeds, 1000 seasons has elapsed from milestone season.
    uint256 public stalkEarnedPerSeason = 2e6;
    uint256 public seasonsElapsed = 1000;
    uint256 public stalkIssuedPerBdv = 10000;

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
        int96 stemTip = int96(stalkEarnedPerSeason.mul(seasonsElapsed));
        bytes memory attributes = abi.encodePacked(
            ', "attributes": [ { "trait_type": "Token", "value": "', getTokenName(token),
            '"}, { "trait_type": "Token Address", "value": "', LibStrings.toHexString(uint256(token), 20),
            '"}, { "trait_type": "Id", "value": "', depositId.toHexString(32),
            '"}, { "trait_type": "stem", "display_type": "number", "value": ', int256(stem).toString(),
            '}, { "trait_type": "inital stalk per BDV", "display_type": "number", "value": ', stalkIssuedPerBdv.toString(),
            '}, { "trait_type": "grown stalk per BDV", "display_type": "number", "value": ', uint256(stemTip - stem).toString(),
            '}, { "trait_type": "stalk grown per BDV per season", "display_type": "number", "value": ', stalkEarnedPerSeason.toString()
        );
        return string(abi.encodePacked("data:application/json;base64,",LibBytes64.encode(abi.encodePacked(
                '{',
                    '"name": "Beanstalk Silo Deposits", "description": "An ERC1155 representing an asset deposited in the Beanstalk Silo. Silo Deposits gain stalk and bean seignorage. ',
                    '\\n\\nDISCLAIMER: Due diligence is imperative when assessing this NFT. Opensea and other NFT marketplaces cache the svg output and thus, may require the user to refresh the metadata to properly show the correct values."',
                    attributes,
                    string(abi.encodePacked('}], "image": "', imageURI(token, stem, stemTip), '"')),
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

    function setSeeds(uint256 _stalkEarnedPerSeason) external {
        stalkEarnedPerSeason = _stalkEarnedPerSeason;
    }

    function setSeasonElapsed(uint256 _seasonsElapsed) external {
        seasonsElapsed = _seasonsElapsed;
    }

    function setStalkIssuedPerBdv(uint256 _stalkIssuedPerBdv) external {
        stalkIssuedPerBdv = _stalkIssuedPerBdv;
    }

}
