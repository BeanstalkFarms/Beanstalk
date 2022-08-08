/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage} from "../AppStorage.sol";
import {AppStorageOld, StorageOld} from "../AppStorageOld.sol";
import "../../C.sol";

/**
 * @author Publius
 * @title Init Diamond initializes the Beanstalk Diamond.
**/
contract InitBip0 {

    using SafeMath for uint256;

    AppStorage internal s;

    function diamondStorageOld() internal pure returns (AppStorageOld storage ds) {
        assembly {
            ds.slot := 0
        }
    }

    function init() external {
        // AppStorageOld storage sOld = diamondStorageOld();

        // Update Silo
        // uint256 seeds = sOld.s.seeds;
        // uint256 stalk = sOld.s.stalk;
        // delete sOld.s;
        // s.s.seeds = seeds;
        // s.s.stalk = stalk;

        // Update Silo Increase
        // uint256 siBeans = sOld.si.increase;
        // uint256 siStalk = sOld.si.stalk;
        // delete sOld.si;

        // Update Rain + SOP
        // delete sOld.r;
        // uint256 weth = sOld.sop.weth;
        // delete sOld.sop;

        // Migrate State Variables
        // s.sop.weth = weth;
        // s.si.beans = siBeans;
        // s.si.stalk = siStalk.sub(siBeans.mul(10000));
        // s.s.seeds = seeds;
        // s.s.stalk = stalk;
        // s.s.roots = s.s.stalk.sub(siStalk).mul(C.getRootsBase());

        // migrate bips to new model
        // for (uint256 i256 = 0; i256 < sOld.g.bipIndex; ++i256) {
        //     uint32 i = uint32(i256);
        //     StorageOld.Bip memory oldBip = sOld.g.bips[i];
        //     delete sOld.g.bips[i];
        //     s.g.bips[i].proposer = oldBip.proposer;
        //     s.g.bips[i].start = oldBip.start;
        //     s.g.bips[i].period = oldBip.period;
        //     s.g.bips[i].executed = oldBip.executed;
        //     s.g.bips[i].pauseOrUnpause = oldBip.pauseOrUnpause;
        //     s.g.bips[i].timestamp = oldBip.timestamp;
        //     if (oldBip.endTotalStalk > 0) {
        //         s.g.bips[i].roots = oldBip.stalk;
        //         s.g.bips[i].endTotalRoots = oldBip.endTotalStalk;
        //     } else {
        //         s.g.bips[i].roots = oldBip.stalk.mul(C.getRootsBase());
        //     }
        // }
        // s.g.bips[0].executed = true;
        // s.bip0Start = s.season.current;
    }
}
