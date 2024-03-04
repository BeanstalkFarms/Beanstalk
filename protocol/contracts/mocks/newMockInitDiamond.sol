/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {InitalizeDiamond} from "contracts/beanstalk/init/InitalizeDiamond.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title MockInitDiamond 
 * @notice MockInitDiamond initializes the Beanstalk Diamond.
 * @dev MockInitDiamond additionally: 
 * - Sets the barn raise well. 
 * - Whitelists unripe assets.
**/
contract MockInitDiamond is InitalizeDiamond {

    uint32 constant INIT_UR_BEAN_STALK_EARNED_PER_SEASON = 0;

    /**
     * @param initalizeUnripe if true, initalizes the unripe assets.
     */
    function init(
        bool initalizeUnripe
    ) external {
        // initalize the default state of the diamond.
        // {see. InitalizeDiamond.initalizeDiamond()}
        initalizeDiamond(C.BEAN, C.BEAN_ETH_WELL);

        if(initalizeUnripe) {
            initalizeUnripeAssets();
        }
    }

    function initalizeUnripeAssets() internal {
        (
            address[] memory unripeTokens, 
            address[] memory underlyingTokens
        ) = getInitalUnripeAndUnderlyingTokens();

        // set the underlying unripe tokens.
        setUnderlyingUnripe(
            unripeTokens,
            underlyingTokens,
            underlyingTokens[1]
        );
        
        // whitelist the unripe assets into the silo.
        whitelistUnripeAssets(
            unripeTokens,
            initalUnripeSiloSettings()
        );
    }

    /**
     * @notice whitelists unripe assets.
     */
    function whitelistUnripeAssets(
        address[] memory tokens,
        Storage.SiloSettings[] memory siloSettings
    ) internal {
        for(uint i; i < tokens.length; i++) {
            // sets the silo settings for each token.
            s.ss[tokens[i]] = siloSettings[i];
            // note: unripeLP is not an LP token (only the underlying is)
            LibWhitelistedTokens.addWhitelistStatus(
                tokens[i],
                true, // is whitelisted,
                false,
                false
            );
        }
    }

    /**
     * @notice sets the underlying tokens for unripe. 
     */
    function setUnderlyingUnripe(
        address[] memory unripeToken,
        address[] memory underlyingToken,
        address barnRaiseWell
    ) internal {
        // sets the underlying unripe for unripe assets.
        for(uint i; i < unripeToken.length; i++) {
            LibUnripe.switchUnderlyingToken(unripeToken[i], underlyingToken[i]);
        }

        // sets the barn raise token to the underlying of the unripe LP.
        s.barnRaiseWell = barnRaiseWell;
    }

    /**
     * @notice initalizes the unripe silo settings.
     * @dev unripe bean and unrpe lp has the same settings,
     * other than the BDV calculation.
     */
    function initalUnripeSiloSettings() internal view returns (
        Storage.SiloSettings[] memory siloSettings
    ){
        siloSettings[0] = Storage.SiloSettings({
                selector: BDVFacet.unripeLPToBDV.selector,
                stalkEarnedPerSeason: INIT_UR_BEAN_STALK_EARNED_PER_SEASON,
                stalkIssuedPerBdv: INIT_STALK_EARNED_PER_SEASON,
                milestoneSeason: s.season.current,
                milestoneStem: 0,
                encodeType: 0x00,
                deltaStalkEarnedPerSeason: 0,
                gpSelector: bytes4(0),
                lwSelector: bytes4(0),
                gaugePoints: 0,
                optimalPercentDepositedBdv: 0
            });
        
        siloSettings[1] = siloSettings[0]; 
        siloSettings[1].selector = BDVFacet.unripeLPToBDV.selector;
    }

    /**
     * @notice returns the inital unripe and underlying tokens.
     */
    function getInitalUnripeAndUnderlyingTokens() internal pure returns (
        address[] memory unripeTokens,
        address[] memory underlyingTokens
    ) {
        unripeTokens[0] = C.UNRIPE_BEAN;
        unripeTokens[1] = C.UNRIPE_LP;
        underlyingTokens[0] = C.BEAN;
        underlyingTokens[1] = C.BEAN_WSTETH_WELL; 
    }
}