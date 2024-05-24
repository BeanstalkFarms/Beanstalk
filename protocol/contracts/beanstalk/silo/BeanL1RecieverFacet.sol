/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import "contracts/C.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Brean
 * @title
 * @notice Allows beanstalk to recieve data from an L1, specifically to mint beans. see {BeanL2MigrationFacet} for more details.
 **/

contract BeanL1RecieverFacet is ReentrancyGuard {
    // TODO: set bridge
    uint256 constant EXTERNAL_BEANS = 0;

    address constant BRIDGE = address(0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa);

    /**
     * @notice migrates `amount` of Beans to L2,
     * issued to `reciever`.
     */
    function recieveL1Beans(bytes memory data) external nonReentrant {
        (address reciever, uint256 amount) = abi.decode(data, (address, uint256));
        s.migratedL1Beans += amount;
        require(EXTERNAL_BEANS >= s.migratedL1Beans, "L2Migration: exceeds maximum migrated");
        C.bean().mint(reciever, amount);
    }
}
