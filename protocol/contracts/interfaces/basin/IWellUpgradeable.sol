// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IWell} from "contracts/interfaces/basin/IWell.sol";

/**
 * @title IWell is the interface for the Well contract.
 *
 * In order for a Well to be verified using a permissionless on-chain registry, a Well Implementation should:
 * - Not be able to self-destruct (Aquifer's registry would be vulnerable to a metamorphic contract attack)
 * - Not be able to change its tokens, Well Function, Pumps and Well Data
 */
interface IWellUpgradeable is IWell {
    function init(string memory name, string memory symbol) external;

    function initNoWellToken() external;

    function upgradeTo(address newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes memory data) external;
}
