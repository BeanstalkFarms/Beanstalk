/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title Whitelist Facet 
 * @notice Manages the Silo Whitelist including Adding to, Updating 
 * and Removing from the Silo Whitelist
 **/
contract WhitelistFacet {

    /**
     * @notice Emitted when a token is Whitelisted into the Silo.
     * @param token Address of the token that was Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv
    );

    /**
     * @notice Emitted whenever the `stalkEarnedPerSeason` changes for a token.
     * @param token Address of the token that the `stalkEarnedPerSeason` is updated for.
     * @param stalkEarnedPerSeason The new amount of Stalk earned per Season for each Deposited BDV.
     * @param season The Season that the new `stalkEarnedPerSeason` comes into effect. 
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );

    /**
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token Address of the token that was removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    /**
     * @notice Removes a token from the Silo Whitelist.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function dewhitelistToken(address token) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.dewhitelistToken(token);
    }

    /**
     * @notice Adds a token to the Silo Whitelist.
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @dev 
     * Can only be called by Beanstalk or Beanstalk owner.
     * Assumes an `encodeType` of 0.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            0x00
        );
    }

    /**
     * @notice Adds a token to the Silo Whitelist with an `encodeType`
     * @param token Address of the token that is being Whitelisted.
     * @param selector The function selector that is used to calculate the BDV of the token.
     * @param stalkIssuedPerBdv The amount of Stalk issued per BDV on Deposit.
     * @param stalkEarnedPerSeason The amount of Stalk earned per Season for each Deposited BDV.
     * @param encodeType The encode type that should be used to encode the BDV function call. See {LibTokenSilo.beanDenominatedValue}.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function whitelistTokenWithEncodeType(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.whitelistToken(
            token,
            selector,
            stalkIssuedPerBdv,
            stalkEarnedPerSeason,
            encodeType
        );
    }

    /**
     * @notice Updates the Stalk Per BDV Per Season for a given Token
     * @param token Address of the token that is being Whitelisted.
     * @param stalkEarnedPerSeason The new amount of Stalk earned per Season for each Deposited BDV.
     * @dev Can only be called by Beanstalk or Beanstalk owner.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) external payable {
        LibDiamond.enforceIsOwnerOrContract();
        LibWhitelist.updateStalkPerBdvPerSeasonForToken(
            token,
            stalkEarnedPerSeason
        );
    }
}
