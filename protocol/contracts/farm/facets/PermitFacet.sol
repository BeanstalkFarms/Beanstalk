/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../Permit.sol";
import "../../libraries/Silo/LibDelegate.sol";

/*
 * @author Publius
 * @title PermitFacet handles the permit.
 */
contract PermitFacet is Permit {
    /**
     * @dev returns current nonce for user
     */
    function nonces(address account) public view returns (uint256) {
        return s.a[account].nonce;
    }

    function getEIP712DomainHash() external view returns (bytes32) {
        return _getEIP712DomainHash();
    }
}
