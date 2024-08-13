/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";

/**
 * @author Publius
 * @dev Fertilizer tailored implemetation of the ERC-1155 standard.
 * We rewrite transfer and mint functions to allow the balance transfer function be overwritten as well.
 */
contract Fertilizer1155 is ERC1155Upgradeable {
    // using Address for address;

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        address operator = _msgSender();

        _beforeTokenTransfer(
            operator,
            from,
            to,
            __asSingletonArray(id),
            __asSingletonArray(amount),
            data
        );

        _transfer(from, to, id, amount);

        emit TransferSingle(operator, from, to, id, amount);

        __doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            from == _msgSender() || isApprovedForAll(from, _msgSender()),
            "ERC1155: transfer caller is not owner nor approved"
        );

        address operator = _msgSender();

        _beforeTokenTransfer(operator, from, to, ids, amounts, data);

        for (uint256 i; i < ids.length; ++i) {
            _transfer(from, to, ids[i], amounts[i]);
        }

        emit TransferBatch(operator, from, to, ids, amounts);

        __doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }

    function _transfer(address from, address to, uint256 id, uint256 amount) internal virtual {}

    function _safeMint(address to, uint256 id, uint256 amount, bytes memory data) internal virtual {
        require(to != address(0), "ERC1155: mint to the zero address");

        address operator = _msgSender();

        _transfer(address(0), to, id, amount);

        emit TransferSingle(operator, address(0), to, id, amount);

        __doSafeTransferAcceptanceCheck(operator, address(0), to, id, amount, data);
    }

    function _safeBurn(address from, uint256 id, uint256 amount, bytes memory data) internal virtual {
        require(from != address(0), "ERC1155: burn from the zero address");

        address operator = _msgSender();

        _transfer(from, address(0), id, amount);

        emit TransferSingle(operator, from, address(0), id, amount);

        __doSafeTransferAcceptanceCheck(operator, from, address(0), id, amount, data);
    }

    // The 3 functions below are copied from:
    // OpenZeppelin Contracts (last updated v4.6.0) (token/ERC1155/ERC1155.sol)
    // as they are private functions.

    function __doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
        if (LibFertilizer.isContract(to)) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (
                bytes4 response
            ) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function __doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (LibFertilizer.isContract(to)) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data)
            returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function __asSingletonArray(uint256 element) private pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }

    // Following the 1155 design from OpenZeppelin Contracts < 5.x.
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual {}
}
