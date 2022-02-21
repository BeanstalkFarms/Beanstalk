/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibLiquity.sol';
import './LiquityManager.sol';

/**
 * @author Beasley
 * @title Create contract which manages user's trove
**/

contract TroveFactory {

	event TroveCreated(address indexed account, address trove);

	function createTroveContract(address account) internal returns (address trove) {
		require(account != address(0), "LiquityFactory: Invalid creation account");
		bytes32 salt = keccak256(abi.encodePacked(account));
		bytes memory bytecode = type(LiquityManager).creationCode;
		assembly {
			trove := create2(0, add(bytecode, 32), mload(bytecode), salt)
			if iszero(extcodesize(trove)) {
				revert(0, 0)
			}
		}

		emit TroveCreated(account, trove);
	}
}
