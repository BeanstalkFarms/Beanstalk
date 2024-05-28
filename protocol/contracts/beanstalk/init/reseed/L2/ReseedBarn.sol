/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed Barn re-initializes Fertilizer.
 * @dev Fertilizer is re-issued to each holder. Barn raise is set to L1 state.
 */

interface IFertilizer {
    function init() external;
}

contract ReseedBarn {
    /**
     * @notice contains data per account for Fertilizer.
     */
    struct AccountFertilizerData {
        address account;
        uint128 amount;
        uint128 lastBpf;
    }
    /**
     * @notice Fertilizers contains the ids, accounts, amounts, and lastBpf of each Fertilizer.
     * @dev fertilizerIds MUST be in acsending order.
     */
    struct Fertilizers {
        uint128 fertilizerId;
        AccountFertilizerData[] accountData;
    }

    AppStorage internal s;

    /**
     * @notice deploys Fertilizer and Fertilizer proxy,
     * reissues Fertilizer to each holder.
     */
    function init(
        Fertilizers[] calldata fertilizerIds,
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
            abi.encode(IFertilizer.init.selector)
        );

        mintFertilizers(Fertilizer(address(fertilizerProxy)), fertilizerIds);
        s.sys.season.fertilizing = true;
        s.sys.fert.activeFertilizer = activeFertilizer;
        s.sys.fert.fertilizedIndex = fertilizedIndex;
        s.sys.fert.unfertilizedIndex = unfertilizedIndex;
        s.sys.fert.bpf = bpf;
    }

    function mintFertilizers(
        Fertilizer fertilizerProxy,
        Fertilizers[] calldata fertilizerIds
    ) internal {
        for (uint i; i < fertilizerIds.length; i++) {
            Fertilizers memory f = fertilizerIds[i];
            // set s.firstFid, s.nextFid, s.lastFid
            uint128 fid = f.fertilizerId;
            if (i == 0) s.sys.fert.fertFirst = fid;
            if (i != 0) s.sys.fert.nextFid[fertilizerIds[i - 1].fertilizerId] = fid;
            if (i == fertilizerIds.length - 1) s.sys.fert.fertLast = fid;

            // reissue fertilizer to each holder.
            for (uint j; j < f.accountData.length; j++) {
                // `id` only needs to be set once per account, but is set on each fertilizer
                // as `Fertilizer` does not have a function to set `id` once on a batch.
                fertilizerProxy.beanstalkMint(
                    f.accountData[j].account,
                    fid,
                    f.accountData[j].amount,
                    f.accountData[j].lastBpf
                );
            }
        }
    }
}
