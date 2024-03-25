// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6; // FIXME: changed from 0.8.0
pragma abicoder v2;

import "forge-std/Test.sol";

/**
 * @dev common utilities for forge tests
 */
contract Utils is Test {
    address payable[] internal users;

    bytes32 internal nextUser = keccak256(abi.encodePacked("user address"));

    // gets bytecode at specific address (cant use address.code as we're in 0.7.6)
    function getBytecodeAt(address _addr) public view returns (bytes memory o_code) {
        assembly {
            // retrieve the size of the code
            let size := extcodesize(_addr)
            // allocate output byte array
            // by using o_code = new bytes(size)
            o_code := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            // store length in memory
            mstore(o_code, size)
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }

    /// @dev impersonate `from`
    modifier prank(address from) {
        vm.startPrank(from);
        _;
        vm.stopPrank();
    }

    function getNextUserAddress() public returns (address payable) {
        //bytes32 to address conversion
        address payable user = payable(address(uint160(uint256(nextUser))));
        nextUser = keccak256(abi.encodePacked(nextUser));
        return user;
    }

    // create users with 100 ether balance
    function createUsers(uint256 userNum)
        public
        returns (address payable[] memory)
    {
        address payable[] memory _users = new address payable[](userNum);
        for (uint256 i = 0; i < userNum; i++) {
            address payable user = this.getNextUserAddress();
            vm.deal(user, 100 ether);
            _users[i] = user;
        }
        return _users;
    }
}