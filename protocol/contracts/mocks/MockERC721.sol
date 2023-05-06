// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

/// @title MockERC721
contract MockERC721 is ERC721 {

    constructor() ERC721("Mock", "MOCK") {
    }

    function mockMint(address account, uint256 id) external {
        _mint(account, id);
    }

    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        bytes memory signature
    ) public {
        _approve(spender, tokenId);
    }
}