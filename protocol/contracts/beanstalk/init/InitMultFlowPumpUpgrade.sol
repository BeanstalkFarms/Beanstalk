/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IAquifer} from "contracts/interfaces/basin/IAquifer.sol";
import {IWell, Call, IERC20} from "contracts/interfaces/basin/IWell.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibWellDeployer} from "contracts/libraries/Basin/LibWellDeployer.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

interface IWellUpgradeable {
    function upgradeTo(address implementation) external;
}

/**
 * @author Brean
 * @title InitMultiFlowPumpUpgrade upgrades the Whitelisted Wells to use the new MultiFlowPump.
 **/
contract InitMultiFlowPumpUpgrade {
    address internal constant MULTI_FLOW_PUMP_V1_2_1 = 0xBA150002660BbCA20675D1C1535Cd76C98A95b13;
    address internal constant U_WELL_IMPLEMENTATION =
        address(0xBA510995783111be5301d93CCfD5dE4e3B28e50B);
    address internal constant AQUIFER = address(0xBA51AAAa8C2f911AE672e783707Ceb2dA6E97521);
    address internal constant CP2_WELL_FUNCTION =
        address(0x0000000000000000000000000000000000000000);
    address internal constant BEAN_USDC = address(0xBea00ee04D8289aEd04f92EA122a96dC76A91bd7);
    address internal constant BEAN_USDT = address(0xbEA00fF437ca7E8354B174339643B4d1814bED33);

    AppStorage internal s;

    function init() external {
        address[] memory wells = LibWhitelistedTokens.getWhitelistedWellLpTokens();

        for (uint256 i; i < wells.length; i++) {
            IWell well = IWell(wells[i]);
            // fetch the well's immutable and init data
            IERC20[] memory tokens = well.tokens();
            Call memory wellFunction = well.wellFunction();
            Call[] memory pumps = well.pumps();

            // replace the pump addresses with the new MultiFlowPump address
            pumps[0].target = MULTI_FLOW_PUMP_V1_2_1;

            // if the well is not USDC or USDT, set the well function to CP2_WELL_FUNCTION
            if (wells[i] != BEAN_USDC && wells[i] != BEAN_USDT) {
                wellFunction.target = CP2_WELL_FUNCTION;
            }

            // encode the immutable and init data
            (bytes memory immutableData, bytes memory initData) = LibWellDeployer
                .encodeWellDeploymentData(AQUIFER, tokens, wellFunction, pumps);

            // deploy the new well:
            address minimalProxyWell = IAquifer(AQUIFER).boreWell(
                U_WELL_IMPLEMENTATION,
                immutableData,
                initData,
                bytes32("1")
            );

            // upgrade the well to the new implementation
            IWellUpgradeable(wells[i]).upgradeTo(minimalProxyWell);
            // call add liquidity to start the pump.
            well.sync(address(this), 0);

            // delete the well Oracle snapshot.
            delete s.sys.wellOracleSnapshots[wells[i]];
        }
    }
}
