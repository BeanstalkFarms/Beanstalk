// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {

    constructor (string memory name) ERC1155(name) {}

    function mockMint(address account, uint256 id, uint256 amount) external {
        _mint(account, id, amount, new bytes(0));
    }
}