/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "../../C.sol";
import {LibAppStorage, AppStorage, Storage} from "../LibAppStorage.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibWell, IWell} from "contracts/libraries/Well/LibWell.sol";

/**
 * @title LibWhitelist
 * @author Publius
 * @notice Handles adding and removing ERC-20 tokens from the Silo Whitelist.
 */
library LibWhitelist {
    /**
     * @notice Emitted when a token is added to the Silo Whitelist.
     * @param token ERC-20 token being added to the Silo Whitelist.
     * @param selector The function selector that returns the BDV of a given
     * amount of `token`. Must have signature:
     *
     * ```
     * function bdv(uint256 amount) public view returns (uint256);
     * ```
     *
     * @param stalkEarnedPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalkIssuedPerBdv The Stalk per BDV given from depositing `token`.
     * @param gpSelector The function selector that returns the gauge points of a given token.
     * Must have signature:
     *
     * ```
     * function gpFunction(uint256,uint256,uint256) public view returns (uint256);
     * ```
     *
     * @param gaugePoints The gauge points of the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        bytes4 gpSelector,
        uint128 gaugePoints,
        uint96 optimalPercentDepositedBdv
    );

    event updateGaugeSettings(
        address indexed token,
        bytes4 selector,
        uint96 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the stalk per bdv per season for a Silo token is updated.
     * @param token ERC-20 token being updated in the Silo Whitelist.
     * @param stalkEarnedPerSeason new stalk per bdv per season value for this token.
     * @param season the season that the new stalk per bdv per season value becomes active (The current season).
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );

    /**
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token ERC-20 token being removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    /**
     * @dev Add an ERC-20 token to the Silo Whitelist.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        bytes4 gaugePointSelector,
        uint128 gaugePoints,
        uint96 optimalPercentDepositedBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // verify you passed in a callable BDV selector
        (bool success, ) = address(this).staticcall(
            LibTokenSilo.encodeBdvFunction(token, encodeType, selector, 0)
        );
        require(success, "Whitelist: Invalid BDV selector");
        
        // verify the token is in its corresponding array in {LibWhitelistedTokens}.
        verifyTokenInLibWhitelistedTokens(token);
        
        // verify you passed in a callable gaugePoint Selector.
        verifyGaugeSelector(gaugePointSelector);

        require(s.ss[token].milestoneSeason == 0, "Whitelist: Token already whitelisted");

        s.ss[token].selector = selector;
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; // previously called "seeds"
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; // previously just called "stalk"
        s.ss[token].milestoneSeason = uint32(s.season.current);
        s.ss[token].encodeType = encodeType;
        s.ss[token].gpSelector = gaugePointSelector;
        s.ss[token].gaugePoints = gaugePoints;
        s.ss[token].optimalPercentDepositedBdv = optimalPercentDepositedBdv;

        emit WhitelistToken(
            token,
            selector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Add an ERC-20 token to the Seed Gauge Whitelist.
     * @dev LibWhitelistedTokens.sol must be updated to include the new token.
     */
    function updateGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        uint96 optimalPercentDepositedBdv
    ) internal {
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");
        verifyGaugeSelector(gaugePointSelector);

        ss.gpSelector = gaugePointSelector;
        ss.optimalPercentDepositedBdv = optimalPercentDepositedBdv;
        emit updateGaugeSettings(token, gaugePointSelector, optimalPercentDepositedBdv);
    }

    /**
     * @dev Update the stalk per bdv per season for a token.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(s.ss[token].milestoneSeason != 0, "Token not whitelisted");

        s.ss[token].milestoneStem = LibTokenSilo.stemTipForTokenUntruncated(token); //store grown stalk milestone
        s.ss[token].milestoneSeason = s.season.current; //update milestone season as this season
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;

        emit UpdatedStalkPerBdvPerSeason(token, stalkEarnedPerSeason, s.season.current);
    }

    /**
     * @dev Remove an ERC-20 token from the Silo Whitelist.
     */
    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        delete s.ss[token];

        emit DewhitelistToken(token);
    }

    /**
     * @notice verifies whether the selector is valid for the gauge system.
     */
    function verifyGaugeSelector(bytes4 selector) internal view {
        //verify you passed in a callable gaugePoint selector
        (bool success, ) = address(this).staticcall(abi.encodeWithSelector(selector, 0, 0, 0));
        require(success, "Whitelist: Invalid GaugePoint selector");
    }

    function verifyTokenInLibWhitelistedTokens(address token) internal view {
        // future whitelisted functions will need to be added to the arrays in
        // { LibWhitelistedTokens.sol }
        checkTokenInArray(token, LibWhitelistedTokens.getSiloTokens());

        // if the token is a well, perform additional verification with other 
        // arrays.
         (bool success, ) = address(token).staticcall(
            abi.encodeWithSelector(IWell.well.selector)
        );
        if(success){
            checkTokenInArray(token, LibWhitelistedTokens.getSiloLPTokens());      
            checkTokenInArray(token, LibWhitelistedTokens.getWellLpTokens());        
        }
    }

    function checkTokenInArray(
        address token,
        address[] memory array
    ) private pure {
        // verify that the token is in silo tokens.
        bool success;
        for (uint i; i < array.length; i++) {
            if (token == array[i]) success = true;
        }
        require(success, "Whitelist: Token not in whitelisted token array");
    }
}
