/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../ReentrancyGuard.sol";
import "../../libraries/LibDelegate.sol";
import "../../libraries/LibPermit.sol";

/*
 * @author Publius
 * @title PermitFacet handles the permit.
 */
contract PermitFacet is ReentrancyGuard {
    /**
     * @dev returns current nonce for user
     * @param selector permit function selector
     * @param account account address
     * @return current permit nonce
     */
    function nonces(bytes4 selector, address account)
        external
        view
        returns (uint256 current)
    {
        return LibPermit.nonces(selector, account);
    }

    /**
     * @notice getEIP712DomainHash returns domain hash
     * @return domainHash
     */
    function getEIP712DomainHash() external view returns (bytes32) {
        return LibPermit.getEIP712DomainHash();
    }
}
