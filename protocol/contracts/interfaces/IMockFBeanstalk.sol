/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

interface IMockFBeanstalk {

    struct AccountSeasonOfPlenty {
        uint32 lastRain;
        uint32 lastSop;
        uint256 roots;
        uint256 plentyPerRoot;
        uint256 plenty;
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

    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    struct FacetCut {
        address facetAddress;
        uint8 action;
        bytes4[] functionSelectors;
    }

    struct MowStatus {
        int96 lastStem;
        uint128 bdv;
    }

    struct PipeCall {
        address target;
        bytes data;
    }

    struct PodListing {
        address account;
        uint256 index;
        uint256 start;
        uint256 amount;
        uint24 pricePerPod;
        uint256 maxHarvestableIndex;
        uint256 minFillAmount;
        uint8 mode;
    }

    struct PodOrder {
        address account;
        uint24 pricePerPod;
        uint256 maxPlaceInLine;
        uint256 minFillAmount;
    }

    struct Rain {
        uint256 deprecated;
        uint256 pods;
        uint256 roots;
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
        uint32 beanEthStartMintingSeason;
        uint256 start;
        uint256 period;
        uint256 timestamp;
    }

    struct SeedGauge {
        uint128 averageGrownStalkPerBdvPerSeason;
        uint128 beanToMaxLpGpPerBdvRatio;
    }

    struct SiloSettings {
        bytes4 selector;
        uint32 stalkEarnedPerSeason;
        uint32 stalkIssuedPerBdv;
        uint32 milestoneSeason;
        int96 milestoneStem;
        bytes1 encodeType;
        int24 deltaStalkEarnedPerSeason;
        bytes4 gpSelector;
        bytes4 lwSelector;
        uint128 gaugePoints;
        uint64 optimalPercentDepositedBdv;
    }

    struct Supply {
        uint128 endBpf;
        uint256 supply;
    }

    struct Weather {
        uint256[2] deprecated;
        uint128 lastDSoil;
        uint32 lastSowTime;
        uint32 thisSowTime;
        uint32 t;
    }

    struct WhitelistStatus {
        address token;
        bool isWhitelisted;
        bool isWhitelistedLp;
        bool isWhitelistedWell;
    }

