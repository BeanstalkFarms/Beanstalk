/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ReentrancyGuard} from "contracts/beanstalk/migration/L1ReentrancyGuard.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";

/**
 * @author Brean
 * @title L2MigrationFacet
 * @notice Allows 1) farmers with external bean balances and 2) contracts with native bean assets to migrate onto L2.
 * @dev When migrating to an L2, given a majority of bean assets reside in the diamond contract,
 * Beanstalk is able to send these assets to an L2. Beanstalk does not have control of Bean or Wells
 * where tokens are paired with Beans. Given beanstalk cannot receive these assets, as well as a potenital
 * double-spend if Beanstalk were to mint external beans to these users (where a user is able to sell their
 * L1 Beans for value), Beanstalk allows Farmers who hold Beans to 1) Burn their Beans on L1 and 2) Issue the
 * same amount on L2.
 *
 * Beanstalk also allows contracts that own Beanstalk assets to approve an address on L2 to recieve their assets.
 * Beanstalk cannot mint Beanstalk assets to an contract on L2, as it cannot assume that the owner of the contract
 * has access to the same address on L2.
 *
 **/

interface IL1RecieverFacet {
    function recieveL1Beans(address reciever, uint256 amount, LibTransfer.To toMode) external;

    function approveReciever(address owner, address reciever) external;
}

interface IInbox {
    function createRetryableTicket(
        address to,
        uint256 callValue,
        uint256 maxSubmissionCost,
        address excessFeeRefundAddress,
        address callValueRefundAddress,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable returns (uint256);
}

contract L2MigrationFacet is ReentrancyGuard {
    // Arbitrum Delayed inbox.
    address constant BRIDGE = address(0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f);
    address constant L1_BEAN = address(0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab);

    event RetryableTicketCreated(uint256 indexed ticketId);

    /**
     * @notice migrates `amount` of Beans to L2,
     * issued to `reciever`.
     */
    function migrateL2Beans(
        address reciever,
        address L2Beanstalk,
        uint256 amount,
        LibTransfer.To toMode,
        uint256 maxSubmissionCost,
        uint256 maxGas,
        uint256 gasPriceBid
    ) external payable nonReentrant returns (uint256 ticketID) {
        // burn the migrated beans.
        IBean(L1_BEAN).burnFrom(msg.sender, amount);

        bytes memory data = abi.encodeCall(
            IL1RecieverFacet(L2Beanstalk).recieveL1Beans,
            (reciever, amount, toMode)
        );

        // send data to L2Beanstalk via the bridge.
        ticketID = IInbox(BRIDGE).createRetryableTicket{value: msg.value}(
            L2Beanstalk,
            0,
            maxSubmissionCost,
            reciever, // excessFeeRefundAddress
            msg.sender,
            maxGas,
            gasPriceBid,
            data
        );

        emit RetryableTicketCreated(ticketID);
        return ticketID;
    }

    /**
     * @notice allows a contract to approve an address on L2 to recieve their Beanstalk assets.
     * @dev Beanstalk cannot assume that owners of a contract are able to have access to the same address on L2.
     * Thus, contracts that own Beanstalk Assets must approve an address on L2 to recieve their assets.
     */
    function approveL2Reciever(
        address reciever,
        address L2Beanstalk,
        uint256 maxSubmissionCost,
        uint256 maxGas,
        uint256 gasPriceBid
    ) external payable nonReentrant returns (uint256 ticketID) {
        // verify msg.sender is a contract.
        require(hasCode(msg.sender), "L2MigrationFacet: must be a contract");
        require(reciever != address(0), "L2MigrationFacet: invalid reciever");

        bytes memory data = abi.encodeCall(
            IL1RecieverFacet(L2Beanstalk).approveReciever,
            (msg.sender, reciever)
        );

        // send data to L2Beanstalk via the bridge.
        ticketID = IInbox(BRIDGE).createRetryableTicket{value: msg.value}(
            L2Beanstalk,
            0,
            maxSubmissionCost,
            receiver, // excessFeeRefundAddress
            msg.sender,
            maxGas,
            gasPriceBid,
            data
        );

        emit RetryableTicketCreated(ticketID);
        return ticketID;
    }

    /**
     * @notice checks whether an address has code.
     */
    function hasCode(address _addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_addr)
        }
        return size > 0;
    }
}
