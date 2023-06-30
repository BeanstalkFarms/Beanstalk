// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IDiamondCut.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Account
 * @author Publius
 * @notice Stores Farmer-level Beanstalk state.
 * @dev {Account.State} is the primary struct that is referenced from {Storage.State}. 
 * All other structs in {Account} are referenced in {Account.State}. Each unique
 * Ethereum address is a Farmer.
 */
contract Account {
    /**
     * @notice Stores a Farmer's Plots and Pod allowances.
     * @param plots A Farmer's Plots. Maps from Plot index to Pod amount.
     * @param podAllowances An allowance mapping for Pods similar to that of the ERC-20 standard. Maps from spender address to allowance amount.
     */
    struct Field {
        mapping(uint256 => uint256) plots;
        mapping(address => uint256) podAllowances;
    }

    /**
     * @notice Stores a Farmer's Deposits and Seeds per Deposit, and formerly stored Withdrawals.
     * @param withdrawals DEPRECATED: Silo V1 Withdrawals are no longer referenced.
     * @param deposits Unripe Bean/LP Deposits (previously Bean/LP Deposits).
     * @param depositSeeds BDV of Unripe LP Deposits / 4 (previously # of Seeds in corresponding LP Deposit).
     */
    struct AssetSilo {
        mapping(uint32 => uint256) withdrawals;
        mapping(uint32 => uint256) deposits;
        mapping(uint32 => uint256) depositSeeds;
    }

    /**
     * @notice Represents a Deposit of a given Token in the Silo at a given Season.
     * @param amount The amount of Tokens in the Deposit.
     * @param bdv The Bean-denominated value of the total amount of Tokens in the Deposit.
     * @dev `amount` and `bdv` are packed as uint128 to save gas.
     */
    struct Deposit {
        uint128 amount; // ───┐ 16
        uint128 bdv; // ──────┘ 16 (32/32)
    }

    /**
     * @notice Stores a Farmer's Stalk and Seeds balances.
     * @param stalk Balance of the Farmer's Stalk.
     * @param seeds DEPRECATED – Balance of the Farmer's Seeds. Seeds are no longer referenced as of Silo V3.
     */
    struct Silo {
        uint256 stalk;
        uint256 seeds;
    }

    /**
     * @notice This struct stores the mow status for each Silo-able token, for each farmer. 
     * This gets updated each time a farmer mows, or adds/removes deposits.
     * @param lastStem The last cumulative grown stalk per bdv index at which the farmer mowed.
     * @param bdv The bdv of all of a farmer's deposits of this token type.
     * 
     */
    struct MowStatus {
        int96 lastStem; // ───┐ 12
        uint128 bdv; // ──────┘ 16 (28/32)
    }

    /**
     * @notice Stores a Farmer's Season of Plenty (SOP) balances.
     * @param roots The number of Roots a Farmer had when it started Raining.
     * @param plentyPerRoot The global Plenty Per Root index at the last time a Farmer updated their Silo.
     * @param plenty The balance of a Farmer's plenty. Plenty can be claimed directly for 3CRV.
     */
    struct SeasonOfPlenty {
        uint256 roots;
        uint256 plentyPerRoot;
        uint256 plenty;
    }
    
    /**
     * @notice Defines the state object for a Farmer.
     * @param field A Farmer's Field storage.
     * @param bean A Farmer's Unripe Bean Deposits only as a result of Replant (previously held the V1 Silo Deposits/Withdrawals for Beans).
     * @param lp A Farmer's Unripe LP Deposits as a result of Replant of BEAN:ETH Uniswap v2 LP Tokens (previously held the V1 Silo Deposits/Withdrawals for BEAN:ETH Uniswap v2 LP Tokens).
     * @param s A Farmer's Silo storage.
     * @param deprecated_votedUntil DEPRECATED – Replant removed on-chain governance including the ability to vote on BIPs.
     * @param lastUpdate The Season in which the Farmer last updated their Silo.
     * @param lastSop The last Season that a SOP occured at the time the Farmer last updated their Silo.
     * @param lastRain The last Season that it started Raining at the time the Farmer last updated their Silo.
     * @param deprecated_lastSIs DEPRECATED – In Silo V1.2, the Silo reward mechanism was updated to no longer need to store the number of the Supply Increases at the time the Farmer last updated their Silo.
     * @param deprecated_proposedUntil DEPRECATED – Replant removed on-chain governance including the ability to propose BIPs.
     * @param deprecated_sop DEPRECATED – Replant reset the Season of Plenty mechanism
     * @param roots A Farmer's Root balance.
     * @param deprecated_wrappedBeans DEPRECATED – Replant generalized Internal Balances. Wrapped Beans are now stored at the AppStorage level.
     * @param deposits A Farmer's Silo Deposits stored as a map from Token address to Season of Deposit to Deposit.
     * @param withdrawals A Farmer's Withdrawals from the Silo stored as a map from Token address to Season the Withdrawal becomes Claimable to Withdrawn amount of Tokens.
     * @param sop A Farmer's Season of Plenty storage.
     * @param depositAllowances A mapping of `spender => Silo token address => amount`.
     * @param tokenAllowances Internal balance token allowances.
     * @param depositPermitNonces A Farmer's current deposit permit nonce
     * @param tokenPermitNonces A Farmer's current token permit nonce
     */
    struct State {
        Field field; // A Farmer's Field storage.

        /*
         * @dev (Silo V1) A Farmer's Unripe Bean Deposits only as a result of Replant
         *
         * Previously held the V1 Silo Deposits/Withdrawals for Beans.

         * NOTE: While the Silo V1 format is now deprecated, this storage slot is used for gas
         * efficiency to store Unripe BEAN deposits. See {LibUnripeSilo} for more.
         */
        AssetSilo bean; 

        /*
         * @dev (Silo V1) Unripe LP Deposits as a result of Replant.
         * 
         * Previously held the V1 Silo Deposits/Withdrawals for BEAN:ETH Uniswap v2 LP Tokens.
         * 
         * BEAN:3CRV and BEAN:LUSD tokens prior to Replant were stored in the Silo V2
         * format in the `s.a[account].legacyDeposits` mapping.
         *
         * NOTE: While the Silo V1 format is now deprecated, unmigrated Silo V1 deposits are still
         * stored in this storage slot. See {LibUnripeSilo} for more.
         * 
         */
        AssetSilo lp; 

        /*
         * @dev Holds Silo specific state for each account.
         */
        Silo s;
        
        uint32 votedUntil; // DEPRECATED – Replant removed on-chain governance including the ability to vote on BIPs.
        uint32 lastUpdate; // The Season in which the Farmer last updated their Silo.
        uint32 lastSop; // The last Season that a SOP occured at the time the Farmer last updated their Silo.
        uint32 lastRain; // The last Season that it started Raining at the time the Farmer last updated their Silo.
        uint128 deltaRoots; // the number of roots to add, in the case where a farmer has mowed in the morning
        SeasonOfPlenty deprecated; // DEPRECATED – Replant reset the Season of Plenty mechanism
        uint256 roots; // A Farmer's Root balance.
        uint256 wrappedBeans; // DEPRECATED – Replant generalized Internal Balances. Wrapped Beans are now stored at the AppStorage level.
        mapping(address => mapping(uint32 => Deposit)) legacyDeposits; // Legacy Silo V2 Deposits stored as a map from Token address to Season of Deposit to Deposit. NOTE: While the Silo V2 format is now deprecated, unmigrated Silo V2 deposits are still stored in this mapping.
        mapping(address => mapping(uint32 => uint256)) withdrawals; // DEPRECATED - Zero withdraw eliminates a need for withdraw mapping
        SeasonOfPlenty sop; // A Farmer's Season Of Plenty storage.
        mapping(address => mapping(address => uint256)) depositAllowances; // Spender => Silo Token
        mapping(address => mapping(IERC20 => uint256)) tokenAllowances; // Token allowances
        uint256 depositPermitNonces; // A Farmer's current deposit permit nonce
        uint256 tokenPermitNonces; // A Farmer's current token permit nonce
        mapping(uint256 => Deposit) deposits; // SiloV3 Deposits stored as a map from uint256 to Deposit. This is an concat of the token address and the CGSPBDV for a ERC20 deposit, and a hash for an ERC721/1155 deposit.
        mapping(address => MowStatus) mowStatuses; // Store a MowStatus for each Whitelisted Silo token
        mapping(address => bool) isApprovedForAll; // ERC1155 isApprovedForAll mapping 
    }
}