    event AddDeposit(address indexed account, address indexed token, int96 stem, uint256 amount, uint256 bdv);
    event AddUnripeToken(address indexed unripeToken, address indexed underlyingToken, bytes32 merkleRoot);
    event AddWhitelistStatus(
        address token, uint256 index, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell
    );
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);
    event CancelBlueprint(bytes32 blueprintHash);
    event ChangeUnderlying(address indexed token, int256 underlying);
    event Chop(address indexed account, address indexed token, uint256 amount, uint256 underlying);
    event ClaimPlenty(address indexed account, address token, uint256 plenty);
    event Convert(address indexed account, address fromToken, address toToken, uint256 fromAmount, uint256 toAmount);
    event CreateFundraiser(uint32 indexed id, address payee, address token, uint256 amount);
    event DeltaB(int256 deltaB);
    event DepositApproval(address indexed owner, address indexed spender, address token, uint256 amount);
    event DewhitelistToken(address indexed token);
    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
    event FarmerGerminatingStalkBalanceChanged(address indexed account, int256 delta);
    event GaugePointChange(uint256 indexed season, address indexed token, uint256 gaugePoints);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event Incentivization(address indexed account, uint256 beans);
    event InternalBalanceChanged(address indexed user, address indexed token, int256 delta);
    event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Pause(uint256 timestamp);
    event Pick(address indexed account, address indexed token, uint256 amount);
    event Plant(address indexed account, uint256 beans);
    event PlotTransfer(address indexed from, address indexed to, uint256 indexed id, uint256 pods);
    event PodApproval(address indexed owner, address indexed spender, uint256 pods);
    event PodListingCancelled(address indexed account, uint256 index);
    event PodListingCreated(
        address indexed account,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        bytes pricingFunction,
        uint8 mode,
        uint8 pricingType
    );
    event PodListingFilled(
        address indexed from, address indexed to, uint256 index, uint256 start, uint256 amount, uint256 costInBeans
    );
    event PodOrderCancelled(address indexed account, bytes32 id);
    event PodOrderCreated(
        address indexed account,
        bytes32 id,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes pricingFunction,
        uint8 priceType
    );
    event PodOrderFilled(
        address indexed from,
        address indexed to,
        bytes32 id,
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 costInBeans
    );
    event PublishRequisition(Requisition requisition);
    event RemoveDeposit(address indexed account, address indexed token, int96 stem, uint256 amount, uint256 bdv);
    event RemoveDeposits(
        address indexed account, address indexed token, int96[] stems, uint256[] amounts, uint256 amount, uint256[] bdvs
    );
    event RemoveWhitelistStatus(address token, uint256 index);
    event Reward(uint32 indexed season, uint256 toField, uint256 toSilo, uint256 toFertilizer);
    event SeasonOfPlenty(uint256 indexed season, address well, address token, uint256 amount, uint256 toField);
    event SetFertilizer(uint128 id, uint128 bpf);
    event Soil(uint32 indexed season, uint256 soil);
    event Sow(address indexed account, uint256 index, uint256 beans, uint256 pods);
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);
    event Sunrise(uint256 indexed season);
    event SwitchUnderlyingToken(address indexed token, address indexed underlyingToken);
    event TemperatureChange(uint256 indexed season, uint256 caseId, int8 absChange);
    event TokenApproval(address indexed owner, address indexed spender, address token, uint256 amount);
    event TotalGerminatingBalanceChanged(uint256 season, address indexed token, int256 delta, int256 deltaBdv);
    event Tractor(address indexed operator, bytes32 blueprintHash);
    event TransferBatch(
        address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values
    );
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event URI(string _uri, uint256 indexed _id);
    event Unpause(uint256 timestamp, uint256 timePassed);
    event UpdateAverageStalkPerBdvPerSeason(uint256 newStalkPerBdvPerSeason);
    event UpdateGaugeSettings(
        address indexed token, bytes4 gpSelector, bytes4 lwSelector, uint64 optimalPercentDepositedBdv
    );
    event UpdateTWAPs(uint256[2] balances);
    event UpdateWhitelistStatus(
        address token, uint256 index, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell
    );
    event UpdatedStalkPerBdvPerSeason(address indexed token, uint32 stalkEarnedPerSeason, uint32 season);
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );

    function _getMintFertilizerOut(uint256 tokenAmountIn, address barnRaiseToken)
        external
        view
        returns (uint256 fertilizerAmountOut);
    function _getPenalizedUnderlying(address unripeToken, uint256 amount, uint256 supply)
        external
        view
        returns (uint256 redeem);
    function abovePeg() external view returns (bool);
    function addFertilizer(uint128 id, uint128 tokenAmountIn, uint256 minLpOut) external payable;
    function addFertilizerOwner(uint128 id, uint128 tokenAmountIn, uint256 minLpOut) external payable;
    function addLiquidity(
        address pool,
        address registry,
        uint256[] memory amounts,
        uint256 minAmountOut,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function addMigratedUnderlying(address unripeToken, uint256 amount) external payable;
    function addUnderlying(address unripeToken, uint256 amount) external payable;
    function addUnderlyingWithRecap(address unripeToken, uint256 amount) external payable;
    function addUnripeToken(address unripeToken, address underlyingToken, bytes32 root) external payable;
    function addWhitelistSelector(address token, bytes4 selector) external;
    function addWhitelistStatus(address token, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell)
        external;
    function advancedFarm(AdvancedFarmCall[] memory data) external payable returns (bytes[] memory results);
    function advancedPipe(AdvancedPipeCall[] memory pipes, uint256 value)
        external
        payable
        returns (bytes[] memory results);
    function allowancePods(address owner, address spender) external view returns (uint256);
    function applyPenaltyToGrownStalks(uint256 penaltyBdv, uint256[] memory bdvsRemoved, uint256[] memory grownStalks)
        external
        view
        returns (uint256[] memory);
    function approveDeposit(address spender, address token, uint256 amount) external payable;
    function approvePods(address spender, uint256 amount) external payable;
    function approveToken(address spender, address token, uint256 amount) external payable;
    function balanceOf(address account, uint256 depositId) external view returns (uint256 amount);
    function balanceOfBatch(address[] memory accounts, uint256[] memory depositIds)
        external
        view
        returns (uint256[] memory);
    function balanceOfBatchFertilizer(address[] memory accounts, uint256[] memory ids)
        external
        view
        returns (Balance[] memory);
    function balanceOfDepositedBdv(address account, address token) external view returns (uint256 depositedBdv);
    function balanceOfEarnedBeans(address account) external view returns (uint256 beans);
    function balanceOfEarnedStalk(address account) external view returns (uint256);
    function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256 beans);
    function balanceOfFertilizer(address account, uint256 id) external view returns (Balance memory);
    function balanceOfFinishedGerminatingStalkAndRoots(address account)
        external
        view
        returns (uint256 gStalk, uint256 gRoots);
    function balanceOfGerminatingStalk(address account) external view returns (uint256);
    function balanceOfGrownStalk(address account, address token) external view returns (uint256);
    function balanceOfGrownStalkLegacy(address account) external view returns (uint256);
    function balanceOfGrownStalkUpToStemsDeployment(address account) external view returns (uint256);
    function balanceOfLegacySeeds(address account) external view returns (uint256);
    function balanceOfPenalizedUnderlying(address unripeToken, address account)
        external
        view
        returns (uint256 underlying);
    function balanceOfPlenty(address account) external view returns (uint256 plenty);
    function balanceOfRainRoots(address account) external view returns (uint256);
    function balanceOfRoots(address account) external view returns (uint256);
    function balanceOfSeeds(address account) external view returns (uint256);
    function balanceOfSop(address account) external view returns (AccountSeasonOfPlenty memory sop);
    function balanceOfStalk(address account) external view returns (uint256);
    function balanceOfUnderlying(address unripeToken, address account) external view returns (uint256 underlying);
    function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256 beans);
    function balanceOfYoungAndMatureGerminatingStalk(address account)
        external
        view
        returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk);
    function batchTransferERC1155(address token, address to, uint256[] memory ids, uint256[] memory values)
        external
        payable;
    function bdv(address token, uint256 amount) external view returns (uint256 _bdv);
    function beanSown() external view returns (uint256);
    function beanToBDV(uint256 amount) external pure returns (uint256);
    function beansPerFertilizer() external view returns (uint128 bpf);
    function beginBarnRaiseMigration(address well) external;
    function calcCaseIdE(int256 deltaB, uint128 endSoil) external;
    function calcCaseIdWithParams(
        uint256 pods,
        uint256 _lastDSoil,
        uint128 beanSown,
        uint128 endSoil,
        int256 deltaB,
        bool raining,
        bool rainRoots,
        bool aboveQ,
        uint256 L2SRState
    ) external;
    function cancelPodListing(uint256 index) external payable;
    function cancelPodOrder(uint24 pricePerPod, uint256 maxPlaceInLine, uint256 minFillAmount, uint8 mode)
        external
        payable;
    function cancelPodOrderV2(uint256 maxPlaceInLine, uint256 minFillAmount, bytes memory pricingFunction, uint8 mode)
        external
        payable;
    function captureCurveE() external returns (int256 deltaB);
    function captureE() external returns (int256 deltaB);
    function captureWellE(address well) external returns (int256 deltaB);
    function chop(address unripeToken, uint256 amount, uint8 fromMode, uint8 toMode) external payable returns (uint256);
    function claimFertilized(uint256[] memory ids, uint8 mode) external payable;
    function claimOwnership() external;
    function claimPlenty() external payable;
    function claimWithdrawal(address token, uint32 season, uint8 mode) external payable;
    function claimWithdrawals(address token, uint32[] memory seasons, uint8 mode) external payable;
    function convert(bytes memory convertData, int96[] memory stems, uint256[] memory amounts)
        external
        payable
        returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv);
    function convertInternalE(address tokenIn, uint256 amountIn, bytes memory convertData)
        external
        returns (address toToken, address fromToken, uint256 toAmount, uint256 fromAmount);
    function createFundraiser(address payee, address token, uint256 amount) external payable;
    function createFundraiserE(address fundraiser, address token, uint256 amount) external;
    function createPodListing(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint24 pricePerPod,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        uint8 mode
    ) external payable;
    function createPodListingV2(
        uint256 index,
        uint256 start,
        uint256 amount,
        uint256 maxHarvestableIndex,
        uint256 minFillAmount,
        bytes memory pricingFunction,
        uint8 mode
    ) external payable;
    function createPodOrder(
        uint256 beanAmount,
        uint24 pricePerPod,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        uint8 mode
    ) external payable returns (bytes32 id);
    function createPodOrderV2(
        uint256 beanAmount,
        uint256 maxPlaceInLine,
        uint256 minFillAmount,
        bytes memory pricingFunction,
        uint8 mode
    ) external payable returns (bytes32 id);
    function curveToBDV(uint256 amount) external view returns (uint256);
    function decreaseDepositAllowance(address spender, address token, uint256 subtractedValue)
        external
        returns (bool);
    function decreaseTokenAllowance(address spender, address token, uint256 subtractedValue) external returns (bool);
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints);
    function deployStemsUpgrade() external;
    function deposit(address token, uint256 _amount, uint8 mode)
        external
        payable
        returns (uint256 amount, uint256 _bdv, int96 stem);
    function depositAllowance(address owner, address spender, address token) external view returns (uint256);
    function depositForConvertE(address token, uint256 amount, uint256 bdv, uint256 grownStalk) external;
    function depositLegacy(address token, uint256 amount, uint8 mode) external payable;
    function depositPermitDomainSeparator() external view returns (bytes32);
    function depositPermitNonces(address owner) external view returns (uint256);
    function determineReward(uint256 initialGasLeft, uint256 blocksLate, uint256 beanEthPrice)
        external
        view
        returns (uint256);
    function dewhitelistToken(address token) external payable;
    function diamondCut(FacetCut[] memory _diamondCut, address _init, bytes memory _calldata) external;
    function droughtSiloSunrise(uint256 amount) external;
    function droughtSunrise() external;
    function enrootDeposit(address token, int96 stem, uint256 amount) external payable;
    function enrootDeposits(address token, int96[] memory stems, uint256[] memory amounts) external payable;
    function etherPipe(PipeCall memory p, uint256 value) external payable returns (bytes memory result);
    function evaluatePolynomialIntegrationPiecewise(bytes memory f, uint256 start, uint256 end)
        external
        pure
        returns (uint256);
    function evaluatePolynomialPiecewise(bytes memory f, uint256 x) external pure returns (uint256);
    function exchange(
        address pool,
        address registry,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function exchangeUnderlying(
        address pool,
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);
    function facetAddresses() external view returns (address[] memory facetAddresses_);
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);
    function facets() external view returns (Facet[] memory facets_);
    function farm(bytes[] memory data) external payable returns (bytes[] memory results);
    function farmSunrise() external;
    function farmSunrises(uint256 number) external;
    function fastForward(uint32 _s) external;
    function fertilize(uint256 amount) external;
    function fertilizerSunrise(uint256 amount) external;
    function fillPodListing(PodListing memory l, uint256 beanAmount, uint8 mode) external payable;
    function fillPodListingV2(PodListing memory l, uint256 beanAmount, bytes memory pricingFunction, uint8 mode)
        external
        payable;
    function fillPodOrder(PodOrder memory o, uint256 index, uint256 start, uint256 amount, uint8 mode) external payable;
    function fillPodOrderV2(
        PodOrder memory o,
        uint256 index,
        uint256 start,
        uint256 amount,
        bytes memory pricingFunction,
        uint8 mode
    ) external payable;
    function findPiecewiseIndex(bytes memory breakpoints, uint256 value, uint256 high)
        external
        pure
        returns (uint256);
    function forceSunrise() external;
    function getAbsBeanToMaxLpRatioChangeFromCaseId(uint256 caseId) external view returns (uint80 ml);
    function getAbsTemperatureChangeFromCaseId(uint256 caseId) external view returns (int8 t);
    function getActiveFertilizer() external view returns (uint256);
    function getAllBalance(address account, address token) external view returns (Balance memory b);
    function getAllBalances(address account, address[] memory tokens)
        external
        view
        returns (Balance[] memory balances);
    function getAmountBeansToFillOrderV2(uint256 placeInLine, uint256 amountPodsFromOrder, bytes memory pricingFunction)
        external
        pure
        returns (uint256 beanAmount);
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
    function getAmountPodsFromFillListingV2(
        uint256 placeInLine,
        uint256 podListingAmount,
        uint256 fillBeanAmount,
        bytes memory pricingFunction
    ) external pure returns (uint256 amount);
    function getAverageGrownStalkPerBdv() external view returns (uint256);
    function getAverageGrownStalkPerBdvPerSeason() external view returns (uint128);
    function getBalance(address account, address token) external view returns (uint256 balance);
    function getBalances(address account, address[] memory tokens) external view returns (uint256[] memory balances);
    function getBarnRaiseToken() external view returns (address);
    function getBarnRaiseWell() external view returns (address);
    function getBeanEthGaugePointsPerBdv() external view returns (uint256);
    function getBeanGaugePointsPerBdv() external view returns (uint256);
    function getBeanToMaxLpGpPerBdvRatio() external view returns (uint256);
    function getBeanToMaxLpGpPerBdvRatioScaled() external view returns (uint256);
    function getCaseData(uint256 caseId) external view returns (bytes32 casesData);
    function getCases() external view returns (bytes32[144] memory cases);
    function getChainlinkEthUsdPrice() external view returns (uint256);
    function getChainlinkTwapEthUsdPrice(uint256 lookback) external view returns (uint256);
    function getChangeFromCaseId(uint256 caseId) external view returns (uint32, int8, uint80, int80);
    function getCurrentHumidity() external view returns (uint128 humidity);
    function getDeltaPodDemand() external view returns (uint256);
    function getDeposit(address account, address token, int96 stem) external view returns (uint256, uint256);
    function getDepositId(address token, int96 stem) external pure returns (uint256);
    function getDepositLegacy(address account, address token, uint32 season) external view returns (uint128, uint128);
    function getEndBpf() external view returns (uint128 endBpf);
    function getEthUsdPrice() external view returns (uint256);
    function getEthUsdTwap(uint256 lookback) external view returns (uint256);
    function getEvenGerminating(address token) external view returns (uint256, uint256);
    function getExternalBalance(address account, address token) external view returns (uint256 balance);
    function getExternalBalances(address account, address[] memory tokens)
        external
        view
        returns (uint256[] memory balances);
    function getFertilizer(uint128 id) external view returns (uint256);
    function getFertilizers() external view returns (Supply[] memory fertilizers);
    function getFirst() external view returns (uint128);
    function getGaugePoints(address token) external view returns (uint256);
    function getGaugePointsPerBdvForToken(address token) external view returns (uint256);
    function getGaugePointsPerBdvForWell(address well) external view returns (uint256);
    function getGerminatingRootsForSeason(uint32 season) external view returns (uint256);
    function getGerminatingStalkAndRootsForSeason(uint32 season) external view returns (uint256, uint256);
    function getGerminatingStalkForSeason(uint32 season) external view returns (uint256);
    function getGerminatingTotalDeposited(address token) external view returns (uint256 amount);
    function getGerminatingTotalDepositedBdv(address token) external view returns (uint256 _bdv);
    function getGrownStalkIssuedPerGp() external view returns (uint256);
    function getGrownStalkIssuedPerSeason() external view returns (uint256);
    function getHumidity(uint128 _s) external pure returns (uint128 humidity);
    function getInternalBalance(address account, address token) external view returns (uint256 balance);
    function getInternalBalances(address account, address[] memory tokens)
        external
        view
        returns (uint256[] memory balances);
    function getLargestLiqWell() external view returns (address);
    function getLast() external view returns (uint128);
    function getLastMowedStem(address account, address token) external view returns (int96 lastStem);
    function getLegacySeedsPerToken(address token) external view returns (uint256);
    function getLiquidityToSupplyRatio() external view returns (uint256);
    function getLockedBeans() external view returns (uint256);
    function getLockedBeansUnderlyingUnripeBean() external view returns (uint256);
    function getLockedBeansUnderlyingUnripeLP() external view returns (uint256);
    function getMaxAmountIn(address tokenIn, address tokenOut) external view returns (uint256 amountIn);
    function getMintFertilizerOut(uint256 tokenAmountIn) external view returns (uint256 fertilizerAmountOut);
    function getMowStatus(address account, address token) external view returns (MowStatus memory mowStatus);
    function getNext(uint128 id) external view returns (uint128);
    function getNextSeasonStart() external view returns (uint256);
    function getOddGerminating(address token) external view returns (uint256, uint256);
    function getPenalizedUnderlying(address unripeToken, uint256 amount) external view returns (uint256 redeem);
    function getPenalty(address unripeToken) external view returns (uint256 penalty);
    function getPercentPenalty(address unripeToken) external view returns (uint256 penalty);
    function getPodRate() external view returns (uint256);
    function getPoolDeltaBWithoutCap(address well) external view returns (int256 deltaB);
    function getRecapFundedPercent(address unripeToken) external view returns (uint256 percent);
    function getRecapPaidPercent() external view returns (uint256 percent);
    function getRelBeanToMaxLpRatioChangeFromCaseId(uint256 caseId) external view returns (int80 l);
    function getRelTemperatureChangeFromCaseId(uint256 caseId) external view returns (uint32 mt);
    function getSeasonStart() external view returns (uint256);
    function getSeasonStruct() external view returns (Season memory);
    function getSeasonTimestamp() external view returns (uint256);
    function getSeedGauge() external view returns (SeedGauge memory);
    function getSiloTokens() external view returns (address[] memory tokens);
    function getSopWell() external view returns (address);
    function getT() external view returns (uint256);
    function getTotalBdv() external view returns (uint256 totalBdv);
    function getTotalDeposited(address token) external view returns (uint256);
    function getTotalDepositedBdv(address token) external view returns (uint256);
    function getTotalGerminatingAmount(address token) external view returns (uint256);
    function getTotalGerminatingBdv(address token) external view returns (uint256);
    function getTotalGerminatingStalk() external view returns (uint256);
    function getTotalUnderlying(address unripeToken) external view returns (uint256 underlying);
    function getTotalUsdLiquidity() external view returns (uint256 totalLiquidity);
    function getTotalWeightedUsdLiquidity() external view returns (uint256 totalWeightedLiquidity);
    function getTotalWithdrawn(address token) external view returns (uint256);
    function getTwaLiquidityForWell(address well) external view returns (uint256);
    function getUnderlying(address unripeToken, uint256 amount) external view returns (uint256 underlyingAmount);
    function getUnderlyingPerUnripeToken(address unripeToken) external view returns (uint256 underlyingPerToken);
    function getUnderlyingToken(address unripeToken) external view returns (address underlyingToken);
    function getUsdPrice(address token) external view returns (uint256);
    function getWeightedTwaLiquidityForWell(address well) external view returns (uint256);
    function getWhitelistStatus(address token) external view returns (WhitelistStatus memory _whitelistStatuses);
    function getWhitelistStatuses() external view returns (WhitelistStatus[] memory _whitelistStatuses);
    function getWhitelistedLpTokens() external view returns (address[] memory tokens);
    function getWhitelistedTokens() external view returns (address[] memory tokens);
    function getWhitelistedWellLpTokens() external view returns (address[] memory tokens);
    function getWithdrawal(address account, address token, uint32 season) external view returns (uint256);
    function getWstethEthPrice() external view returns (uint256);
    function getWstethEthTwap(uint256 lookback) external view returns (uint256);
    function getWstethUsdPrice() external view returns (uint256);
    function getWstethUsdTwap(uint256 lookback) external view returns (uint256);
    function getYoungAndMatureGerminatingTotalStalk()
        external
        view
        returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk);
    function gm(address account, uint8 mode) external payable returns (uint256);
    function grownStalkForDeposit(address account, address token, int96 stem)
        external
        view
        returns (uint256 grownStalk);
    function harvest(uint256[] memory plots, uint8 mode) external payable;
    function harvestableIndex() external view returns (uint256);
    function imageURI(address token, int96 stem, int96 stemTip) external view returns (string memory);
    function increaseDepositAllowance(address spender, address token, uint256 addedValue) external returns (bool);
    function increaseTokenAllowance(address spender, address token, uint256 addedValue) external returns (bool);
    function incrementTotalHarvestableE(uint256 amount) external;
    function incrementTotalPodsE(uint256 amount) external;
    function incrementTotalSoilE(uint128 amount) external;
    function initOracleForAllWhitelistedWells() external;
    function isApprovedForAll(address _owner, address _operator) external view returns (bool);
    function isFertilizing() external view returns (bool);
    function isUnripe(address unripeToken) external view returns (bool unripe);
    function lastDSoil() external view returns (uint256);
    function lastSeasonOfPlenty() external view returns (uint32);
    function lastSowTime() external view returns (uint256);
    function lastUpdate(address account) external view returns (uint32);
    function lightSunrise() external;
    function maxTemperature() external view returns (uint256);
    function maxWeight() external pure returns (uint256);
    function migrationNeeded(address account) external view returns (bool hasMigrated);
    function mintBeans(address to, uint256 amount) external;
    function mintFertilizer(uint256 tokenAmountIn, uint256 minFertilizerOut, uint256 minLPTokensOut)
        external
        payable
        returns (uint256 fertilizerAmountOut);
    function mockBDV(uint256 amount) external pure returns (uint256);
    function mockBDVIncrease(uint256 amount) external pure returns (uint256);
    function mockCalcCaseIdandUpdate(int256 deltaB) external returns (uint256 caseId);
    function mockEndTotalGerminationForToken(address token) external;
    function mockGetMorningTemp(uint256 initalTemp, uint256 delta) external pure returns (uint256 scaledTemperature);
    function mockGetSeedsPerToken(address token) external pure returns (uint256);
    function mockIncrementGermination(address token, uint128 amount, uint128 bdv, uint8 germ) external;
    function mockInitalizeGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint96 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external;
    function mockLiquidityWeight() external pure returns (uint256);
    function mockSeasonToStem(address token, uint32 season) external view returns (int96 stem);
    function mockSetAverageGrownStalkPerBdvPerSeason(uint128 _averageGrownStalkPerBdvPerSeason) external;
    function mockSetBean3CrvOracle(uint256[2] memory reserves) external;
    function mockSetSopWell(address well) external;
    function mockSow(uint256 beans, uint256 _morningTemperature, uint32 maxTemperature, bool abovePeg)
        external
        returns (uint256 pods);
    function mockStepGauge() external;
    function mockStepSeason() external returns (uint32 season);
    function mockStepSilo(uint256 amount) external;
    function mockUnripeBeanDeposit(uint32 _s, uint256 amount) external;
    function mockUnripeLPDeposit(uint256 t, uint32 _s, uint256 amount, uint256 bdv) external;
    function mockUpdateAverageStalkPerBdvPerSeason() external;
    function mockUpdateLiquidityWeight(address token, bytes4 selector) external;
    function mockWhitelistToken(address token, bytes4 selector, uint16 stalkIssuedPerBdv, uint24 stalkEarnedPerSeason)
        external;
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
    function mow(address account, address token) external payable;
    function mowAndMigrate(
        address account,
        address[] memory tokens,
        uint32[][] memory seasons,
        uint256[][] memory amounts,
        uint256 stalkDiff,
        uint256 seedsDiff,
        bytes32[] memory proof
    ) external payable;
    function mowAndMigrateNoDeposits(address account) external payable;
    function mowMultiple(address account, address[] memory tokens) external payable;
    function multiPipe(PipeCall[] memory pipes) external payable returns (bytes[] memory results);
    function name() external pure returns (string memory);
    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory)
        external
        pure
        returns (bytes4);
    function onERC1155Received(address, address, uint256, uint256, bytes memory) external pure returns (bytes4);
    function overallCappedDeltaB() external view returns (int256 deltaB);
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
    function permitERC721(address token, address spender, uint256 tokenId, uint256 deadline, bytes memory sig)
        external
        payable;
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
    function pick(address token, uint256 amount, bytes32[] memory proof, uint8 mode) external payable;
    function picked(address account, address token) external view returns (bool);
    function pipe(PipeCall memory p) external payable returns (bytes memory result);
    function pipelineConvert(
        address inputToken,
        int96[] memory stems,
        uint256[] memory amounts,
        address outputToken,
        AdvancedFarmCall[] memory farmCalls
    ) external payable returns (int96[] memory outputStems, uint256[] memory outputAmounts);
    function plant() external payable returns (uint256 beans, int96 stem);
    function plentyPerRoot(uint32 _season) external view returns (uint256);
    function plot(address account, uint256 index) external view returns (uint256);
    function podIndex() external view returns (uint256);
    function podListing(uint256 index) external view returns (bytes32);
    function podOrder(address account, uint24 pricePerPod, uint256 maxPlaceInLine, uint256 minFillAmount)
        external
        view
        returns (uint256);
    function podOrderById(bytes32 id) external view returns (uint256);
    function podOrderV2(address account, uint256 maxPlaceInLine, uint256 minFillAmount, bytes memory pricingFunction)
        external
        view
        returns (uint256);
    function poolDeltaB(address pool) external view returns (int256);
    function poolDeltaBInsta(address pool) external view returns (int256 deltaB);
    function publishRequisition(Requisition memory requisition) external;
    function rain() external view returns (Rain memory);
    function rainSiloSunrise(uint256 amount) external;
    function rainSunrise() external;
    function rainSunrises(uint256 amount) external;
    function readPipe(PipeCall memory p) external view returns (bytes memory result);
    function reentrancyGuardTest() external;
    function remainingFunding(uint32 id) external view returns (uint256);
    function remainingPods() external view returns (uint256);
    function remainingRecapitalization() external view returns (uint256);
    function removeLiquidity(
        address pool,
        address registry,
        uint256 amountIn,
        uint256[] memory minAmountsOut,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function removeLiquidityImbalance(
        address pool,
        address registry,
        uint256[] memory amountsOut,
        uint256 maxAmountIn,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function removeLiquidityOneToken(
        address pool,
        address registry,
        address toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        uint8 fromMode,
        uint8 toMode
    ) external payable;
    function removeWhitelistSelector(address token) external;
    function removeWhitelistStatus(address token) external;
    function resetPools(address[] memory pools) external;
    function resetSeasonStart(uint256 amount) external;
    function resetState() external;
    function rewardSilo(uint256 amount) external;
    function rewardSunrise(uint256 amount) external;
    function rewardToFertilizerE(uint256 amount) external;
    function ripen(uint256 amount) external;
    function safeBatchTransferFrom(
        address sender,
        address recipient,
        uint256[] memory depositIds,
        uint256[] memory amounts,
        bytes memory
    ) external;
    function safeTransferFrom(address sender, address recipient, uint256 depositId, uint256 amount, bytes memory)
        external;
    function season() external view returns (uint32);
    function seasonTime() external view returns (uint32);
    function seasonToStem(address token, uint32 season) external view returns (int96 stem);
    function seedGaugeSunSunrise(int256 deltaB, uint256 caseId) external;
    function setAbovePegE(bool peg) external;
    function setApprovalForAll(address spender, bool approved) external;
    function setBarnRaiseWell(address welll) external;
    function setBeanToMaxLpGpPerBdvRatio(uint128 percent) external;
    function setBeanstalkState(
        uint256 price,
        uint256 podRate,
        uint256 changeInSoilDemand,
        uint256 liquidityToSupplyRatio,
        address targetWell
    ) external returns (int256 deltaB);
    function setChangeInSoilDemand(uint256 changeInSoilDemand) external;
    function setCurrentSeasonE(uint32 _season) external;
    function setFertilizerE(bool fertilizing, uint256 unfertilized) external;
    function setL2SR(uint256 liquidityToSupplyRatio, address targetWell) external;
    function setLastDSoilE(uint128 number) external;
    function setLastSowTimeE(uint32 number) external;
    function setMaxTemp(uint32 t) external;
    function setMaxTempE(uint32 number) external;
    function setMerkleRootE(address unripeToken, bytes32 root) external;
    function setNextSowTimeE(uint32 _time) external;
    function setPenaltyParams(uint256 recapitalized, uint256 fertilized) external;
    function setPodRate(uint256 podRate) external;
    function setPrice(uint256 price, address targetWell) external returns (int256 deltaB);
    function setSoilE(uint256 amount) external;
    function setSunriseBlock(uint256 _block) external;
    function setUsdEthPrice(uint256 price) external;
    function setYieldE(uint256 t) external;
    function siloSunrise(uint256 amount) external;
    function sow(uint256 beans, uint256 minTemperature, uint8 mode) external payable returns (uint256 pods);
    function sowWithMin(uint256 beans, uint256 minTemperature, uint256 minSoil, uint8 mode)
        external
        payable
        returns (uint256 pods);
    function stemStartSeason() external view returns (uint16);
    function stemTipForToken(address token) external view returns (int96 _stemTip);
    function stepGauge() external;
    function sunSunrise(int256 deltaB, uint256 caseId) external;
    function sunTemperatureSunrise(int256 deltaB, uint256 caseId, uint32 t) external;
    function sunrise() external payable returns (uint256);
    function sunriseBlock() external view returns (uint32);
    function supportsInterface(bytes4 _interfaceId) external view returns (bool);
    function switchUnderlyingToken(address unripeToken, address newUnderlyingToken) external payable;
    function symbol() external pure returns (string memory);
    function teleportSunrise(uint32 _s) external;
    function temperature() external view returns (uint256);
    function thisSowTime() external view returns (uint256);
    function time() external view returns (Season memory);
    function tokenAllowance(address account, address spender, address token) external view returns (uint256);
    function tokenPermitDomainSeparator() external view returns (bytes32);
    function tokenPermitNonces(address owner) external view returns (uint256);
    function tokenSettings(address token) external view returns (SiloSettings memory);
    function totalDeltaB() external view returns (int256 deltaB);
    function totalEarnedBeans() external view returns (uint256);
    function totalFertilizedBeans() external view returns (uint256 beans);
    function totalFertilizerBeans() external view returns (uint256 beans);
    function totalFunding(uint32 id) external view returns (uint256);
    function totalHarvestable() external view returns (uint256);
    function totalHarvested() external view returns (uint256);
    function totalMigratedBdv(address token) external view returns (uint256);
    function totalPods() external view returns (uint256);
    function totalRealSoil() external view returns (uint256);
    function totalRoots() external view returns (uint256);
    function totalSeeds() external view returns (uint256);
    function totalSoil() external view returns (uint256);
    function totalSoilAtMorningTemp(uint256 morningTemperature) external view returns (uint256 totalSoil);
    function totalStalk() external view returns (uint256);
    function totalUnfertilizedBeans() external view returns (uint256 beans);
    function totalUnharvestable() external view returns (uint256);
    function tractor(Requisition memory requisition, bytes memory operatorData)
        external
        payable
        returns (bytes[] memory results);
    function transferDeposit(address sender, address recipient, address token, int96 stem, uint256 amount)
        external
        payable
        returns (uint256 _bdv);
    function transferDeposits(
        address sender,
        address recipient,
        address token,
        int96[] memory stem,
        uint256[] memory amounts
    ) external payable returns (uint256[] memory bdvs);
    function transferERC1155(address token, address to, uint256 id, uint256 value) external payable;
    function transferERC721(address token, address to, uint256 id) external payable;
    function transferInternalTokenFrom(address token, address sender, address recipient, uint256 amount, uint8 toMode)
        external
        payable;
    function transferOwnership(address _newOwner) external;
    function transferPlot(address sender, address recipient, uint256 id, uint256 start, uint256 end) external payable;
    function transferToken(address token, address recipient, uint256 amount, uint8 fromMode, uint8 toMode)
        external
        payable;
    function unpause() external payable;
    function unripeBeanToBDV(uint256 amount) external view returns (uint256);
    function unripeLPToBDV(uint256 amount) external view returns (uint256);
    function unwrapEth(uint256 amount, uint8 mode) external payable;
    function update3CRVOracle() external;
    function updateGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint64 optimalPercentDepositedBdv
    ) external payable;
    function updateStalkPerBdvPerSeasonForToken(address token, uint32 stalkEarnedPerSeason) external payable;
    function updateStemScaleSeason(uint16 season) external;
    function updateStems() external;
    function updateTWAPCurveE() external returns (uint256[2] memory balances);
    function updateWhitelistStatus(address token, bool isWhitelisted, bool isWhitelistedLp, bool isWhitelistedWell)
        external;
    function upgradeStems() external;
    function uri(uint256 depositId) external view returns (string memory);
    function weather() external view returns (Weather memory);
    function wellBdv(address token, uint256 amount) external view returns (uint256);
    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot);
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external payable;
    function whitelistTokenWithEncodeType(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) external payable;
    function withdrawDeposit(address token, int96 stem, uint256 amount, uint8 mode) external payable;
    function withdrawDeposits(address token, int96[] memory stems, uint256[] memory amounts, uint8 mode)
        external
        payable;
    function withdrawForConvertE(address token, int96[] memory stems, uint256[] memory amounts, uint256 maxTokens)
        external;
    function woohoo() external pure returns (uint256);
    function wrapEth(uint256 amount, uint8 mode) external payable;
    function yield() external view returns (uint32);
}
