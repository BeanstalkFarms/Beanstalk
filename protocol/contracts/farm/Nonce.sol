// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "./AppStorage.sol";
import "./ReentrancyGuard.sol";

/**
 * @author Beanstalk Farms
 * @title Variation of Oepn Zeppelins reentrant guard to include Silo Update
 **/
contract Nonce is ReentrancyGuard {
    /**
     * @dev "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address account) internal returns (uint256 current) {
        current = s.a[account].nonce++;
    }
}