/**
 * @title Storage
 * @author Publius
 * @notice Stores system-level Beanstalk state.
 */
contract Storage {
    /**
     * @notice DEPRECATED: System-level contract addresses.
     * @dev After Replant, Beanstalk stores Token addresses as constants to save gas.
     */
    struct Contracts {
        address bean;
        address pair;
        address pegPair;
        address weth;
    }

    /**
     * @notice System-level Field state variables.
     * @param soil The number of Soil currently available. Adjusted during {Sun.stepSun}.
     * @param beanSown The number of Bean sown within the current Season. Reset during {Weather.stepWeather}.
     * @param pods The pod index; the total number of Pods ever minted.
     * @param harvested The harvested index; the total number of Pods that have ever been Harvested.
     * @param harvestable The harvestable index; the total number of Pods that have ever been Harvestable. Included previously Harvested Beans.
     */
    struct Field {
        uint128 soil; // ──────┐ 16
        uint128 beanSown; // ──┘ 16 (32/32)
        uint256 pods;
        uint256 harvested;
        uint256 harvestable;
    }

    /**
     * @notice DEPRECATED: Contained data about each BIP (Beanstalk Improvement Proposal).
     * @dev Replant moved governance off-chain. This struct is left for future reference.
     * 
     */
    struct Bip {
        address proposer; // ───┐ 20
        uint32 start; //        │ 4 (24)
        uint32 period; //       │ 4 (28)
        bool executed; // ──────┘ 1 (29/32)
        int pauseOrUnpause; 
        uint128 timestamp;
        uint256 roots;
        uint256 endTotalRoots;
    }

    /**
     * @notice DEPRECATED: Contained data for the DiamondCut associated with each BIP.
     * @dev Replant moved governance off-chain. This struct is left for future reference.
     * @dev {Storage.DiamondCut} stored DiamondCut-related data for each {Bip}.
     */
    struct DiamondCut {
        IDiamondCut.FacetCut[] diamondCut;
        address initAddress;
        bytes initData;
    }

    /**
     * @notice DEPRECATED: Contained all governance-related data, including a list of BIPs, votes for each BIP, and the DiamondCut needed to execute each BIP.
     * @dev Replant moved governance off-chain. This struct is left for future reference.
     * @dev {Storage.Governance} stored all BIPs and Farmer voting information.
     */
    struct Governance {
        uint32[] activeBips;
        uint32 bipIndex;
        mapping(uint32 => DiamondCut) diamondCuts;
        mapping(uint32 => mapping(address => bool)) voted;
        mapping(uint32 => Bip) bips;
    }

    /**
     * @notice System-level Silo state; contains deposit and withdrawal data for a particular whitelisted Token.
     * @param deposited The total amount of this Token currently Deposited in the Silo.
     * @param depositedBdv The total bdv of this Token currently Deposited in the Silo.
     * @param withdrawn The total amount of this Token currently Withdrawn From the Silo.
     * @dev {Storage.State} contains a mapping from Token address => AssetSilo.
     * Currently, the bdv of deposits are asynchronous, and require an on-chain transaction to update.
     * Thus, the total bdv of deposits cannot be calculated, and must be stored and updated upon a bdv change.
     * 
     * Note that "Withdrawn" refers to the amount of Tokens that have been Withdrawn
     * but not yet Claimed. This will be removed in a future BIP.
     */
    struct AssetSilo {
        uint128 deposited;
        uint128 depositedBdv;
        uint256 withdrawn;
    }

    /**
     * @notice System-level Silo state variables.
     * @param stalk The total amount of active Stalk (including Earned Stalk, excluding Grown Stalk).
     * @param deprecated_seeds DEPRECATED: The total amount of active Seeds (excluding Earned Seeds).
     * @dev seeds are no longer used internally. Balance is wiped to 0 from the mayflower update. see {mowAndMigrate}.
     * @param roots The total amount of Roots.
     */
    struct Silo {
        uint256 stalk;
        uint256 deprecated_seeds; 
        uint256 roots;
    }

    /**
     * @notice System-level Curve Metapool Oracle state variables.
     * @param initialized True if the Oracle has been initialzed. It needs to be initialized on Deployment and re-initialized each Unpause.
     * @param startSeason The Season the Oracle started minting. Used to ramp up delta b when oracle is first added.
     * @param balances The cumulative reserve balances of the pool at the start of the Season (used for computing time weighted average delta b).
     * @param timestamp DEPRECATED: The timestamp of the start of the current Season. `LibCurveMinting` now uses `s.season.timestamp` instead of storing its own for gas efficiency purposes.
     * @dev Currently refers to the time weighted average deltaB calculated from the BEAN:3CRV pool.
     */
    struct CurveMetapoolOracle {
        bool initialized; // ────┐ 1
        uint32 startSeason; // ──┘ 4 (5/32)
        uint256[2] balances;
        uint256 timestamp;
    }

    /**
     * @notice System-level Rain balances. Rain occurs when P > 1 and the Pod Rate Excessively Low.
     * @dev The `raining` storage variable is stored in the Season section for a gas efficient read operation.
     * @param deprecated Previously held Rain start and Rain status variables. Now moved to Season struct for gas efficiency.
     * @param pods The number of Pods when it last started Raining.
     * @param roots The number of Roots when it last started Raining.
     */
    struct Rain {
        uint256 deprecated;
        uint256 pods;
        uint256 roots;
    }

    /**
     * @notice System-level Season state variables.
     * @param current The current Season in Beanstalk.
     * @param lastSop The Season in which the most recent consecutive series of Seasons of Plenty started.
     * @param withdrawSeasons The number of Seasons required to Withdraw a Deposit.
     * @param lastSopSeason The Season in which the most recent consecutive series of Seasons of Plenty ended.
     * @param rainStart Stores the most recent Season in which Rain started.
     * @param raining True if it is Raining (P > 1, Pod Rate Excessively Low).
     * @param fertilizing True if Beanstalk has Fertilizer left to be paid off.
     * @param sunriseBlock The block of the start of the current Season.
     * @param abovePeg Boolean indicating whether the previous Season was above or below peg.
     * @param stemStartSeason // season in which the stem storage method was introduced
     * @param start The timestamp of the Beanstalk deployment rounded down to the nearest hour.
     * @param period The length of each season in Beanstalk in seconds.
     * @param timestamp The timestamp of the start of the current Season.
     */
    struct Season {
        uint32 current; // ────────┐ 4  
        uint32 lastSop; //         │ 4 (8)
        uint8 withdrawSeasons; //  │ 1 (9)
        uint32 lastSopSeason; //   │ 4 (13)
        uint32 rainStart; //       │ 4 (17)
        bool raining; //           │ 1 (18)
        bool fertilizing; //       │ 1 (19)
        uint32 sunriseBlock; //    │ 4 (23)
        bool abovePeg; //          | 1 (24)
        uint16 stemStartSeason; // ┘ 2 (26/32)
        uint256 start;
        uint256 period;
        uint256 timestamp;
    }

    /**
     * @notice System-level Weather state variables.
     * @param deprecated 2 slots that were previously used.
     * @param lastDSoil Delta Soil; the number of Soil purchased last Season.
     * @param lastSowTime The number of seconds it for Soil to sell out last Season.
     * @param thisSowTime The number of seconds it for Soil to sell out this Season.
     * @param t The Temperature; the maximum interest rate during the current Season for sowing Beans in Soil. Adjusted each Season.
     */
    struct Weather {
        uint256[2] deprecated;
        uint128 lastDSoil;  // ───┐ 16 (16)
        uint32 lastSowTime; //    │ 4  (20)
        uint32 thisSowTime; //    │ 4  (24)
        uint32 t; // ─────────────┘ 4  (28/32)
    }

    /**
     * @notice Describes a Fundraiser.
     * @param payee The address to be paid after the Fundraiser has been fully funded.
     * @param token The token address that used to raise funds for the Fundraiser.
     * @param total The total number of Tokens that need to be raised to complete the Fundraiser.
     * @param remaining The remaining number of Tokens that need to to complete the Fundraiser.
     * @param start The timestamp at which the Fundraiser started (Fundraisers cannot be started and funded in the same block).
     */
    struct Fundraiser {
        address payee;
        address token;
        uint256 total;
        uint256 remaining;
        uint256 start;
    }

    /**
     * @notice Describes the settings for each Token that is Whitelisted in the Silo.
     * @param selector The encoded BDV function selector for the Token.
     * @param seeds The Seeds Per BDV that the Silo mints in exchange for Depositing this Token.
     * @param stalk The Stalk Per BDV that the Silo mints in exchange for Depositing this Token.
     * @dev A Token is considered Whitelisted if there exists a non-zero {SiloSettings} selector.
     * 
     * Note: `selector` is an encoded function selector that pertains to an 
     * external view function with the following signature:
     * 
     * `function tokenToBdv(uint256 amount) public view returns (uint256);`
     * 
     * It is called by {LibTokenSilo} through the use of delegate call to calculate 
     * the BDV of Tokens at the time of Deposit.
     */
    struct SiloSettings {
        /*
         * @dev: 
         * 
         * `selector` is an encoded function selector that pertains to 
         * an external view Beanstalk function with the following signature:
         * 
         * ```
         * function tokenToBdv(uint256 amount) public view returns (uint256);
         * ```
         * 
         * It is called by `LibTokenSilo` through the use of `delegatecall`
         * to calculate a token's BDV at the time of Deposit.
         */
        bytes4 selector;
        /*
         * @dev The Stalk Per BDV Per Season represents how much Stalk one BDV of the underlying deposited token
         * grows each season. In the past, this was represented by seeds. This is stored as 1e6, plus stalk is stored
         *  as 1e10, so 1 legacy seed would be 1e6 * 1e10.
         */
        uint32 stalkEarnedPerSeason;
        /*
         * @dev The Stalk Per BDV that the Silo grants in exchange for Depositing this Token.
         * previously just called stalk.
         */
        uint32 stalkIssuedPerBdv;
        /*
         * @dev The last season in which the stalkEarnedPerSeason for this token was updated
         */
		uint32 milestoneSeason;
        /*
         * @dev The cumulative amount of grown stalk per BDV for this Silo depositable token at the last stalkEarnedPerSeason update
         */
		int96 milestoneStem;

        /*
         @dev 1 byte of space is used for different encoding types.
         */
        bytes1 encodeType;

        /// @dev  7 bytes of additional storage space is available here.

    }

    /**
     * @notice Describes the settings for each Unripe Token in Beanstalk.
     * @param underlyingToken The address of the Token underlying the Unripe Token.
     * @param balanceOfUnderlying The number of Tokens underlying the Unripe Tokens (redemption pool).
     * @param merkleRoot The Merkle Root used to validate a claim of Unripe Tokens.
     * @dev An Unripe Token is a vesting Token that is redeemable for a a pro rata share
     * of the `balanceOfUnderlying`, subject to a penalty based on the percent of
     * Unfertilized Beans paid back.
     * 
     * There were two Unripe Tokens added at Replant: 
     *  - Unripe Bean, with its `underlyingToken` as BEAN;
     *  - Unripe LP, with its `underlyingToken` as BEAN:3CRV LP.
     * 
     * Unripe Tokens are initially distributed through the use of a `merkleRoot`.
     * 
     * The existence of a non-zero {UnripeSettings} implies that a Token is an Unripe Token.
     */
    struct UnripeSettings {
        address underlyingToken;
        uint256 balanceOfUnderlying;
        bytes32 merkleRoot;
    }
}

