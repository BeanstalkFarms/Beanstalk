/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IDiamondCut.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        mapping(uint32 => uint256) withdrawals; // Dep
        mapping(uint32 => uint256) deposits;
        mapping(uint32 => uint256) depositSeeds;
    }

    struct Deposit {
        uint128 amount;
        uint128 bdv;
    }

    struct Silo {
        uint256 stalk;
        uint256 seeds;
    }

    struct SeasonOfPlenty {
        uint256 base; // Dep
        uint256 roots;
        uint256 basePerRoot; // Dep
        uint256 plentyPerRoot;
        uint256 plenty;
    }

    struct State {
        Field field;
        AssetSilo bean;
        AssetSilo lp;
        Silo s;
        uint32 votedUntil; // Dep
        uint32 lastUpdate;
        uint32 lastSop;
        uint32 lastRain;
        uint32 lastSIs; // Dep
        uint32 proposedUntil; // Dep
        SeasonOfPlenty sop;
        uint256 roots;
        uint256 wrappedBeans; // Dep
        mapping(address => mapping(uint32 => Deposit)) deposits;
        mapping(address => mapping(uint32 => uint256)) withdrawals;
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
        uint32 start;
        uint32 period;
        bool executed;
        int pauseOrUnpause;
        uint128 timestamp;
        uint256 roots;
        uint256 endTotalRoots;
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

    struct Silo {
        uint256 stalk;
        uint256 seeds;
        uint256 roots;
    }

    // Season

    struct Oracle {
        bool initialized;
        uint32 startSeason;
        uint256[2] balances;
        uint256 timestamp;
    }

    struct Rain {
        uint256 depreciated;
        uint256 pods;
        uint256 roots;
    }

    struct Season {
        uint32 current;
        uint32 lastSop;
        uint8 withdrawSeasons;
        uint32 lastSopSeason;
        uint32 rainStart;
        bool raining;
        bool fertilizing;
        uint256 start;
        uint256 period;
        uint256 timestamp;
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

    struct Fundraiser {
        address payee;
        address token;
        uint256 total;
        uint256 remaining;
        uint256 start;
    }

    struct SiloSettings {
        bytes4 selector;
        uint32 seeds;
        uint32 stalk;
    }

    struct UnripeSettings {
        address underlyingToken;
        uint256 balanceOfUnderlying;
        bytes32 merkleRoot;
    }
}

struct AppStorage {
    uint8 index; // Depreciated
    int8[32] cases;
    bool paused;
    uint128 pausedAt;
    Storage.Season season;
    Storage.Contracts c; // Depreciated
    Storage.Field f;
    Storage.Governance g;
    Storage.Oracle co;
    Storage.Rain r;
    Storage.Silo s;
    uint256 reentrantStatus; // An intra-transaction state variable to protect against reentrance
    Storage.Weather w;
    //////////////////////////////////
    uint256 earnedBeans;
    uint256[14] depreciated; // 10 slots to map to depreciated storage variables
    mapping (address => Account.State) a;
    uint32 bip0Start;
    uint32 hotFix3Start;
    mapping (uint32 => Storage.Fundraiser) fundraisers;
    uint32 fundraiserIndex;
    mapping (address => bool) isBudget;
    mapping(uint256 => bytes32) podListings;
    mapping(bytes32 => uint256) podOrders;
    mapping(address => Storage.AssetSilo) siloBalances;
    mapping(address => Storage.SiloSettings) ss;
    uint256[3] depreciated2; // 3 slots for depreciated storage variables
    // New Sops
    mapping (uint32 => uint256) sops;
    // Internal Balances
    mapping(address => mapping(IERC20 => uint256)) internalTokenBalance;
    // Unripe
    mapping(address => mapping(address => bool)) unripeClaimed;
    mapping(address => Storage.UnripeSettings) u;
    // Fertilizer
    mapping(uint128 => uint256) fertilizer;
    mapping(uint128 => uint128) nextFid;
    uint256 activeFertilizer;
    uint256 fertilizedIndex;
    uint256 unfertilizedIndex;
    uint128 fFirst;
    uint128 fLast;
    uint128 bpf;
    uint256 recapitalized;
    uint256 isFarm;
}
