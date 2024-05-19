/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed Barn re-initializes fertilizer.
 * @dev Fertilizer is re-issued to each holder. Barn raise is set to L1 state.
 */

interface IFertilizerInternalizer {
    function init() external;
}

contract ReseedBarn {
    AppStorage internal s;

    /**
     * @notice deploys fertilizer and fertilizer proxy,
     * reissues fertilizer to each holder.
     */
    function init(
        uint128[] calldata fertilizerIds,
        address[][] calldata accounts,
        uint128[][] calldata amounts,
        uint128[][] calldata lastbpf,
        uint256 activeFertilizer,
        uint256 fertilizedIndex,
        uint256 unfertilizedIndex,
        uint128 bpf
    ) external {
        // deploy fertilizer implmentation.
        Fertilizer fertilizer = new Fertilizer();

        // deploy fertilizer proxy. Set owner to beanstalk.
        TransparentUpgradeableProxy fertilizerProxy = new TransparentUpgradeableProxy(
            address(fertilizer),
            address(this),
            abi.encode(IFertilizerInternalizer.init.selector)
        );

        for (uint i; i < fertilizerIds.length; i++) {
            // set s.firstFid, s.nextFid, s.lastFid
            if (i == 0) s.fFirst = fertilizerIds[i];
            if (i != 0) s.nextFid[fertilizerIds[i - 1]] = fertilizerIds[i];
            if (i == fertilizerIds.length - 1) s.fLast = fertilizerIds[i];
            // reissue fertilizer to each holder.
            for (uint j; j < accounts[i].length; j++) {
                // `id` only needs to be set once per account, but is set on each fertilizer
                // as `Fertilizer` does not have a function to set `id` once on a batch.
                Fertilizer(address(fertilizerProxy)).beanstalkMint(
                    accounts[i][j],
                    fertilizerIds[i],
                    amounts[i][j],
                    lastbpf[i][j]
                );
            }
        }

        s.season.fertilizing = true;
        s.activeFertilizer = activeFertilizer;
        s.fertilizedIndex = fertilizedIndex;
        s.unfertilizedIndex = unfertilizedIndex;
        s.bpf = bpf;
    }
}
