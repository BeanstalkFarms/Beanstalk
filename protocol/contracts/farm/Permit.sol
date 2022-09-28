// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "./AppStorage.sol";
import "./ReentrancyGuard.sol";

/**
 * @author Beanstalk Farms
 * @title Variation of Oepn Zeppelins reentrant guard to include Silo Update
 **/
contract Permit is ReentrancyGuard {
    /**
     * @dev "Consume a nonce": return the current value and increment.
     */
    function _useNonce(address account) internal returns (uint256 current) {
        current = s.a[account].nonce++;
    }

    function _getEIP712DomainHash() internal view returns (bytes32 eip712DomainHash) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        eip712DomainHash = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("Beanstalk")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }
}
