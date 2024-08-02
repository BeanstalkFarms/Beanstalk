// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IWell, Call} from "./IWell.sol";

/**
 * @title IAquifer
 * @author Publius
 * @notice Interface for the Aquifer, a permissionless Well deployer and registry.
 */
interface IAquifer {

    /**
     * @notice Emitted when a Well is deployed.
     * @param well The address of the new Well
     * @param implementation The Well implementation address
     * @param tokens The tokens in the Well
     * @param wellFunction The Well function
     * @param pumps The pumps to bore in the Well
     * @param wellData The Well data to implement into the Well
     */
    event BoreWell(
        address well, address implementation, IERC20[] tokens, Call wellFunction, Call[] pumps, bytes wellData
    );

    /**
     * @notice Deploys a Well.
     * @param implementation The Well implementation to clone.
     * @param immutableData The data to append to the bytecode of the contract.
     * @param initFunctionCall The function call to initialize the Well. Set to empty bytes for no call.
     * @param salt The salt to deploy the Well with (`bytes32(0)` for none). See {LibClone}.
     * @return wellAddress The address of the new Well
     */
    function boreWell(
        address implementation,
        bytes calldata immutableData,
        bytes calldata initFunctionCall,
        bytes32 salt
    ) external returns (address wellAddress);

    /**
     * @notice Returns the implementation that a given Well was deployed with.
     * @param well The Well to get the implementation of
     * @return implementation The address of the implementation of a Well.
     * @dev Always verify that a Well was deployed by a trusted Aquifer using a trusted implementation before using.
     * If `wellImplementation == address(0)`, then the Aquifer did not deploy the Well.
     */
    function wellImplementation(address well) external view returns (address implementation);
}
