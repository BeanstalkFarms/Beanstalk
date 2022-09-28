/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../Nonce.sol";
import "../../libraries/Silo/LibDelegate.sol";

/*
 * @author Publius
 * @title NonceFacet handles the account nonce.
 */
contract NonceFacet is Nonce {
    /**
     * @dev returns current nonce for user
     */
    function nonces(address account) public view returns (uint256) {
        return s.a[account].nonce;
    }
}
