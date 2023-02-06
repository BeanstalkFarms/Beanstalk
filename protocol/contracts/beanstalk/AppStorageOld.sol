/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IDiamondCut.sol";

/**
 * @author Publius
 * @title App Storage Old defines the legacy state object for Beanstalk. It is used for migration.
**/
contract AccountOld {
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

contract SeasonOld {
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

contract StorageOld {
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
        uint32 thisSowTime;
        uint32 yield;
        bool didSowBelowMin;
        bool didSowFaster;
    }
}

struct AppStorageOld {
    uint8 index;
    int8[32] cases;
    bool paused;
    uint128 pausedAt;
    SeasonOld.Global season;
    StorageOld.Contracts c;
    StorageOld.Field f;
    StorageOld.Governance g;
    StorageOld.Oracle o;
    StorageOld.Rain r; // Remove `stalkBase` and `increaseBase`
    StorageOld.Silo s; // Added `roots`, Set `stalk` and `seeds` in `InitBip0`
    // Added reentrantStatus.
    StorageOld.Weather w; // 3 slots
    StorageOld.AssetSilo bean; // 2 slots
    StorageOld.AssetSilo lp; // 2 slots
    StorageOld.IncreaseSilo si; // 5 slots
    StorageOld.SeasonOfPlenty sop; // 3 slots
    mapping (uint32 => SeasonOld.State) seasons;
    mapping (uint32 => SeasonOld.SeasonOfPlenty) sops;
    mapping (uint32 => SeasonOld.ResetBases) rbs;
    mapping (address => AccountOld.State) a;
}

/*
 * As a part of Bip-0 OldAppStorage was migrated to AppStorage. Several state variables were remapped, removed or shuffled.
 *
 * 2 memory slots (stalkBase and increaseBase) were removed from Rain.
 * 1 memory slot was added to Silo (roots). reentrantStatus (was depreciated1) was added after Silo
 * Thus, 2 memory slots were removed and 2 were added, so the storage mapping is contained.
 * The in-between memory slots in Silo were migrated in InitBip0
 *
 * IncreaseSilo changed from 5 slots to 2 slots.
 * V1IncreaseSilo was added after SeasonOfPlenty with 3 slots.
 * Thus, IncreaseSilo and SeasonOfPlenty map to IncreaseSilo, SeasonOfPlenty and V1IncreaseSilo accounting for 8 total slots.
 * Required migrations (such as SeasonOfPlenty shifting) were accounted for in InitBip0
 * Thus, no memory was shifted unintentionally as 5 slots map to 5 slots
 *
 * seasons, sops, and rbs were removed. Mappings take up 1 slot, so 3 slots were removed.
 * They were replaced with unclaimedRoots, v2SIBeans, sops
 * seasons was changed to unclaimedRoots (1 slot -> 1 slot)
 * sops was changed to v2SIBeans (1 slot -> 1 slot)
 * rbs was changed to sops (1 slot -> 1 slot, Note: This sops variable in AppStorage is completely different than sops variable in AppStorageOld).
 * No memory was shifted unintentionally as 3 slots map to 3 slots
 *
 * a remains at the same place in memory, so no memory should have been changed.
 * The Account struct changed slightly, but no memory slots were shifted.
 *
 * bip0Stalk, hotFix3Stalk, fundraiser, fundraiserIndex were added to the end of the state.
 * Because these variables were appended to the end of the state, no variables were overwritten by doing so.
 *
 */