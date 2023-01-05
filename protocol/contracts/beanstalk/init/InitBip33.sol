/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;
import "~/beanstalk/AppStorage.sol";
/**
 * @author Publius, Brean
 * @title InitBip33 re-initalizes the weather struct for BIP-33, for gas efficency  
 **/

contract InitBip33 {
    AppStorage internal s;
    
    struct OldWeather {
        uint256 startSoil; // slot 1
        uint256 lastDSoil; // slot 2 
        uint96 lastSoilPercent; // gone
        uint32 lastSowTime; // slot 3
        uint32 nextSowTime; // slot 3
        uint32 yield; // slot 3
        bool didSowBelowMin; // no
        bool didSowFaster; // no
    }
    // reference
    struct NewWeather {
        uint256[2] x; //DEPRECATED
        uint128 lastDSoil;
        uint32 lastSowTime;
        uint32 nextSowTime;
        uint32 yield;
    }

    function init() external {
        OldWeather storage oldWeather;
        Storage.Weather memory newWeather;
        Storage.Weather storage w = s.w;
        assembly {
            oldWeather.slot := w.slot
        }
        newWeather.lastDSoil = uint128(oldWeather.lastDSoil);
        newWeather.lastSowTime = oldWeather.lastSowTime;
        newWeather.nextSowTime = oldWeather.nextSowTime;
        newWeather.yield = oldWeather.yield;
        s.w = newWeather;
    }
}
