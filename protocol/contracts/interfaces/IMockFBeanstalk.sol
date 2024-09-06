/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMockFBeanstalk {
    enum CounterUpdateType {
        INCREASE,
        DECREASE
    }

    enum FacetCutAction {
        Add,
        Replace,
        Remove
    }

    enum GerminationSide {
        ODD,
        EVEN,
        NOT_GERMINATING
    }

    enum ShipmentRecipient {
        NULL,
        SILO,
        FIELD,
        BARN
    }

    struct AccountSeasonOfPlenty {
        uint32 lastRain;
        uint32 lastSop;
        uint256 roots;
        FarmerSops[] farmerSops;
    }

    struct AdvancedFarmCall {
        bytes callData;
        bytes clipboard;
    }

    struct AdvancedPipeCall {
        address target;
        bytes callData;
        bytes clipboard;
    }

    struct AssetSettings {
        bytes4 selector;
        uint32 stalkEarnedPerSeason;
        uint48 stalkIssuedPerBdv;
        uint32 milestoneSeason;
        int96 milestoneStem;
        bytes1 encodeType;
        int24 deltaStalkEarnedPerSeason;
        uint128 gaugePoints;
        uint64 optimalPercentDepositedBdv;
        Implementation gaugePointImplementation;
        Implementation liquidityWeightImplementation;
    }

    struct Balance {
        uint128 amount;
        uint128 lastBpf;
    }

    struct Blueprint {
        address publisher;
        bytes data;
        bytes32[] operatorPasteInstrs;
        uint256 maxNonce;
        uint256 startTime;
        uint256 endTime;
    }

    struct DeltaBStorage {
        int256 beforeInputTokenDeltaB;
        int256 afterInputTokenDeltaB;
        int256 beforeOutputTokenDeltaB;
        int256 afterOutputTokenDeltaB;
        int256 beforeOverallDeltaB;
        int256 afterOverallDeltaB;
    }

    struct Deposit {
        uint128 amount;
        uint128 bdv;
    }

    struct EvaluationParameters {
        uint256 maxBeanMaxLpGpPerBdvRatio;
        uint256 minBeanMaxLpGpPerBdvRatio;
        uint256 targetSeasonsToCatchUp;
        uint256 podRateLowerBound;
        uint256 podRateOptimal;
        uint256 podRateUpperBound;
        uint256 deltaPodDemandLowerBound;
        uint256 deltaPodDemandUpperBound;
        uint256 lpToSupplyRatioUpperBound;
        uint256 lpToSupplyRatioOptimal;
        uint256 lpToSupplyRatioLowerBound;
        uint256 excessivePriceThreshold;
        uint256 soilCoefficientHigh;
        uint256 soilCoefficientLow;
        uint256 baseReward;
    }

    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    struct FarmerSops {
        address well;
        PerWellPlenty wellsPlenty;
    }

    struct Implementation {
        address target;
        bytes4 selector;
        bytes1 encodeType;
        bytes data;
    }

    struct MowStatus {
        int96 lastStem;
        uint128 bdv;
    }

    struct PenaltyData {
        uint256 inputToken;
        uint256 outputToken;
        uint256 overall;
    }

    struct PerWellPlenty {
        uint256 plentyPerRoot;
        uint256 plenty;
        bytes32[4] _buffer;
    }

    struct PipeCall {
        address target;
        bytes data;
    }

    struct Plot {
        uint256 index;
        uint256 pods;
    }

    struct PodListing {
        address lister;
        uint256 fieldId;
        uint256 index;
        uint256 start;
        uint256 podAmount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        uint256 minFillAmount;
        uint8 mode;
    }

    struct PodOrder {
        address orderer;
        uint256 fieldId;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    struct Rain {
        uint256 pods;
        uint256 roots;
        bytes32[4] _buffer;
    }

    struct Requisition {
        Blueprint blueprint;
        bytes32 blueprintHash;
        bytes signature;
    }

    struct Season {
        uint32 current;
        uint32 lastSop;
        uint8 withdrawSeasons;
        uint32 lastSopSeason;
        uint32 rainStart;
        bool raining;
        bool fertilizing;
        uint32 sunriseBlock;
        bool abovePeg;
        uint16 stemStartSeason;
        uint16 stemScaleSeason;
        uint256 start;
        uint256 period;
        uint256 timestamp;
        bytes32[8] _buffer;
    }

    struct SeedGauge {
        uint128 averageGrownStalkPerBdvPerSeason;
        uint128 beanToMaxLpGpPerBdvRatio;
        bytes32[4] _buffer;
    }

    struct ShipmentRoute {
        address planContract;
        bytes4 planSelector;
        ShipmentRecipient recipient;
        bytes data;
    }

    struct Supply {
        uint128 endBpf;
        uint256 supply;
    }

    struct TokenDepositId {
        address token;
        uint256[] depositIds;
        Deposit[] tokenDeposits;
    }

    struct Tokens {
        address bean;
        address fertilizer;
        address urBean;
        address urLp;
    }

    struct Weather {
        uint128 lastDeltaSoil;
        uint32 lastSowTime;
        uint32 thisSowTime;
        uint32 temp;
        bytes32[4] _buffer;
    }

    struct WellDeltaB {
        address well;
        int256 deltaB;
    }

    struct WhitelistStatus {
        address token;
        bool isWhitelisted;
        bool isWhitelistedLp;
        bool isWhitelistedWell;
        bool isSoppable;
    }

    error AddressEmptyCode(address target);
    error AddressInsufficientBalance(address account);
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);
    error FailedInnerCall();
    error PRBMath__MulDivOverflow(uint256 prod1, uint256 denominator);
    error SafeCastOverflowedIntDowncast(uint8 bits, int256 value);
    error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
    error SafeCastOverflowedUintToInt(uint256 value);
    error SafeERC20FailedOperation(address token);
    error StringsInsufficientHexLength(uint256 value, uint256 length);
    error T();

    event ActiveFieldSet(uint256 fieldId);
    event AddDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );
    event AddUnripeToken(
        address indexed unripeToken,
        address indexed underlyingToken,
        bytes32 merkleRoot
    );
    event AddWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);
    event CancelBlueprint(bytes32 blueprintHash);
    event ChangeUnderlying(address indexed token, int256 underlying);
    event Chop(address indexed account, address indexed token, uint256 amount, uint256 underlying);
    event ClaimPlenty(address indexed account, address token, uint256 plenty);
    event Convert(
        address indexed account,
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount
    );
    event DeltaB(int256 deltaB);
    event DepositApproval(
        address indexed owner,
        address indexed spender,
        address token,
        uint256 amount
    );
    event DewhitelistToken(address indexed token);
    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
    event FarmerGerminatingStalkBalanceChanged(
        address indexed account,
        int256 delta,
        GerminationSide germ
    );
    event FieldAdded(uint256 fieldId);
    event GaugePointChange(uint256 indexed season, address indexed token, uint256 gaugePoints);
    event Harvest(address indexed account, uint256 fieldId, uint256[] plots, uint256 beans);
    event Incentivization(address indexed account, uint256 beans);
    event InternalBalanceChanged(address indexed account, address indexed token, int256 delta);
    event L1BeansMigrated(address indexed reciever, uint256 amount, uint8 toMode);
    event L1DepositsMigrated(
        address indexed owner,
        address indexed reciever,
        uint256[] depositIds,
        uint256[] amounts,
        uint256[] bdvs
    );
    event L1FertilizerMigrated(
        address indexed owner,
        address indexed reciever,
        uint256[] fertIds,
        uint128[] amounts,
        uint128 lastBpf
    );
    event L1InternalBalancesMigrated(
        address indexed owner,
        address indexed reciever,
        address[] tokens,
        uint256[] amounts
    );
    event L1PlotsMigrated(
        address indexed owner,
        address indexed reciever,
        uint256[] index,
        uint256[] pods
    );
    event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Pause(uint256 timestamp);
    event Pick(address indexed account, address indexed token, uint256 amount);
    event Plant(address indexed account, uint256 beans);
    event PlotTransfer(
        address indexed from,
        address indexed to,
        uint256 fieldId,
        uint256 indexed index,
        uint256 amount
    );
    event PodApproval(
        address indexed owner,
        address indexed spender,
        uint256 fieldId,
        uint256 amount
    );
    event PodListingCancelled(address indexed lister, uint256 fieldId, uint256 index);
    event PodListingCreated(
        address indexed lister,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        uint8 mode
    );
    event PodListingFilled(
        address indexed filler,
        address indexed lister,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );
    event PodOrderCancelled(address indexed orderer, bytes32 id);
    event PodOrderCreated(
        address indexed orderer,
        bytes32 id,
        uint256 beanAmount,
        uint256 fieldId,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount
    );
    event PodOrderFilled(
        address indexed filler,
        address indexed orderer,
        bytes32 id,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 podAmount,
        uint256 costInBeans
    );
    event PublishRequisition(Requisition requisition);
    event Receipt(ShipmentRecipient indexed recipient, uint256 receivedAmount, bytes data);
    event RecieverApproved(address indexed owner, address reciever);
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );
    event RemoveWhitelistStatus(address token, uint256 index);
    event RetryableTicketCreated(uint256 indexed ticketId);
    event SeasonOfPlentyField(uint256 toField);
    event SeasonOfPlentyWell(uint256 indexed season, address well, address token, uint256 amount);
    event SetFertilizer(uint128 id, uint128 bpf);
    event ShipmentRoutesSet(ShipmentRoute[] newShipmentRoutes);
    event Soil(uint32 indexed season, uint256 soil);
    event Sow(address indexed account, uint256 fieldId, uint256 index, uint256 beans, uint256 pods);
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);
    event Sunrise(uint256 indexed season);
    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);
    event TemperatureChange(
        uint256 indexed season,
        uint256 caseId,
        int8 absChange,
        uint256 fieldId
    );
    event TokenApproval(
        address indexed owner,
        address indexed spender,
        address token,
        uint256 amount
    );
    event TokenTransferred(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint8 fromMode,
        uint8 toMode
    );
    event TotalGerminatingBalanceChanged(
        uint256 germinationSeason,
        address indexed token,
        int256 deltaAmount,
        int256 deltaBdv
    );
    event TotalGerminatingStalkChanged(uint256 germinationSeason, int256 deltaGerminatingStalk);
    event TotalStalkChangedFromGermination(int256 deltaStalk, int256 deltaRoots);
    event Tractor(address indexed operator, bytes32 blueprintHash);
    event TractorVersionSet(string version);
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );
    event TransferSingle(
        address indexed operator,
        address indexed sender,
        address indexed recipient,
        uint256 depositId,
        uint256 amount
    );
    event URI(string _uri, uint256 indexed _id);
    event Unpause(uint256 timestamp, uint256 timePassed);
    event UpdateAverageStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);
    event UpdateGaugeSettings(
        address indexed token,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint64 optimalPercentDepositedBdv
    );
    event UpdateTWAPs(uint256[2] balances);
    event UpdateWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );
    event UpdatedEvaluationParameters(EvaluationParameters);
    event UpdatedGaugePointImplementationForToken(
        address indexed token,
        Implementation gaugePointImplementation
    );
    event UpdatedLiqudityWeightImplementationForToken(
        address indexed token,
        Implementation liquidityWeightImplementation
    );
    event UpdatedOptimalPercentDepositedBdvForToken(
        address indexed token,
        uint64 optimalPercentDepositedBdv
    );
    event UpdatedOracleImplementationForToken(
        address indexed token,
        Implementation oracleImplementation
    );
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );
    event WellOracle(uint32 indexed season, address well, int256 deltaB, bytes cumulativeReserves);
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );
    event WhitelistTokenImplementations(
        address indexed token,
        Implementation gpImplementation,
        Implementation lwImplementation
    );

    function _getMintFertilizerOut(
        uint256 tokenAmountIn,
        address barnRaiseToken
    ) external view returns (uint256 fertilizerAmountOut);

    function abovePeg() external view returns (bool);

    function activeField() external view returns (uint256);

    function addFertilizer(
        uint128 seasonAdded,
        uint128 tokenAmountIn,
        uint256 minLpOut
    ) external payable;

    function addFertilizerOwner(
        uint128 id,
        uint128 tokenAmountIn,
        uint256 minLpOut
    ) external payable;

    function addField() external;

    function addMigratedUnderlying(address unripeToken, uint256 amount) external payable;

    function addUnderlying(address unripeToken, uint256 amount) external payable;

    function addUnderlyingWithRecap(address unripeToken, uint256 amount) external payable;

    function addUnripeToken(
        address unripeToken,
        address underlyingToken,
        bytes32 root
    ) external payable;

    function addWhitelistSelector(address token, bytes4 selector) external;

    function addWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) external;

    function advancedFarm(
        AdvancedFarmCall[] memory data
    ) external payable returns (bytes[] memory results);

    function advancedPipe(
        AdvancedPipeCall[] memory pipes,
        uint256 value
    ) external payable returns (bytes[] memory results);

    function allowancePods(
        address owner,
        address spender,
        uint256 fieldId
    ) external view returns (uint256);

    function approveDeposit(address spender, address token, uint256 amount) external payable;

    function approveL2Reciever(
        address reciever,
        address L2Beanstalk,
        uint256 maxSubmissionCost,
        uint256 maxGas,
        uint256 gasPriceBid
    ) external payable returns (uint256 ticketID);

    function approvePods(address spender, uint256 fieldId, uint256 amount) external payable;

    function approveReciever(address owner, address reciever) external;

    function approveToken(address spender, address token, uint256 amount) external payable;

    function balanceOf(address account, uint256 depositId) external view returns (uint256 amount);

    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory depositIds
    ) external view returns (uint256[] memory);

    function balanceOfBatchFertilizer(
        address[] memory accounts,
        uint256[] memory ids
    ) external view returns (Balance[] memory);

    function balanceOfDepositedBdv(
        address account,
        address token
    ) external view returns (uint256 depositedBdv);

    function balanceOfEarnedBeans(address account) external view returns (uint256 beans);

    function balanceOfEarnedStalk(address account) external view returns (uint256);

    function balanceOfFertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans);

    function balanceOfFertilizer(
        address account,
        uint256 id
    ) external view returns (Balance memory);

    function balanceOfFinishedGerminatingStalkAndRoots(
        address account
    ) external view returns (uint256 gStalk, uint256 gRoots);

    function balanceOfGerminatingStalk(address account) external view returns (uint256);

    function balanceOfGrownStalk(address account, address token) external view returns (uint256);

    function balanceOfGrownStalkMultiple(
        address account,
        address[] memory tokens
    ) external view returns (uint256[] memory grownStalks);

    function balanceOfPenalizedUnderlying(
        address unripeToken,
        address account
    ) external view returns (uint256 underlying);

    function balanceOfPlantableSeeds(address account) external view returns (uint256);

    function balanceOfPlenty(address account, address well) external view returns (uint256 plenty);

    function balanceOfPods(address account, uint256 fieldId) external view returns (uint256 pods);

    function balanceOfRainRoots(address account) external view returns (uint256);

    function balanceOfRevitalizedStalk(
        address account,
        address[] memory tokens,
        int96[] memory stems,
        uint256[] memory amounts
    ) external view returns (uint256 stalk);

    function balanceOfRoots(address account) external view returns (uint256);

    function balanceOfSop(address account) external view returns (AccountSeasonOfPlenty memory sop);

    function balanceOfStalk(address account) external view returns (uint256);

    function balanceOfUnderlying(
        address unripeToken,
        address account
    ) external view returns (uint256 underlying);

    function balanceOfUnfertilized(
        address account,
        uint256[] memory ids
    ) external view returns (uint256 beans);

    function balanceOfYoungAndMatureGerminatingStalk(
        address account
    ) external view returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk);

    function batchTransferERC1155(
        address token,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) external payable;

    function bdv(address token, uint256 amount) external view returns (uint256 _bdv);

    function bdvs(
        address[] memory tokens,
        uint256[] memory amounts
    ) external view returns (uint256 _bdv);

    function beanSown() external view returns (uint256);

    function beanToBDV(uint256 amount) external pure returns (uint256);

    function beansPerFertilizer() external view returns (uint128 bpf);

    function beginBarnRaiseMigration(address well) external;

    function calcCaseIdE(int256 deltaB, uint128 endSoil) external;

    function calcCaseIdWithParams(
        uint256 pods,
        uint256 _lastDeltaSoil,
        uint128 beanSown,
        uint128 endSoil,
        int256 deltaB,
        bool raining,
        bool rainRoots,
        bool aboveQ,
        uint256 L2SRState
    ) external;

    function calcGaugePointsWithParams(
        address token,
        uint256 percentOfDepositedBdv
    ) external view returns (uint256);

    function calculateConvertCapacityPenaltyE(
        uint256 overallCappedDeltaB,
        uint256 overallAmountInDirectionOfPeg,
        address inputToken,
        uint256 inputTokenAmountInDirectionOfPeg,
        address outputToken,
        uint256 outputTokenAmountInDirectionOfPeg
    ) external view returns (uint256 cumulativePenalty, PenaltyData memory pdCapacity);

    function calculateDeltaBFromReservesE(
        address well,
        uint256[] memory reserves,
        uint256 lookback
    ) external view returns (int256);

    function calculateStalkPenalty(
        DeltaBStorage memory dbs,
        uint256 bdvConverted,
        uint256 overallConvertCapacity,
        address inputToken,
        address outputToken
    )
        external
        view
        returns (
            uint256 stalkPenaltyBdv,
            uint256 overallConvertCapacityUsed,
            uint256 inputTokenAmountUsed,
            uint256 outputTokenAmountUsed
        );

    function calculateStemForTokenFromGrownStalk(
        address token,
        uint256 grownStalk,
        uint256 bdvOfDeposit
    ) external view returns (int96 stem, GerminationSide germ);

    function cancelBlueprint(Requisition memory requisition) external;

    function cancelPodListing(uint256 fieldId, uint256 index) external payable;

    function cancelPodOrder(PodOrder memory podOrder, uint8 mode) external payable;

    function cappedReservesDeltaB(address well) external view returns (int256 deltaB);

    function captureE() external returns (int256 deltaB);

    function captureWellE(address well) external returns (int256 deltaB);

    function captureWellEInstantaneous(address well) external returns (int256 instDeltaB);

    function chop(
        address unripeToken,
        uint256 amount,
        uint8 fromMode,
        uint8 toMode
    ) external payable returns (uint256);

    function claimAllPlenty(uint8 toMode) external payable;

    function claimFertilized(uint256[] memory ids, uint8 mode) external payable;

    function claimOwnership() external;

    function claimPlenty(address well, uint8 toMode) external payable;

    function convert(
        bytes memory convertData,
        int96[] memory stems,
        uint256[] memory amounts
    )
        external
        payable
        returns (
            int96 toStem,
            uint256 fromAmount,
            uint256 toAmount,
            uint256 fromBdv,
            uint256 toBdv
        );

    function convertInternalE(
        address tokenIn,
        uint256 amountIn,
        bytes memory convertData
    )
        external
        returns (
            address toToken,
            address fromToken,
            uint256 toAmount,
            uint256 fromAmount,
            address account,
            bool decreaseBDV
        );

    function createPodListing(PodListing memory podListing) external payable;

    function createPodOrder(
        PodOrder memory podOrder,
        uint256 beanAmount,
        uint8 mode
    ) external payable returns (bytes32 id);

    function cumulativeCurrentDeltaB(address[] memory pools) external view returns (int256 deltaB);

    function decreaseDepositAllowance(
        address spender,
        address token,
        uint256 subtractedValue
    ) external returns (bool);

    function decreaseTokenAllowance(
        address spender,
        address token,
        uint256 subtractedValue
    ) external returns (bool);

    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv,
        bytes memory
    ) external pure returns (uint256 newGaugePoints);

    function deployStemsUpgrade() external;

    function deposit(
        address token,
        uint256 _amount,
        uint8 mode
    ) external payable returns (uint256 amount, uint256 _bdv, int96 stem);

    function depositAllowance(
        address owner,
        address spender,
        address token
    ) external view returns (uint256);

    function depositAtStemAndBdv(
        address token,
        uint256 _amount,
        int96 stem,
        uint128 bdv,
        uint8 mode
    ) external;

    function depositForConvertE(
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 grownStalk
    ) external;

    function depositPermitDomainSeparator() external view returns (bytes32);

    function depositPermitNonces(address owner) external view returns (uint256);

    function determineReward(uint256 secondsLate) external view returns (uint256);

    function dewhitelistToken(address token) external payable;

    function diamondCut(
        FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) external;

    function droughtSiloSunrise(uint256 amount) external;

    function droughtSunrise() external;

    function enrootDeposit(address token, int96 stem, uint256 amount) external payable;

    function enrootDeposits(
        address token,
        int96[] memory stems,
        uint256[] memory amounts
    ) external payable;

    function etherPipe(
        PipeCall memory p,
        uint256 value
    ) external payable returns (bytes memory result);

    function exploitFertilizer() external;

    function exploitPodOrderBeans() external;

    function exploitSop() external;

    function exploitUserInternalTokenBalance() external;

    function exploitUserSendTokenInternal() external;

    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);

    function facetAddresses() external view returns (address[] memory facetAddresses_);

    function facetFunctionSelectors(
        address _facet
    ) external view returns (bytes4[] memory facetFunctionSelectors_);

    function facets() external view returns (Facet[] memory facets_);

    function farm(bytes[] memory data) external payable returns (bytes[] memory results);

    function farmSunrise() external;

    function farmSunrises(uint256 number) external;

    function fastForward(uint32 _s) external;

    function fertilize(uint256 amount) external;

    function fertilizerSunrise(uint256 amount) external;

    function fieldCount() external view returns (uint256);

    function fillPodListing(
        PodListing memory podListing,
        uint256 beanAmount,
        uint8 mode
    ) external payable;

    function fillPodOrder(
        PodOrder memory podOrder,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint8 mode
    ) external payable;

    function forceSunrise() external;

    function gaugePointsNoChange(
        uint256 currentGaugePoints,
        uint256,
        uint256
    ) external pure returns (uint256);

    function getAbsBeanToMaxLpRatioChangeFromCaseId(
        uint256 caseId
    ) external view returns (uint80 ml);

    function getAbsTemperatureChangeFromCaseId(uint256 caseId) external view returns (int8 t);

    function getActiveFertilizer() external view returns (uint256);

    function getAllBalance(address account, address token) external view returns (Balance memory b);

    function getAllBalances(
        address account,
        address[] memory tokens
    ) external view returns (Balance[] memory balances);

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    function getAverageGrownStalkPerBdv() external view returns (uint256);

    function getAverageGrownStalkPerBdvPerSeason() external view returns (uint128);

    function getBalance(address account, address token) external view returns (uint256 balance);

    function getBalances(
        address account,
        address[] memory tokens
    ) external view returns (uint256[] memory balances);

    function getBarnRaiseToken() external view returns (address);

    function getBarnRaiseWell() external view returns (address);

    function getBeanGaugePointsPerBdv() external view returns (uint256);

    function getBeanIndex(IERC20[] memory tokens) external view returns (uint256);

    function getBeanToMaxLpGpPerBdvRatio() external view returns (uint256);

    function getBeanToMaxLpGpPerBdvRatioScaled() external view returns (uint256);

    function getBeanstalkTokens() external view returns (Tokens memory);

    function getBlueprintHash(Blueprint memory blueprint) external view returns (bytes32);

    function getBlueprintNonce(bytes32 blueprintHash) external view returns (uint256);

    function getCaseData(uint256 caseId) external view returns (bytes32 casesData);

    function getCases() external view returns (bytes32[144] memory cases);

    function getChangeFromCaseId(
        uint256 caseId
    ) external view returns (uint32, int8, uint80, int80);

    function getCounter(address account, bytes32 counterId) external view returns (uint256 count);

    function getCurrentHumidity() external view returns (uint128 humidity);

    function getDeltaPodDemand() external view returns (uint256);

    function getDeltaPodDemandLowerBound() external view returns (uint256);

    function getDeltaPodDemandUpperBound() external view returns (uint256);

    function getDeposit(
        address account,
        address token,
        int96 stem
    ) external view returns (uint256, uint256);

    function getDepositId(address token, int96 stem) external pure returns (uint256);

    function getDepositMerkleRoot() external pure returns (bytes32);

    function getDepositsForAccount(
        address account
    ) external view returns (TokenDepositId[] memory deposits);

    function getEndBpf() external view returns (uint128 endBpf);

    function getEvenGerminating(address token) external view returns (uint256, uint256);

    function getExcessivePriceThreshold() external view returns (uint256);

    function getExternalBalance(
        address account,
        address token
    ) external view returns (uint256 balance);

    function getExternalBalances(
        address account,
        address[] memory tokens
    ) external view returns (uint256[] memory balances);

    function getExtremelyFarAbove(uint256 optimalPercentBdv) external pure returns (uint256);

    function getExtremelyFarBelow(uint256 optimalPercentBdv) external pure returns (uint256);

    function getFertilizer(uint128 id) external view returns (uint256);

    function getFertilizerMerkleRoot() external pure returns (bytes32);

    function getFertilizers() external view returns (Supply[] memory fertilizers);

    function getFirst() external view returns (uint128);

    function getGaugePointImplementationForToken(
        address token
    ) external view returns (Implementation memory);

    function getGaugePoints(address token) external view returns (uint256);

    function getGaugePointsPerBdvForToken(address token) external view returns (uint256);

    function getGaugePointsPerBdvForWell(address well) external view returns (uint256);

    function getGaugePointsWithParams(address token) external view returns (uint256);

    function getGerminatingRootsForSeason(uint32 season) external view returns (uint256);

    function getGerminatingStalkAndRootsForSeason(
        uint32 season
    ) external view returns (uint256, uint256);

    function getGerminatingStalkForSeason(uint32 season) external view returns (uint256);

    function getGerminatingStem(address token) external view returns (int96 germinatingStem);

    function getGerminatingStems(
        address[] memory tokens
    ) external view returns (int96[] memory germinatingStems);

    function getGerminatingTotalDeposited(address token) external view returns (uint256 amount);

    function getGerminatingTotalDepositedBdv(address token) external view returns (uint256 _bdv);

    function getGrownStalkIssuedPerGp() external view returns (uint256);

    function getGrownStalkIssuedPerSeason() external view returns (uint256);

    function getHumidity(uint128 _s) external pure returns (uint128 humidity);

    function getIndexForDepositId(
        address account,
        address token,
        uint256 depositId
    ) external view returns (uint256);

    function getInternalBalance(
        address account,
        address token
    ) external view returns (uint256 balance);

    function getInternalBalanceMerkleRoot() external pure returns (bytes32);

    function getInternalBalances(
        address account,
        address[] memory tokens
    ) external view returns (uint256[] memory balances);

    function getLargestGpPerBdv() external view returns (uint256);

    function getLargestLiqWell() external view returns (address);

    function getLast() external view returns (uint128);

    function getLastMowedStem(
        address account,
        address token
    ) external view returns (int96 lastStem);

    function getLegacyLockedUnderlyingBean() external view returns (uint256);

    function getLegacyLockedUnderlyingLP() external view returns (uint256);

    function getLiquidityToSupplyRatio() external view returns (uint256);

    function getLiquidityWeightImplementationForToken(
        address token
    ) external view returns (Implementation memory);

    function getLockedBeans() external view returns (uint256);

    function getLockedBeansFromTwaReserves(
        bytes memory cumulativeReserves,
        uint40 timestamp
    ) external view returns (uint256);

    function getLockedBeansUnderlyingUnripeBean() external view returns (uint256);

    function getLockedBeansUnderlyingUnripeLP() external view returns (uint256);

    function getLpToSupplyRatioLowerBound() external view returns (uint256);

    function getLpToSupplyRatioOptimal() external view returns (uint256);

    function getLpToSupplyRatioUpperBound() external view returns (uint256);

    function getMaxAmountIn(
        address tokenIn,
        address tokenOut
    ) external view returns (uint256 amountIn);

    function getMaxBeanMaxLpGpPerBdvRatio() external view returns (uint256);

    function getMinBeanMaxLpGpPerBdvRatio() external view returns (uint256);

    function getMintFertilizerOut(
        uint256 tokenAmountIn
    ) external view returns (uint256 fertilizerAmountOut);

    function getMowStatus(
        address account,
        address[] memory tokens
    ) external view returns (MowStatus[] memory mowStatuses);

    function getNext(uint128 id) external view returns (uint128);

    function getNextSeasonStart() external view returns (uint256);

    function getNonBeanTokenAndIndexFromWell(address well) external view returns (address, uint256);

    function getOddGerminating(address token) external view returns (uint256, uint256);

    function getOracleImplementationForToken(
        address token
    ) external view returns (Implementation memory);

    function getOrderId(PodOrder memory podOrder) external pure returns (bytes32 id);

    function getOverallConvertCapacity() external view returns (uint256);

    function getPenalizedUnderlying(
        address unripeToken,
        uint256 amount
    ) external view returns (uint256 redeem);

    function getPenalty(address unripeToken) external view returns (uint256 penalty);

    function getPercentPenalty(address unripeToken) external view returns (uint256 penalty);

    function getPlotIndexesFromAccount(
        address account,
        uint256 fieldId
    ) external view returns (uint256[] memory plotIndexes);

    function getPlotMerkleRoot() external pure returns (bytes32);

    function getPlotsFromAccount(
        address account,
        uint256 fieldId
    ) external view returns (Plot[] memory plots);

    function getPodListing(uint256 fieldId, uint256 index) external view returns (bytes32 id);

    function getPodOrder(bytes32 id) external view returns (uint256);

    function getPodRate(uint256 fieldId) external view returns (uint256);

    function getPodRateLowerBound() external view returns (uint256);

    function getPodRateOptimal() external view returns (uint256);

    function getPodRateUpperBound() external view returns (uint256);

    function getPoolDeltaBWithoutCap(address well) external view returns (int256 deltaB);

    function getPublisherCounter(bytes32 counterId) external view returns (uint256 count);

    function getRecapFundedPercent(address unripeToken) external view returns (uint256 percent);

    function getRecapPaidPercent() external view returns (uint256 percent);

    function getRecapitalized() external view returns (uint256);

    function getReciever(address owner) external view returns (address);

    function getRelBeanToMaxLpRatioChangeFromCaseId(uint256 caseId) external view returns (int80 l);

    function getRelTemperatureChangeFromCaseId(uint256 caseId) external view returns (uint32 mt);

    function getRelativelyFarAbove(uint256 optimalPercentBdv) external pure returns (uint256);

    function getRelativelyFarBelow(uint256 optimalPercentBdv) external pure returns (uint256);

    function getSeasonStart() external view returns (uint256);

    function getSeasonStruct() external view returns (Season memory);

    function getSeasonTimestamp() external view returns (uint256);

    function getSeedGauge() external view returns (SeedGauge memory);

    function getSeedGaugeSetting() external view returns (EvaluationParameters memory);

    function getShipmentRoutes() external view returns (ShipmentRoute[] memory);

    function getSiloTokens() external view returns (address[] memory tokens);

    function getStemTips() external view returns (int96[] memory _stemTips);

    function getT() external view returns (uint256);

    function getTargetSeasonsToCatchUp() external view returns (uint256);

    function getTokenDepositIdsForAccount(
        address account,
        address token
    ) external view returns (uint256[] memory depositIds);

    function getTokenDepositsForAccount(
        address account,
        address token
    ) external view returns (TokenDepositId memory deposits);

    function getTokenUsdPrice(address token) external view returns (uint256);

    function getTokenUsdPriceFromExternal(
        address token,
        uint256 lookback
    ) external view returns (uint256 tokenUsd);

    function getTokenUsdTwap(address token, uint256 lookback) external view returns (uint256);

    function getTotalBdv() external view returns (uint256 totalBdv);

    function getTotalDeposited(address token) external view returns (uint256);

    function getTotalDepositedBdv(address token) external view returns (uint256);

    function getTotalGerminatingAmount(address token) external view returns (uint256);

    function getTotalGerminatingBdv(address token) external view returns (uint256);

    function getTotalGerminatingStalk() external view returns (uint256);

    function getTotalRecapDollarsNeeded() external view returns (uint256);

    function getTotalSiloDeposited() external view returns (uint256[] memory depositedAmounts);

    function getTotalSiloDepositedBdv() external view returns (uint256[] memory depositedBdvs);

    function getTotalUnderlying(address unripeToken) external view returns (uint256 underlying);

    function getTotalUsdLiquidity() external view returns (uint256 totalLiquidity);

    function getTotalWeightedUsdLiquidity() external view returns (uint256 totalWeightedLiquidity);

    function getTractorVersion() external view returns (string memory);

    function getTwaLiquidityForWell(address well) external view returns (uint256);

    function getUnderlying(
        address unripeToken,
        uint256 amount
    ) external view returns (uint256 underlyingAmount);

    function getUnderlyingPerUnripeToken(
        address unripeToken
    ) external view returns (uint256 underlyingPerToken);

    function getUnderlyingToken(
        address unripeToken
    ) external view returns (address underlyingToken);

    function getUsdTokenPrice(address token) external view returns (uint256);

    function getUsdTokenPriceFromExternal(
        address token,
        uint256 lookback
    ) external view returns (uint256 usdToken);

    function getUsdTokenTwap(address token, uint256 lookback) external view returns (uint256);

    function getWeightedTwaLiquidityForWell(address well) external view returns (uint256);

    function getWellConvertCapacity(address well) external view returns (uint256);

    function getWellsByDeltaB()
        external
        view
        returns (
            WellDeltaB[] memory wellDeltaBs,
            uint256 totalPositiveDeltaB,
            uint256 totalNegativeDeltaB,
            uint256 positiveDeltaBCount
        );

    function getWhitelistStatus(
        address token
    ) external view returns (WhitelistStatus memory _whitelistStatuses);

    function getWhitelistStatuses()
        external
        view
        returns (WhitelistStatus[] memory _whitelistStatuses);

    function getWhitelistedLpTokens() external view returns (address[] memory tokens);

    function getWhitelistedTokens() external view returns (address[] memory tokens);

    function getWhitelistedWellLpTokens() external view returns (address[] memory tokens);

    function getYoungAndMatureGerminatingTotalStalk()
        external
        view
        returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk);

    function gm(address account, uint8 mode) external payable returns (uint256);

    function grownStalkForDeposit(
        address account,
        address token,
        int96 stem
    ) external view returns (uint256 grownStalk);

    function harvest(uint256 fieldId, uint256[] memory plots, uint8 mode) external payable;

    function harvestableIndex(uint256 fieldId) external view returns (uint256);

    function imageURI(
        address token,
        int96 stem,
        int96 stemTip
    ) external view returns (string memory);

    function increaseDepositAllowance(
        address spender,
        address token,
        uint256 addedValue
    ) external returns (bool);

    function increaseTokenAllowance(
        address spender,
        address token,
        uint256 addedValue
    ) external returns (bool);

    function incrementTotalHarvestableE(uint256 fieldId, uint256 amount) external;

    function incrementTotalPodsE(uint256 fieldId, uint256 amount) external;

    function incrementTotalSoilE(uint128 amount) external;

    function initOracleForAllWhitelistedWells() external;

    function isApprovedForAll(address _owner, address _operator) external view returns (bool);

    function isFertilizing() external view returns (bool);

    function isHarvesting(uint256 fieldId) external view returns (bool);

    function isUnripe(address unripeToken) external view returns (bool unripe);

    function issueDeposits(
        address owner,
        uint256[] memory depositIds,
        uint256[] memory amounts,
        uint256[] memory bdvs,
        bytes32[] memory proof
    ) external;

    function issueFertilizer(
        address owner,
        uint256[] memory fertIds,
        uint128[] memory amounts,
        uint128 lastBpf,
        bytes32[] memory proof
    ) external;

    function issueInternalBalances(
        address owner,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes32[] memory proof
    ) external;

    function issuePlots(
        address owner,
        uint256[] memory index,
        uint256[] memory pods,
        bytes32[] memory proof
    ) external;

    function lastDeltaSoil() external view returns (uint256);

    function lastSeasonOfPlenty() external view returns (uint32);

    function lastSowTime() external view returns (uint256);

    function lastUpdate(address account) external view returns (uint32);

    function leftoverBeans() external view returns (uint256);

    function lightSunrise() external;

    function maxTemperature() external view returns (uint256);

    function maxWeight(bytes memory) external pure returns (uint256);

    function migrateL2Beans(
        address reciever,
        address L2Beanstalk,
        uint256 amount,
        uint8 toMode,
        uint256 maxSubmissionCost,
        uint256 maxGas,
        uint256 gasPriceBid
    ) external payable returns (uint256 ticketID);

    function mintBeans(address to, uint256 amount) external;

    function mintFertilizer(
        uint256 tokenAmountIn,
        uint256 minFertilizerOut,
        uint256 minLPTokensOut
    ) external payable returns (uint256 fertilizerAmountOut);

    function mockBDV(uint256 amount) external pure returns (uint256);

    function mockBDVDecrease(uint256 amount) external pure returns (uint256);

    function mockBDVIncrease(uint256 amount) external pure returns (uint256);

    function mockCalcCaseIdandUpdate(int256 deltaB) external returns (uint256 caseId);

    function mockChangeBDVSelector(address token, bytes4 selector) external;

    function mockEndTotalGerminationForToken(address token) external;

    function mockGetMorningTemp(
        uint256 initalTemp,
        uint256 delta
    ) external pure returns (uint256 scaledTemperature);

    function mockIncrementGermination(
        address account,
        address token,
        uint128 amount,
        uint128 bdv,
        GerminationSide side
    ) external;

    function mockLiquidityWeight() external pure returns (uint256);

    function mockSetAverageGrownStalkPerBdvPerSeason(
        uint128 _averageGrownStalkPerBdvPerSeason
    ) external;

    function mockSow(
        uint256 beans,
        uint256 _morningTemperature,
        uint32 maxTemperature,
        bool abovePeg
    ) external returns (uint256 pods);

    function mockStepGauge() external;

    function mockStepSeason() external returns (uint32 season);

    function mockStepSilo(uint256 amount) external;

    function mockUpdateAverageGrownStalkPerBdvPerSeason() external;

    function mockUpdateAverageStalkPerBdvPerSeason() external;

    function mockUpdateLiquidityWeight(
        address token,
        address newLiquidityWeightImplementation,
        bytes1 encodeType,
        bytes4 selector,
        bytes memory data
    ) external;

    function mockWhitelistToken(
        address token,
        bytes4 selector,
        uint48 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason
    ) external;

    function mockWhitelistTokenWithGauge(
        address token,
        bytes4 selector,
        uint16 stalkIssuedPerBdv,
        uint24 stalkEarnedPerSeason,
        bytes1 encodeType,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external;

    function mockinitializeGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint96 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external;

    function mow(address account, address token) external payable;

    function mowMultiple(address account, address[] memory tokens) external payable;

    function multiPipe(PipeCall[] memory pipes) external payable returns (bytes[] memory results);

    function name() external pure returns (string memory);

    function newMockBDV() external pure returns (uint256);

    function newMockBDVDecrease() external pure returns (uint256);

    function newMockBDVIncrease() external pure returns (uint256);

    function noWeight(bytes memory) external pure returns (uint256);

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) external pure returns (bytes4);

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) external pure returns (bytes4);

    function overallCappedDeltaB() external view returns (int256 deltaB);

    function overallCurrentDeltaB() external view returns (int256 deltaB);

    function owner() external view returns (address owner_);

    function ownerCandidate() external view returns (address ownerCandidate_);

    function pause() external payable;

    function paused() external view returns (bool);

    function payFertilizer(address account, uint256 amount) external payable;

    function permitDeposit(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function permitDeposits(
        address owner,
        address spender,
        address[] memory tokens,
        uint256[] memory values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function permitERC20(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function permitERC721(
        address token,
        address spender,
        uint256 tokenId,
        uint256 deadline,
        bytes memory sig
    ) external payable;

    function permitToken(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;

    function pipe(PipeCall memory p) external payable returns (bytes memory result);

    function pipelineConvert(
        address inputToken,
        int96[] memory stems,
        uint256[] memory amounts,
        address outputToken,
        AdvancedFarmCall[] memory advancedFarmCalls
    )
        external
        payable
        returns (
            int96 toStem,
            uint256 fromAmount,
            uint256 toAmount,
            uint256 fromBdv,
            uint256 toBdv
        );

    function plant() external payable returns (uint256 beans, int96 stem);

    function plentyPerRoot(uint32 _season, address well) external view returns (uint256);

    function plot(address account, uint256 fieldId, uint256 index) external view returns (uint256);

    function podIndex(uint256 fieldId) external view returns (uint256);

    function poolCurrentDeltaB(address pool) external view returns (int256 deltaB);

    function poolDeltaB(address pool) external view returns (int256);

    function publishRequisition(Requisition memory requisition) external;

    function rain() external view returns (Rain memory);

    function rainSiloSunrise(uint256 amount) external;

    function rainSunrise() external;

    function rainSunrises(uint256 amount) external;

    function readPipe(PipeCall memory p) external view returns (bytes memory result);

    function recieveL1Beans(address reciever, uint256 amount, uint8 toMode) external;

    function reentrancyGuardTest() external;

    function remainingPods() external view returns (uint256);

    function remainingRecapitalization() external view returns (uint256);

    function removeWhitelistSelector(address token) external;

    function removeWhitelistStatus(address token) external;

    function resetPools(address[] memory pools) external;

    function resetSeasonStart(uint256 amount) external;

    function resetState() external;

    function resetUnderlying(address unripeToken) external;

    function revert_netFlow() external;

    function revert_oneOutFlow() external;

    function revert_outFlow() external;

    function revert_supplyChange() external;

    function revert_supplyIncrease() external;

    function rewardSilo(uint256 amount) external;

    function rewardSunrise(uint256 amount) external;

    function rewardToFertilizerE(uint256 amount) external;

    function rinsableSprouts() external view returns (uint256);

    function rinsedSprouts() external view returns (uint256);

    function ripen(uint256 amount) external;

    function safeBatchTransferFrom(
        address sender,
        address recipient,
        uint256[] memory depositIds,
        uint256[] memory amounts,
        bytes memory
    ) external;

    function safeTransferFrom(
        address sender,
        address recipient,
        uint256 depositId,
        uint256 amount,
        bytes memory
    ) external;

    function scaledDeltaB(
        uint256 beforeLpTokenSupply,
        uint256 afterLpTokenSupply,
        int256 deltaB
    ) external pure returns (int256);

    function season() external view returns (uint32);

    function seasonTime() external view returns (uint32);

    function seedGaugeSunSunrise(int256 deltaB, uint256 caseId, bool oracleFailure) external;

    function setAbovePegE(bool peg) external;

    function setActiveField(uint256 fieldId, uint32 _temperature) external;

    function setApprovalForAll(address spender, bool approved) external;

    function setBarnRaiseWell(address well) external;

    function setBeanToMaxLpGpPerBdvRatio(uint128 percent) external;

    function setBeanstalkState(
        uint256 price,
        uint256 podRate,
        uint256 changeInSoilDemand,
        uint256 liquidityToSupplyRatio,
        address targetWell
    ) external returns (int256 deltaB);

    function setBpf(uint128 bpf) external;

    function setChangeInSoilDemand(uint256 changeInSoilDemand) external;

    function setCurrentSeasonE(uint32 _season) external;

    function setFertilizerE(bool fertilizing, uint256 unfertilized) external;

    function setL2SR(uint256 liquidityToSupplyRatio, address targetWell) external;

    function setLastDSoilE(uint128 number) external;

    function setLastSowTimeE(uint32 number) external;

    function setMaxTemp(uint32 t) external;

    function setMaxTempE(uint32 number) external;

    function setNextSowTimeE(uint32 _time) external;

    function setPenaltyParams(uint256 recapitalized, uint256 fertilized) external;

    function setPodRate(uint256 podRate) external;

    function setPrice(uint256 price, address targetWell) external returns (int256 deltaB);

    function setRecieverForL1Migration(address owner, address reciever) external;

    function setShipmentRoutes(ShipmentRoute[] memory shipmentRoutes) external;

    function setSoilE(uint256 amount) external;

    function setStalkAndRoots(address account, uint128 stalk, uint256 roots) external;

    function setSunriseBlock(uint256 _block) external;

    function setUsdEthPrice(uint256 price) external;

    function setYieldE(uint256 t) external;

    function siloSunrise(uint256 amount) external;

    function sow(
        uint256 beans,
        uint256 minTemperature,
        uint8 mode
    ) external payable returns (uint256 pods);

    function sowWithMin(
        uint256 beans,
        uint256 minTemperature,
        uint256 minSoil,
        uint8 mode
    ) external payable returns (uint256 pods);

    function stalkEarnedPerSeason(
        address[] memory tokens
    ) external view returns (uint256[] memory stalkEarnedPerSeasons);

    function stealBeans(uint256 amount) external;

    function stemStartSeason() external view returns (uint16);

    function stemTipForToken(address token) external view returns (int96 _stemTip);

    function stepGauge() external;

    function sunSunrise(int256 deltaB, uint256 caseId) external;

    function sunTemperatureSunrise(int256 deltaB, uint256 caseId, uint32 t) external;

    function sunrise() external payable returns (uint256);

    function sunriseBlock() external view returns (uint32);

    function supportsInterface(bytes4 _interfaceId) external view returns (bool);

    function switchUnderlyingToken(
        address unripeToken,
        address newUnderlyingToken
    ) external payable;

    function symbol() external pure returns (string memory);

    function teleportSunrise(uint32 _s) external;

    function temperature() external view returns (uint256);

    function thisSowTime() external view returns (uint256);

    function time() external view returns (Season memory);

    function tokenAllowance(
        address account,
        address spender,
        address token
    ) external view returns (uint256);

    function tokenPermitDomainSeparator() external view returns (bytes32);

    function tokenPermitNonces(address owner) external view returns (uint256);

    function tokenSettings(address token) external view returns (AssetSettings memory);

    function totalDeltaB() external view returns (int256 deltaB);

    function totalEarnedBeans() external view returns (uint256);

    function totalFertilizedBeans() external view returns (uint256 beans);

    function totalFertilizerBeans() external view returns (uint256 beans);

    function totalHarvestable(uint256 fieldId) external view returns (uint256);

    function totalHarvestableForActiveField() external view returns (uint256);

    function totalHarvested(uint256 fieldId) external view returns (uint256);

    function totalPods(uint256 fieldId) external view returns (uint256);

    function totalRainRoots() external view returns (uint256);

    function totalRealSoil() external view returns (uint256);

    function totalRoots() external view returns (uint256);

    function totalSoil() external view returns (uint256);

    function totalSoilAtMorningTemp(
        uint256 morningTemperature
    ) external view returns (uint256 totalSoil);

    function totalStalk() external view returns (uint256);

    function totalUnfertilizedBeans() external view returns (uint256 beans);

    function totalUnharvestable(uint256 fieldId) external view returns (uint256);

    function tractor(
        Requisition memory requisition,
        bytes memory operatorData
    ) external payable returns (bytes[] memory results);

    function transferDeposit(
        address sender,
        address recipient,
        address token,
        int96 stem,
        uint256 amount
    ) external payable returns (uint256 _bdv);

    function transferDeposits(
        address sender,
        address recipient,
        address token,
        int96[] memory stem,
        uint256[] memory amounts
    ) external payable returns (uint256[] memory bdvs);

    function transferERC1155(address token, address to, uint256 id, uint256 value) external payable;

    function transferERC721(address token, address to, uint256 id) external payable;

    function transferInternalTokenFrom(
        address token,
        address sender,
        address recipient,
        uint256 amount,
        uint8 toMode
    ) external payable;

    function transferOwnership(address _newOwner) external;

    function transferPlot(
        address sender,
        address recipient,
        uint256 fieldId,
        uint256 index,
        uint256 start,
        uint256 end
    ) external payable;

    function transferPlots(
        address sender,
        address recipient,
        uint256 fieldId,
        uint256[] memory ids,
        uint256[] memory starts,
        uint256[] memory ends
    ) external payable;

    function transferToken(
        address token,
        address recipient,
        uint256 amount,
        uint8 fromMode,
        uint8 toMode
    ) external payable;

    function unpause() external payable;

    function unripeBeanToBDV(uint256 amount) external view returns (uint256);

    function unripeLPToBDV(uint256 amount) external view returns (uint256);

    function unwrapEth(uint256 amount, uint8 mode) external payable;

    function updateGaugeForToken(
        address token,
        uint64 optimalPercentDepositedBdv,
        Implementation memory gpImplementation,
        Implementation memory lwImplementation
    ) external payable;

    function updateGaugePointImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable;

    function updateLiqudityWeightImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable;

    function updateOracleImplementationForToken(
        address token,
        Implementation memory impl
    ) external payable;

    function updatePublisherCounter(
        bytes32 counterId,
        CounterUpdateType updateType,
        uint256 amount
    ) external returns (uint256 count);

    function updateSeedGaugeSettings(EvaluationParameters memory updatedSeedGaugeSettings) external;

    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) external payable;

    function updateStemScaleSeason(uint16 season) external;

    function updateStems() external;

    function updateTractorVersion(string memory version) external;

    function updateWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) external;

    function upgradeStems() external;

    function uri(uint256 depositId) external view returns (string memory);

    function verifyDepositMerkleProof(
        address owner,
        uint256[] memory depositIds,
        uint256[] memory amounts,
        uint256[] memory bdvs,
        bytes32[] memory proof
    ) external pure returns (bool);

    function verifyFertilizerMerkleProof(
        address owner,
        uint256[] memory fertIds,
        uint128[] memory amounts,
        uint128 lastBpf,
        bytes32[] memory proof
    ) external pure returns (bool);

    function verifyInternalBalanceMerkleProof(
        address owner,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes32[] memory proof
    ) external pure returns (bool);

    function verifyPlotMerkleProof(
        address owner,
        uint256[] memory index,
        uint256[] memory amounts,
        bytes32[] memory proof
    ) external pure returns (bool);

    function weather() external view returns (Weather memory);

    function wellBdv(address token, uint256 amount) external view returns (uint256);

    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot);

    function whitelistToken(
        address token,
        bytes4 selector,
        uint48 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Implementation memory oracleImplementation,
        Implementation memory gaugePointImplementation,
        Implementation memory liquidityWeightImplementation
    ) external payable;

    function withdrawDeposit(
        address token,
        int96 stem,
        uint256 amount,
        uint8 mode
    ) external payable;

    function withdrawDeposits(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint8 mode
    ) external payable;

    function withdrawForConvertE(
        address token,
        int96[] memory stems,
        uint256[] memory amounts,
        uint256 maxTokens
    ) external;

    function woohoo() external pure returns (uint256);

    function wrapEth(uint256 amount, uint8 mode) external payable;
}
