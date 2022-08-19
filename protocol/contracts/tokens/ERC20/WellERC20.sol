// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanstalkERC20.sol";

contract WellERC20 is BeanstalkERC20 {
    string constant nameSuffix = " Well";
    string constant symbolSuffix = "wl";

    constructor(string memory name, string memory symbol) 
        BeanstalkERC20(
            msg.sender,
            string(abi.encodePacked(name, nameSuffix)),
            string(abi.encodePacked(symbol, symbolSuffix))
        ) {}

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
