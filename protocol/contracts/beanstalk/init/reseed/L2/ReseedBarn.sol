/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Reseed Barn re-initializes Fertilizer.
 * @dev Fertilizer is re-issued to each holder. Barn raise is set to L1 state.
 */
contract ReseedBarn {
    event FertilizerMigrated(address account, uint128 fid, uint128 amount, uint128 lastBpf);

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
     * for each fert id --> all accounts --> amount, lastBpf
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
    function init(Fertilizers[] calldata fertilizerIds) external {
        mintFertilizers(Fertilizer(s.sys.tokens.fertilizer), fertilizerIds);
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
                // if a user attempts to perform a DOS attack by sending fertilizer to an EOA on L1,
                // but is a contract on L2, the contract will skip the issuance of their fertilizer.
                if (!hasCode(f.accountData[j].account)) {
                    fertilizerProxy.beanstalkMint(
                        f.accountData[j].account,
                        fid,
                        f.accountData[j].amount,
                        f.accountData[j].lastBpf
                    );
                    emit FertilizerMigrated(
                        f.accountData[j].account,
                        fid,
                        f.accountData[j].amount,
                        f.accountData[j].lastBpf
                    );
                }
            }
        }
    }

    /**
     * @notice checks if an account is a contract.
     */
    function hasCode(address account) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
