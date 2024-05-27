/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";
import {C} from "contracts/C.sol";

////// INTERFACES //////
import {Call, IAquifer} from "contracts/interfaces/basin/IAquifer.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract BasinDeployer is Utils {
    struct DeployData {
        string name;
        address functionAddress;
        bytes constructorData;
    }

    struct DeployWellData {
        address[] tokens;
        Call wellFunction;
        Call[] pumps;
    }

    // pump constants
    bytes16 constant ALPHA = bytes16(0x3ffeef368eb04325c526c2246eec3e55);
    uint256 constant CAP_INTERVAL = 12;
    bytes16 constant MAX_LP_SUPPLY_INCREASE = bytes16(0x3ff50624dd2f1a9fbe76c8b439581062);
    bytes16 constant MAX_LP_SUPPLY_DECREASE = bytes16(0x3ff505e1d27a3ee9bffd7f3dd1a32671);

    // core Basin + components constants.
    address constant AQUIFER = address(0xBA51AAAA95aeEFc1292515b36D86C51dC7877773);
    address constant CP2 = address(0xBA510C20FD2c52E4cb0d23CFC3cCD092F9165a6E);
    address constant MFP = address(0xBA510f10E3095B83a0F33aa9ad2544E22570a87C);
    address constant WELL_IMPLMENTATION = address(0xBA510e11eEb387fad877812108a3406CA3f43a4B);

    // extra wells addreses (used for convert testing)
    // addresses were randomly generated and are not on-chain.
    address constant BEAN_USDC_WELL = address(0x4444F7394455A8d1af37E8BEa52F2FCf6D39f158);
    address constant BEAN_USDT_WELL = address(0x55554AF7c7CEe28994c7484C364768620C726D68);

    string constant BEAN_WETH_WELL_NAME = "BEAN:WETH Constant Product 2 Well";
    string constant BEAN_WETH_WELL_SYMBOL = "BEANWETHCP2w";

    // a list of well functions, pumps, and well implementations.
    address public aquifer;

    address[] public wellFunctions;
    address[] public pumps;
    address[] public wellImplementations;
    address[] public wells;

    /**
     * @notice deploys basin and initlizes wells.
     * @dev deploys the Aquifer, ConstantProduct2, MultiFlowPump, and Well implementation,
     * at current mainnet addresses.
     */
    function initBasin(bool mock, bool verbose) internal {
        if (verbose) console.log("deploying Basin...");
        deployBasin(verbose);

        if (verbose) console.log("deploying Wells...");
        deployWells(mock, verbose);
    }

    /**
     * @notice deploys the basin contracts.
     * @dev new well functions, pumps, and well implementations should be appended.
     */
    function deployBasin(bool verbose) internal {
        // new well functions should be added here.
        DeployData[] memory wfDeployData = new DeployData[](1);
        wfDeployData[0] = DeployData(
            "./node_modules/@beanstalk/wells/out/ConstantProduct2.sol/ConstantProduct2.json",
            CP2,
            new bytes(0)
        );

        // new multiFlowPumps should be added here.
        DeployData[] memory pumpsDeployData = new DeployData[](2);
        // multi flow pump
        pumpsDeployData[0] = DeployData(
            "./node_modules/@beanstalk/wells/out/MultiFlowPump.sol/MultiFlowPump.json",
            MFP,
            abi.encode(MAX_LP_SUPPLY_INCREASE, MAX_LP_SUPPLY_DECREASE, CAP_INTERVAL, ALPHA)
        );
        // mock pump for testing purposes.
        pumpsDeployData[1] = DeployData("MockPump.sol", address(0), new bytes(0));

        // new well implementations should be added here.
        DeployData[] memory wellImplementationDeployData = new DeployData[](1);
        wellImplementationDeployData[0] = DeployData(
            "./node_modules/@beanstalk/wells/out/Well.sol/Well.json",
            WELL_IMPLMENTATION,
            new bytes(0)
        );

        _deployBasin(
            AQUIFER, // aquifer
            wfDeployData, // well functions
            pumpsDeployData, // pumps
            wellImplementationDeployData, // well implementations
            verbose
        );
    }

    /**
     * @notice deploys basin contracts, and adds to the registry.
     */
    function _deployBasin(
        address aquiferAddress,
        DeployData[] memory wfData,
        DeployData[] memory pumpData,
        DeployData[] memory wellImplementationData,
        bool verbose
    ) internal {
        // deploy Aquifier.
        deployCodeTo(
            "./node_modules/@beanstalk/wells/out/Aquifer.sol/Aquifer.json",
            aquiferAddress
        );
        if (verbose) console.log("Aquifer Deployed at:", aquiferAddress);
        aquifer = aquiferAddress;

        // deploy well functions.
        if (verbose) console.log("deploying well functions:");
        for (uint i; i < wfData.length; ++i) {
            wellFunctions.push(deployCodeWithArgs(wfData[i]));
            if (verbose) console.log("WellFunction", i, "Deployed at:", wellFunctions[i]);
        }

        // deploy pumps
        if (verbose) console.log("deploying pump:");
        for (uint i; i < pumpData.length; i++) {
            pumps.push(deployCodeWithArgs(pumpData[i]));
            if (verbose) console.log("Pump", i, "Deployed at:", pumps[i]);
        }

        // deploy implementations
        if (verbose) console.log("deploying well implm:");
        for (uint i; i < wellImplementationData.length; i++) {
            wellImplementations.push(deployCodeWithArgs(wellImplementationData[i]));
            if (verbose) console.log("Well Implm", i, "Deployed at:", wellImplementations[i]);
        }

        // optional labels for testing.
        vm.label(CP2, "Constant Product 2");
        vm.label(MFP, "MultiFlowPump");
        vm.label(pumps[1], "MockPump");
        vm.label(wellImplementations[0], "well");
    }

    /**
     * @notice deploy wells for beanstalk.
     * @dev new wells should be added here.
     * @param mock if true, deploys wells with mock pump (for testing purposes).
     */
    function deployWells(bool mock, bool verbose) internal {
        address _pump;

        if (mock) {
            // mock pump.
            _pump = pumps[1];
        } else {
            // multi flow pump.
            _pump = pumps[0];
        }

        // deploy bean eth well:
        wells.push(deployBeanCp2Well([C.BEAN_ETH_WELL, C.WETH], _pump));
        if (verbose) console.log("Bean Eth well deployed at:", wells[0]);
        vm.label(C.BEAN_ETH_WELL, "BEAN/ETH Well");

        // deploy bean wsteth well:
        wells.push(deployBeanCp2Well([C.BEAN_WSTETH_WELL, C.WSTETH], _pump));
        if (verbose) console.log("Bean wstEth well deployed at:", wells[1]);
        vm.label(C.BEAN_WSTETH_WELL, "BEAN/WSTETH Well");
    }

    function deployExtraWells(bool mock, bool verbose) internal {
        address _pump;

        if (mock) {
            // mock pump.
            _pump = pumps[1];
        } else {
            // multi flow pump.
            _pump = pumps[0];
        }

        // deploy Bean USDC well:
        wells.push(deployBeanCp2Well([BEAN_USDC_WELL, C.USDC], _pump));
        if (verbose) console.log("Bean USDC well deployed at:", wells[0]);
        vm.label(BEAN_USDC_WELL, "BEAN/USDC Well");

        // deploy Bean USDT well:
        wells.push(deployBeanCp2Well([BEAN_USDT_WELL, C.USDT], _pump));
        if (verbose) console.log("Bean USDT well deployed at:", wells[1]);
        vm.label(BEAN_USDT_WELL, "BEAN/USDT Well");
    }

    /**
     * @notice deploys a well with a
     * Constant product 2 well function and pump.
     * @param wellAddressAndNonBeanToken [wellAddress, nonBeanToken]
     * @param pump address of the pump.
     */
    function deployBeanCp2Well(
        address[2] memory wellAddressAndNonBeanToken,
        address pump
    ) internal returns (address) {
        return
            deployWellAtAddressNoData(
                wellAddressAndNonBeanToken[0],
                C.BEAN,
                wellAddressAndNonBeanToken[1],
                wellFunctions[0],
                pump,
                wellImplementations[0]
            );
    }

    function deployWellAtAddressNoData(
        address targetAddress,
        address token0,
        address token1,
        address wellFunction,
        address pumpAddress,
        address wellImplementation
    ) internal returns (address) {
        return
            deployWellAtAddress(
                targetAddress,
                token0,
                token1,
                wellFunction,
                new bytes(0),
                pumpAddress,
                new bytes(0),
                wellImplementation,
                bytes32(0)
            );
    }

    /**
     * @notice deploys a well. If target address is specified,
     * mock deployment is done.
     */
    function deployWellAtAddress(
        address targetAddress,
        address token0,
        address token1,
        address wellFunction,
        bytes memory wellFunctionData,
        address pumpAddress,
        bytes memory pumpData,
        address wellImplementation,
        bytes32 salt
    ) internal returns (address) {
        DeployWellData memory wellEncodedData = getWellParams2Tkn1Pump(
            token0,
            token1,
            wellFunction,
            wellFunctionData,
            pumpAddress,
            pumpData
        );
        string memory wellName = string(
            abi.encodePacked(ERC20(token0).name(), ERC20(token1).name(), "Well")
        );

        string memory wellSymbol = string(
            abi.encodePacked(ERC20(token0).name(), ERC20(token1).name(), "Well")
        );
        // Bore Well
        address wellAddress = IAquifer(aquifer).boreWell(
            wellImplementation,
            encodeWellParams(aquifer, wellEncodedData),
            abi.encodeWithSignature("init(string,string)", wellName, wellSymbol),
            salt
        );

        // etch to address if specified.
        if (targetAddress != address(0)) {
            vm.etch(targetAddress, wellAddress.code);
            return targetAddress;
        } else {
            return wellAddress;
        }
    }

    /**
     * @notice helper function to craft the well parameters for a 2 token, 1 pump well.
     */
    function getWellParams2Tkn1Pump(
        address token0,
        address token1,
        address wellFunction,
        bytes memory wellFunctionData,
        address pump,
        bytes memory pumpDataInPump
    ) internal pure returns (DeployWellData memory wellParameters) {
        address[] memory tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
        Call[] memory pumpData = new Call[](1);
        pumpData[0].target = pump;
        pumpData[0].data = pumpDataInPump;
        wellParameters = DeployWellData(tokens, Call(wellFunction, wellFunctionData), pumpData);
    }

    /**
     * @notice helper function to encode into bytes.
     */
    function encodeWellParams(
        address _aquifierAddress,
        DeployWellData memory wd
    ) internal pure returns (bytes memory) {
        bytes memory packedPumpData;
        for (uint i; i < wd.pumps.length; i++) {
            Call memory pump = wd.pumps[i];
            packedPumpData = abi.encodePacked(
                packedPumpData,
                pump.target,
                pump.data.length,
                pump.data
            );
        }
        // encode data:
        return
            abi.encodePacked(
                _aquifierAddress,
                wd.tokens.length,
                wd.wellFunction.target,
                wd.wellFunction.data.length,
                wd.pumps.length,
                wd.tokens,
                wd.wellFunction.data,
                packedPumpData
            );
    }

    /**
     * @notice deploys a contract at the specified address.
     * @dev if no address is specified, deploys to a new address.
     */
    function deployCodeWithArgs(DeployData memory dData) internal returns (address) {
        if (dData.functionAddress != address(0)) {
            deployCodeTo(dData.name, dData.constructorData, dData.functionAddress);
            return dData.functionAddress;
        } else {
            return deployCode(dData.name);
        }
    }
}