/**
 * @title AppStorage
 * @author Publius
 * @notice Defines the state object for Beanstalk.
 * @param deprecated_index DEPRECATED: Was the index of the BEAN token in the BEAN:ETH Uniswap V2 pool.
 * @param cases The 24 Weather cases (array has 32 items, but caseId = 3 (mod 4) are not cases)
 * @param paused True if Beanstalk is Paused.
 * @param pausedAt The timestamp at which Beanstalk was last paused.
 * @param season Storage.Season
 * @param c Storage.Contracts
 * @param f Storage.Field
 * @param g Storage.Governance
 * @param co Storage.CurveMetapoolOracle
 * @param r Storage.Rain
 * @param s Storage.Silo
 * @param reentrantStatus An intra-transaction state variable to protect against reentrance.
 * @param w Storage.Weather
 * @param earnedBeans The number of Beans distributed to the Silo that have not yet been Deposited as a result of the Earn function being called.
 * @param deprecated DEPRECATED - 14 slots that used to store state variables which have been deprecated through various updates. Storage slots can be left alone or reused.
 * @param a mapping (address => Account.State)
 * @param deprecated_bip0Start DEPRECATED - bip0Start was used to aid in a migration that occured alongside BIP-0.
 * @param deprecated_hotFix3Start DEPRECATED - hotFix3Start was used to aid in a migration that occured alongside HOTFIX-3.
 * @param fundraisers A mapping from Fundraiser ID to Storage.Fundraiser.
 * @param fundraiserIndex The number of Fundraisers that have occured.
 * @param deprecated_isBudget DEPRECATED - Budget Facet was removed in BIP-14. 
 * @param podListings A mapping from Plot Index to the hash of the Pod Listing.
 * @param podOrders A mapping from the hash of a Pod Order to the amount of Pods that the Pod Order is still willing to buy.
 * @param siloBalances A mapping from Token address to Silo Balance storage (amount deposited and withdrawn).
 * @param ss A mapping from Token address to Silo Settings for each Whitelisted Token. If a non-zero storage exists, a Token is whitelisted.
 * @param deprecated2 DEPRECATED - 2 slots that used to store state variables which have been depreciated through various updates. Storage slots can be left alone or reused.
 * @param newEarnedStalk the amount of earned stalk issued this season. Since 1 stalk = 1 bean, it represents the earned beans as well.
 * @param sops A mapping from Season to Plenty Per Root (PPR) in that Season. Plenty Per Root is 0 if a Season of Plenty did not occur.
 * @param internalTokenBalance A mapping from Farmer address to Token address to Internal Balance. It stores the amount of the Token that the Farmer has stored as an Internal Balance in Beanstalk.
 * @param unripeClaimed True if a Farmer has Claimed an Unripe Token. A mapping from Farmer to Unripe Token to its Claim status.
 * @param u Unripe Settings for a given Token address. The existence of a non-zero Unripe Settings implies that the token is an Unripe Token. The mapping is from Token address to Unripe Settings.
 * @param fertilizer A mapping from Fertilizer Id to the supply of Fertilizer for each Id.
 * @param nextFid A linked list of Fertilizer Ids ordered by Id number. Fertilizer Id is the Beans Per Fertilzer level at which the Fertilizer no longer receives Beans. Sort in order by which Fertilizer Id expires next.
 * @param activeFertilizer The number of active Fertilizer.
 * @param fertilizedIndex The total number of Fertilizer Beans.
 * @param unfertilizedIndex The total number of Unfertilized Beans ever.
 * @param fFirst The lowest active Fertilizer Id (start of linked list that is stored by nextFid). 
 * @param fLast The highest active Fertilizer Id (end of linked list that is stored by nextFid). 
 * @param bpf The cumulative Beans Per Fertilizer (bfp) minted over all Season.
 * @param vestingPeriodRoots the number of roots to add to the global roots, in the case the user plants in the morning. // placed here to save a storage slot.s
 * @param recapitalized The nubmer of USDC that has been recapitalized in the Barn Raise.
 * @param isFarm Stores whether the function is wrapped in the `farm` function (1 if not, 2 if it is).
 * @param ownerCandidate Stores a candidate address to transfer ownership to. The owner must claim the ownership transfer.
 * @param wellOracleSnapshots A mapping from Well Oracle address to the Well Oracle Snapshot.
 * @param beanEthPrice Stores the beanEthPrice during the sunrise() function. Returns 1 otherwise.
 */
