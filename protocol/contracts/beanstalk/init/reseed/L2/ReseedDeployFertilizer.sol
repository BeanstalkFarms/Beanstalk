/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "forge-std/console.sol";

interface IFertilizer {
    function init() external;
}

/**
 * @author Deadmanwalking
 * @notice ReseedDeployFertilizer deploys the Fertilizer implementation and the fertilizer proxy.
 */
contract ReseedDeployFertilizer {
    AppStorage internal s;

    // Fertilizer
    bytes32 internal constant FERTILIZER_PROXY_SALT =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    function init() external {
        // TODO: Get new bytecode from misc bip and mine for fert salt
        // deploy fertilizer implementation
        Fertilizer fertilizer = new Fertilizer();
        // deploy fertilizer proxy. Set owner to beanstalk.
        TransparentUpgradeableProxy fertilizerProxy = new TransparentUpgradeableProxy{
            salt: FERTILIZER_PROXY_SALT
        }(
            address(fertilizer), // logic
            address(this), // admin (diamond)
            abi.encode(IFertilizer.init.selector) // init data
        );
        console.log("Fertilizer deployed at: ", address(fertilizerProxy));
    }
}
