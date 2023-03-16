/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155Receiver} from "~/interfaces/IERC1155Receiver.sol";
import {IERC1155} from "~/interfaces/IERC1155.sol";
import {LibBytes} from "~/libraries/LibBytes.sol";
import {LibBytes64} from "~/libraries/LibBytes64.sol";
import {LibStrings} from "~/libraries/LibStrings.sol";
import {LibLegacyTokenSilo} from "~/libraries/Silo/LibLegacyTokenSilo.sol";
import {LibTokenSilo} from "~/libraries/Silo/LibTokenSilo.sol";

/**
 * @title MetadataFacet
 * @author Brean
 * @notice MetadataFacet is a contract that provides metadata for beanstalk ERC1155 deposits, 
 * as well as other auxiliary functions related to ERC1155 deposits.
 *
 * 
 */
contract MetadataFacet is IERC1155Receiver {
    using LibStrings for uint256;

    AppStorage internal s;

    /**
     * @dev Emitted when the URI for token type `id` changes to `value`, if it is a non-programmatic URI.
     *
     * If an {URI} event was emitted for `id`, the standard
     * https://eips.ethereum.org/EIPS/eip-1155#metadata-extensions[guarantees] that `value` will equal the value
     * returned by {IERC1155MetadataURI-uri}.
     */
    event URI(string value, uint256 indexed id);

    // for gas effiency, the metadata of an given deposit is not initalized until it is needed. 
    // this is because a new ERC1155 id is created each season, per whitelisted token. 
    // currently, the metadata stoes the token address, the id of the token, and the CumulativeStalkPerBDV.

    function uri(uint256 depositId) external view returns (string memory) {
        Storage.Metadata memory depositMetadata = getDepositMetadata(depositId);
        require(depositMetadata.token != address(0), "Silo: metadata does not exist");
        bytes memory attributes = abi.encodePacked(
            '{',
                '"token address": "', LibStrings.toHexString(uint256(depositMetadata.token), 20),
                '", "id": ', depositMetadata.id.toString(),
                ', "stem": ', uint256(depositMetadata.grownStalkPerBDV).toString(),
                ', "total stalk": ', uint256(LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(depositMetadata.token))).toString(),
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

    function setMetadata(
        uint256 depositId,
        address token, 
        int96 grownStalkPerBDV,
        uint256 id
    ) public returns (bool) {
        require(bytes32(depositId) == LibBytes.packAddressAndCumulativeStalkPerBDV(token,grownStalkPerBDV), "Silo: invalid depositId");
        // currently, deposits only support ERC20, which does not have an ID assoicated with a token.
        // in the future, deposits will support ERC721 and ERC1155 tokens, which will need an ID assoicated.
        // thus, the signature will include the id for future support. 
        Storage.Metadata memory depositMetadata;
        depositMetadata.token = token;
        depositMetadata.id = 0;
        depositMetadata.grownStalkPerBDV = grownStalkPerBDV;
        s.metadata[bytes32(depositId)] = depositMetadata;
        emit URI("", depositId);
        return true;
    }

    function getDepositMetadata(uint256 depositId) public view returns (Storage.Metadata memory) {
        return s.metadata[bytes32(depositId)];
    }
    
    function imageURI() public pure returns (string memory){
        return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzgiIGhlaWdodD0iMzkiIHZpZXdCb3g9IjAgMCAzOCAzOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeT0iMC41MTk1MzEiIHdpZHRoPSIzNy45NjI5IiBoZWlnaHQ9IjM3Ljk2MjkiIHJ4PSIxOC45ODE0IiBmaWxsPSIjM0VCOTRFIi8+CjxwYXRoIGQ9Ik0yNC4zMTM1IDQuNTE5NTNMMTMuMjI5IDM0LjEzMjhDMTMuMjI5IDM0LjEzMjggMC45Mzg4NDIgMTMuMTY2NyAyNC4zMTM1IDQuNTE5NTNaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTUuODA0NyAzMi4yOTU1TDIzLjU5NDIgMTEuMTI3QzIzLjU5NDIgMTEuMTI3IDM3Ljk0OTcgMjIuNzQwNCAxNS44MDQ3IDMyLjI5NTVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=";
    }

    //////////////////////// ERC1155Reciever ////////////////////////

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