struct AppStorage {
    uint8 deprecated_index;
    int8[32] cases; 
    bool paused; // ────────┐ 1 
    uint128 pausedAt; // ───┘ 16 (17/32)
    Storage.Season season;
    Storage.Contracts c;
    Storage.Field f;
    Storage.Governance g;
    Storage.CurveMetapoolOracle co;
    Storage.Rain r;
    Storage.Silo s;
    uint256 reentrantStatus;
    Storage.Weather w;

    uint256 earnedBeans;
    uint256[14] deprecated;
    mapping (address => Account.State) a;
    uint32 deprecated_bip0Start; // ─────┐ 4
    uint32 deprecated_hotFix3Start; // ──┘ 4 (8/32)
    mapping (uint32 => Storage.Fundraiser) fundraisers;
    uint32 fundraiserIndex; // 4 (4/32)
    mapping (address => bool) deprecated_isBudget;
    mapping(uint256 => bytes32) podListings;
    mapping(bytes32 => uint256) podOrders;
    mapping(address => Storage.AssetSilo) siloBalances;
    mapping(address => Storage.SiloSettings) ss;
    uint256[2] deprecated2;
    uint128 newEarnedStalk; // ──────┐ 16
    uint128 vestingPeriodRoots; // ──┘ 16 (32/32)
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

    // Farm
    uint256 isFarm;

    // Ownership
    address ownerCandidate;

    // Well
    mapping(address => bytes) wellOracleSnapshots;
    uint256 beanEthPrice;
}