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
 * The Facet implmentation may need to change depending on the L2 that the beanstalk DAO chooses to migrate to.
 **/

interface IL2Messenger {
    function xDomainMessageSender() external view returns (address);
}

contract BeanL1RecieverFacet is ReentrancyGuard {
    uint256 constant EXTERNAL_L1_BEANS = 0;

    address constant BRIDGE = address(0x4200000000000000000000000000000000000007);
    address constant L1BEANSTALK = address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5);

    /**
     * @notice migrates `amount` of Beans to L2,
     * issued to `reciever`.
     */
    function recieveL1Beans(address reciever, uint256 amount) external nonReentrant {
        // verify msg.sender is the cross-chain messenger address, and
        // the xDomainMessageSender is the L1 Beanstalk contract.
        require(
            msg.sender == address(BRIDGE) &&
                IL2Messenger(BRIDGE).xDomainMessageSender() == L1BEANSTALK
        );
        s.sys.migration.migratedL1Beans += amount;
        require(
            EXTERNAL_L1_BEANS >= s.sys.migration.migratedL1Beans,
            "L2Migration: exceeds maximum migrated"
        );
        C.bean().mint(reciever, amount);
    }
}
