/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IDiamondCut.sol";

/**
 * @author Publius
 * @title App Storage defines the state object for Beanstalk.
**/
contract Account {
    struct Field {
        mapping(uint256 => uint256) plots;
        mapping(address => uint256) podAllowances;
    }

    struct AssetSilo {
        mapping(uint32 => uint256) withdrawals;
        mapping(uint32 => uint256) deposits;
        mapping(uint32 => uint256) depositSeeds;
    }

    struct Silo {
        uint256 stalk;
        uint256 seeds;
    }

    struct SeasonOfPlenty {
        uint256 base;
        uint256 stalk;
    }

    struct State {
        Field field;
        AssetSilo bean;
        AssetSilo lp;
        Silo s;
        uint32 lockedUntil;
        uint32 lastUpdate;
        uint32 lastSupplyIncrease;
        SeasonOfPlenty sop;
    }
}

contract Season {
    struct Global {
        uint32 current;
        uint256 start;
        uint256 period;
        uint256 timestamp;
    }

    struct State {
        uint256 increaseBase;
        uint256 stalkBase;
        uint32 next;
    }

    struct SeasonOfPlenty {
        uint256 base;
        uint256 increaseBase;
        uint32 rainSeason;
        uint32 next;
    }

    struct ResetBases {
        uint256 increaseMultiple;
        uint256 stalkMultiple;
        uint256 sopMultiple;
    }
}

contract Storage {
    struct Contracts {
        address bean;
        address pair;
        address pegPair;
        address weth;
    }

    // Field

    struct Field {
        uint256 soil;
        uint256 pods;
        uint256 harvested;
        uint256 harvestable;
    }

    // Governance

    struct Bip {
        address proposer;
        uint256 seeds;
        uint256 stalk;
        uint256 increaseBase;
        uint256 stalkBase;
        uint32 updated;
        uint32 start;
        uint32 period;
        bool executed;
        int pauseOrUnpause;
        uint128 timestamp;
        uint256 endTotalStalk;
    }

    struct DiamondCut {
        IDiamondCut.FacetCut[] diamondCut;
        address initAddress;
        bytes initData;
    }

    struct Governance {
        uint32[] activeBips;
        uint32 bipIndex;
        mapping(uint32 => DiamondCut) diamondCuts;
        mapping(uint32 => mapping(address => bool)) voted;
        mapping(uint32 => Bip) bips;
    }

    // Silo

    struct AssetSilo {
        uint256 deposited;
        uint256 withdrawn;
    }

    struct IncreaseSilo {
        uint32 lastSupplyIncrease;
        uint256 increase;
        uint256 increaseBase;
        uint256 stalk;
        uint256 stalkBase;
    }

    struct SeasonOfPlenty {
        uint256 weth;
        uint256 base;
        uint32 last;
    }

    struct Silo {
        uint256 stalk;
        uint256 seeds;
    }

    // Season

    struct Oracle {
        bool initialized;
        uint256 cumulative;
        uint256 pegCumulative;
        uint32 timestamp;
        uint32 pegTimestamp;
    }

    struct Rain {
        uint32 start;
        bool raining;
        uint256 pods;
        uint256 stalk;
        uint256 stalkBase;
        uint256 increaseStalk;
    }

    struct Weather {
        uint256 startSoil;
        uint256 lastDSoil;
        uint96 lastSoilPercent;
        uint32 lastSowTime;
        uint32 nextSowTime;
        uint32 yield;
        bool didSowBelowMin;
        bool didSowFaster;
    }
}

struct AppStorage {
    uint8 index;
    int8[32] cases;
    bool paused;
    uint128 pausedAt;
    Season.Global season;
    Storage.Contracts c;
    Storage.Field f;
    Storage.Governance g;
    Storage.Oracle o;
    Storage.Rain r;
    Storage.Silo s;
    Storage.Weather w;
    Storage.AssetSilo bean;
    Storage.AssetSilo lp;
    Storage.IncreaseSilo si;
    Storage.SeasonOfPlenty sop;
    mapping (uint32 => Season.State) seasons;
    mapping (uint32 => Season.SeasonOfPlenty) sops;
    mapping (uint32 => Season.ResetBases) rbs;
    mapping (address => Account.State) a;
}
