/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import "contracts/beanstalk/init/InitalizeDiamond.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibWhitelist} from "contracts/libraries/Silo/LibWhitelist.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title MockInitDiamond
 * @notice MockInitDiamond initializes the Beanstalk Diamond.
 * @dev MockInitDiamond additionally:
 * - Sets the barn raise well.
 * - Whitelists the bean:wsteth well.
 * - Whitelists unripe assets.
 **/
contract MockInitDiamond is InitalizeDiamond {
    // min 1micro stalk earned per season due to germination.
    uint32 constant INIT_UR_BEAN_STALK_EARNED_PER_SEASON = 1;
    uint32 constant INIT_BEAN_WSTETH_WELL_STALK_EARNED_PER_SEASON = 4e6;
    uint128 constant INIT_TOKEN_WURLP_POINTS = 100e18;
    uint32 constant INIT_BEAN_WURLP_PERCENT_TARGET = 50e6;

    function init() external {
        // initalize the default state of the diamond.
        // {see. InitalizeDiamond.initalizeDiamond()}
        initalizeDiamond(C.BEAN, C.BEAN_ETH_WELL);

        // initalizes unripe assets.
        // sets the underlying LP token of unripeLP to the Bean:wstETH well.
        address underlyingUrLPWell = C.BEAN_WSTETH_WELL;
        whitelistUnderlyingUrLPWell(underlyingUrLPWell);
        initalizeUnripeAssets(underlyingUrLPWell);
    }

    function initalizeUnripeAssets(address well) internal {
        (
            address[] memory unripeTokens,
            address[] memory underlyingTokens
        ) = getInitalUnripeAndUnderlyingTokens(well);

        // set the underlying unripe tokens.
        setUnderlyingUnripe(unripeTokens, underlyingTokens, underlyingTokens[1]);
        // whitelist the unripe assets into the silo.
        whitelistUnripeAssets(unripeTokens, initalUnripeAssetSettings());
    }

    /**
     * @notice whitelists unripe assets.
     */
    function whitelistUnripeAssets(
        address[] memory tokens,
        AssetSettings[] memory assetSettings
    ) internal {
        for (uint i; i < tokens.length; i++) {
            // sets the silo settings for each token.
            s.sys.silo.assetSettings[tokens[i]] = assetSettings[i];
            // note: unripeLP is not an LP token (only the underlying is)
            LibWhitelistedTokens.addWhitelistStatus(
                tokens[i],
                true, // is whitelisted,
                false,
                false,
                false // is soppable
            );
        }
    }

    /**
     * @notice sets the underlying tokens for unripe.
     * @dev assumes the last unripe token is the unripe LP.
     */
    function setUnderlyingUnripe(
        address[] memory unripeToken,
        address[] memory underlyingToken,
        address barnRaiseWell
    ) internal {
        // sets the underlying unripe for unripe assets.
        for (uint i; i < unripeToken.length; i++) {
            LibUnripe.switchUnderlyingToken(unripeToken[i], underlyingToken[i]);
        }

        // sets the barn raise token to the underlying of the unripe LP.
        s
            .sys
            .silo
            .unripeSettings[unripeToken[underlyingToken.length - 1]]
            .underlyingToken = barnRaiseWell;
    }

    /**
     * @notice initalizes the unripe silo settings.
     * @dev unripe bean and unrpe lp has the same settings,
     * other than the BDV calculation.
     */
    function initalUnripeAssetSettings()
        internal
        view
        returns (AssetSettings[] memory assetSettings)
    {
        Implementation memory impl = Implementation(address(0), bytes4(0), bytes1(0));
        Implementation memory liquidityWeightImpl = Implementation(
            address(0),
            ILiquidityWeightFacet.maxWeight.selector,
            bytes1(0)
        );
        Implementation memory gaugePointImpl = Implementation(
            address(0),
            IGaugePointFacet.defaultGaugePointFunction.selector,
            bytes1(0)
        );
        Implementation memory oracleImpl = Implementation(address(0), bytes4(0), bytes1(0));

        assetSettings = new AssetSettings[](2);
        assetSettings[0] = AssetSettings({
            selector: BDVFacet.unripeBeanToBDV.selector,
            stalkEarnedPerSeason: INIT_UR_BEAN_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.sys.season.current,
            milestoneStem: 0,
            encodeType: 0x00,
            deltaStalkEarnedPerSeason: 0,
            gaugePoints: 0,
            optimalPercentDepositedBdv: 0,
            gaugePointImplementation: gaugePointImpl,
            liquidityWeightImplementation: liquidityWeightImpl,
            oracleImplementation: oracleImpl
        });
        assetSettings[1] = AssetSettings({
            selector: BDVFacet.unripeLPToBDV.selector,
            stalkEarnedPerSeason: INIT_UR_BEAN_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.sys.season.current,
            milestoneStem: 0,
            encodeType: 0x00,
            deltaStalkEarnedPerSeason: 0,
            gaugePoints: 0,
            optimalPercentDepositedBdv: 0,
            gaugePointImplementation: gaugePointImpl,
            liquidityWeightImplementation: liquidityWeightImpl,
            oracleImplementation: oracleImpl
        });
    }

    /**
     * @notice returns the initial unripe and underlying tokens.
     */
    function getInitalUnripeAndUnderlyingTokens(
        address underlyingUrLPWell
    ) internal pure returns (address[] memory unripeTokens, address[] memory underlyingTokens) {
        unripeTokens = new address[](2);
        underlyingTokens = new address[](2);
        unripeTokens[0] = C.UNRIPE_BEAN;
        unripeTokens[1] = C.UNRIPE_LP;
        underlyingTokens[0] = C.BEAN;
        underlyingTokens[1] = underlyingUrLPWell;
    }

    /**
     * @notice if unripe assets are being whitelisted, the underlying
     * well must be whitelisted.
     */
    function whitelistUnderlyingUrLPWell(address well) internal {
        // whitelist bean:stETH well
        Implementation memory impl = Implementation(address(0), bytes4(0), bytes1(0));
        // note: no error checking:
        s.sys.silo.assetSettings[well] = AssetSettings({
            selector: BDVFacet.wellBdv.selector,
            stalkEarnedPerSeason: INIT_BEAN_WSTETH_WELL_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.sys.season.current,
            milestoneStem: 0,
            encodeType: 0x01,
            deltaStalkEarnedPerSeason: 0,
            gaugePoints: INIT_TOKEN_WURLP_POINTS,
            optimalPercentDepositedBdv: INIT_BEAN_WURLP_PERCENT_TARGET,
            gaugePointImplementation: Implementation(
                address(0),
                IGaugePointFacet.defaultGaugePointFunction.selector,
                bytes1(0)
            ),
            liquidityWeightImplementation: Implementation(
                address(0),
                ILiquidityWeightFacet.maxWeight.selector,
                bytes1(0)
            ),
            oracleImplementation: impl
        });

        // updates the optimal percent deposited for bean:eth.
        LibWhitelist.updateOptimalPercentDepositedBdvForToken(
            C.BEAN_ETH_WELL,
            INIT_BEAN_TOKEN_WELL_PERCENT_TARGET - INIT_BEAN_WURLP_PERCENT_TARGET
        );

        // update whitelist status.
        LibWhitelistedTokens.addWhitelistStatus(
            well,
            true, // is whitelisted,
            true, // is LP
            true, // is well
            true // is soppable
        );

        s.sys.usdTokenPrice[well] = 1;
        s.sys.twaReserves[well].reserve0 = 1;
        s.sys.twaReserves[well].reserve1 = 1;
    }
}
