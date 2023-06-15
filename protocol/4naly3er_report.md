# Report

## Gas Optimizations

|                   | Issue                                                                                                 | Instances |
| ----------------- | :---------------------------------------------------------------------------------------------------- | :-------: |
| [GAS-1](#GAS-1)   | `array[index] += amount` is cheaper than `array[index] = array[index] + amount` (or related variants) |     1     |
| [GAS-2](#GAS-2)   | Using bools for storage incurs overhead                                                               |     6     |
| [GAS-3](#GAS-3)   | Cache array length outside of loop                                                                    |    56     |
| [GAS-4](#GAS-4)   | State variables should be cached in stack variables rather than re-reading them from storage          |     6     |
| [GAS-5](#GAS-5)   | Use calldata instead of memory for function arguments that do not get mutated                         |    68     |
| [GAS-6](#GAS-6)   | Use Custom Errors                                                                                     |    206    |
| [GAS-7](#GAS-7)   | Don't initialize variables with default value                                                         |    45     |
| [GAS-8](#GAS-8)   | Long revert strings                                                                                   |    71     |
| [GAS-9](#GAS-9)   | Functions guaranteed to revert when called by normal users can be marked `payable`                    |     4     |
| [GAS-10](#GAS-10) | `++i` costs less gas than `i++`, especially when it's used in `for`-loops (`--i`/`i--` too)           |    25     |
| [GAS-11](#GAS-11) | Using `private` rather than `public` for constants, saves gas                                         |     3     |
| [GAS-12](#GAS-12) | Use shift Right/Left instead of division/multiplication if possible                                   |     3     |
| [GAS-13](#GAS-13) | Splitting require() statements that use && saves gas                                                  |    19     |
| [GAS-14](#GAS-14) | Use != 0 instead of > 0 for unsigned integer comparison                                               |    123    |
| [GAS-15](#GAS-15) | `internal` functions not called by the contract should be removed                                     |    229    |

### <a name="GAS-1"></a>[GAS-1] `array[index] += amount` is cheaper than `array[index] = array[index] + amount` (or related variants)

When updating a value in an array with arithmetic, using `array[index] += amount` is cheaper than `array[index] = array[index] + amount`.
This is because you avoid an additonal `mload` when the array is stored in memory, and an `sload` when the array is stored in storage.
This can be applied for any arithmetic operation including `+=`, `-=`,`/=`,`*=`,`^=`,`&=`, `%=`, `<<=`,`>>=`, and `>>>=`.
This optimization can be particularly significant if the pattern occurs during a loop.

_Saves 28 gas for a storage array, 38 for a memory array_

_Instances (1)_:

```solidity
File: mocks/curve/MockMeta3Curve.sol

196:         balances[i] = balances[i] + dx;

```

### <a name="GAS-2"></a>[GAS-2] Using bools for storage incurs overhead

Use uint256(1) and uint256(2) for true/false to avoid a Gwarmaccess (100 gas), and to avoid Gsset (20000 gas) when changing from ‘false’ to ‘true’, after having been ‘true’ in the past. See [source](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/58f635312aa21f947cae5f8578638a85aa2519f5/contracts/security/ReentrancyGuard.sol#L23-L27).

_Instances (6)_:

```solidity
File: beanstalk/AppStorage.sol

158:         mapping(address => bool) isApprovedForAll; // ERC1155 isApprovedForAll mapping

231:         mapping(uint32 => mapping(address => bool)) voted;

517:     mapping (address => bool) deprecated_isBudget;

531:     mapping(address => mapping(address => bool)) unripeClaimed;

```

```solidity
File: beanstalk/AppStorageOld.sol

121:         mapping(uint32 => mapping(address => bool)) voted;

```

```solidity
File: libraries/LibDiamond.sol

39:         mapping(bytes4 => bool) supportedInterfaces;

```

### <a name="GAS-3"></a>[GAS-3] Cache array length outside of loop

If not cached, the solidity compiler will always read the length of the array during each iteration. That is, if it is a storage array, this is an extra sload operation (100 additional extra gas for each iteration except for the first) and if it is a memory array, this is an extra mload operation (3 additional gas for each iteration except for the first).

_Instances (56)_:

```solidity
File: beanstalk/farm/FarmFacet.sol

42:         for (uint256 i; i < data.length; ++i) {

60:         for (uint256 i = 0; i < data.length; ++i) {

```

```solidity
File: beanstalk/farm/TokenFacet.sol

279:         for (uint256 i; i < tokens.length; ++i) {

306:         for (uint256 i; i < tokens.length; ++i) {

334:         for (uint256 i; i < tokens.length; ++i) {

363:         for (uint256 i; i < tokens.length; ++i) {

```

```solidity
File: beanstalk/field/FieldFacet.sol

175:         for (uint256 i; i < plots.length; ++i) {

```

```solidity
File: beanstalk/init/replant/Replant3.sol

61:         for (uint256 i; i < harvests.length; ++i) {

67:         for (uint256 i; i < podListings.length; ++i) {

71:         for (uint256 i; i < podOrders.length; ++i) {

75:         for (uint256 i; i < withdrawals.length; ++i) {

89:         for (uint256 i; i < plots.length; ++i) {

```

```solidity
File: beanstalk/init/replant/Replant4.sol

52:         for (uint256 i; i < w.length; ++i) {

61:         for (uint256 i; i < w.length; ++i) {

62:             for (uint256 j = 0; j < w[i].seasons.length; j++) {

```

```solidity
File: beanstalk/init/replant/Replant5.sol

49:         for (uint256 i; i < ds.length; ++i) {

53:             for (uint256 j; j < d.seasons.length; ++j) {

```

```solidity
File: beanstalk/init/replant/Replant6.sol

67:         for (uint256 i; i < ds.length; ++i) {

80:             for (uint256 j; j < d.seasons.length; ++j) {

```

```solidity
File: beanstalk/init/replant/Replant7.sol

50:         for (uint256 i; i < earned.length; ++i) {

```

```solidity
File: beanstalk/silo/ApprovalFacet.sol

126:         for (uint256 i; i < tokens.length; ++i) {

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

206:         for (uint256 i; i < stems.length; ++i) {

313:             for (i; i < stems.length; ++i) amounts[i] = 0;

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

183:         for (uint256 i = 0; i < amounts.length; i++) {

252:         for(uint i; i < depositIds.length; i++) {

277:         for (uint256 i; i < tokens.length; ++i) {

```

```solidity
File: beanstalk/silo/SiloFacet/TokenSilo.sol

346:         for (uint256 i; i < stems.length; ++i) {

474:         for (uint256 i = 0; i < accounts.length; i++) {

```

```solidity
File: depot/Depot.sol

49:         for (uint256 i = 0; i < data.length; i++) {

```

```solidity
File: ecosystem/price/BeanstalkPrice.sol

21:         for (uint256 i = 0; i < p.ps.length; i++) {

```

```solidity
File: ecosystem/price/CurvePrice.sol

77:         for (uint _i = 0; _i < xp.length; _i++) {

86:             for (uint _j = 0; _j < xp.length; _j++) {

```

```solidity
File: libraries/Curve/LibCurve.sol

91:         for (uint256 _i; _i < xp.length; ++_i) {

100:             for (uint256 _j; _j < xp.length; ++_j) {

```

```solidity
File: libraries/LibDiamond.sol

104:         for (uint256 facetIndex; facetIndex < _diamondCut.length; facetIndex++) {

129:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

147:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

162:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

```

```solidity
File: libraries/LibFunction.sol

90:             for (uint256 i; i < pasteParams.length; i++)

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

304:         for (uint256 i = 0; i < tokens.length; i++) {

309:             for (uint256 j = 0; j < seasons[i].length; j++) {

528:         for (uint256 i; i < seasons.length; ++i) {

```

```solidity
File: libraries/Silo/LibSilo.sol

562:         for (uint256 i; i < stems.length; ++i) {

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

432:         for (uint _i; _i < xp.length; ++_i) {

441:             for (uint _j; _j < xp.length; ++_j) {

```

```solidity
File: mocks/curve/MockPlainCurve.sol

276:         for (uint _i; _i < xp.length; ++_i) {

285:             for (uint _j; _j < xp.length; ++_j) {

```

```solidity
File: mocks/mockFacets/MockSeasonFacet.sol

246:         for (uint256 i; i < pools.length; ++i) {

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

253:         for (uint256 i = 0; i < secondsAgos.length; i++) {

```

```solidity
File: pipeline/Pipeline.sol

47:         for (uint256 i = 0; i < pipes.length; i++) {

63:             for (uint256 i = 0; i < pipes.length; ++i) {

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

78:         for (uint256 i; i < ids.length; ++i) {

91:         for (uint256 i; i < ids.length; ++i) {

100:         for (uint256 i; i < ids.length; ++i) {

```

```solidity
File: tokens/Fertilizer/Fertilizer1155.sol

67:         for (uint256 i; i < ids.length; ++i) {

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

69:         for (uint256 i; i < accounts.length; ++i) {

```

### <a name="GAS-4"></a>[GAS-4] State variables should be cached in stack variables rather than re-reading them from storage

The instances below point to the second+ access of a state variable within a function. Caching of a state variable replaces each Gwarmaccess (100 gas) with a much cheaper stack read. Other less obvious fixes/optimizations include having local memory caches of state variable structs, or having local caches of state variable contracts/addresses.

_Saves 100 gas per instance_

_Instances (6)_:

```solidity
File: mocks/curve/MockMeta3Curve.sol

145:         price = LibCurve.getPrice(xp, rates, a, D);

215:         uint256[N_COINS] memory old_balances = balances;

542:         uint256 D1 = get_D_mem([rate_multiplier, 1e18], _balances, a);

```

```solidity
File: mocks/curve/MockPlainCurve.sol

143:         uint256[N_COINS] memory old_balances = balances;

349:         uint256 D1 = get_D_mem(rate_multipliers, _balances, a);

349:         uint256 D1 = get_D_mem(rate_multipliers, _balances, a);

```

### <a name="GAS-5"></a>[GAS-5] Use calldata instead of memory for function arguments that do not get mutated

Mark data types as `calldata` instead of `memory` where possible. This makes it so that the data is not automatically loaded into memory. If the data passed into the function does not need to be changed (like updating values in an array), it can be passed in as `calldata`. The one exception to this is if the argument must later be passed into another function that takes an argument that specifies `memory` storage.

_Instances (68)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

141:     function balanceOfUnfertilized(address account, uint256[] memory ids)

149:     function balanceOfFertilized(address account, uint256[] memory ids)

166:         address[] memory accounts,

167:         uint256[] memory ids

```

```solidity
File: beanstalk/barn/UnripeFacet.sol

75:         bytes32[] memory proof,

```

```solidity
File: beanstalk/farm/TokenFacet.sol

273:     function getInternalBalances(address account, IERC20[] memory tokens)

300:     function getExternalBalances(address account, IERC20[] memory tokens)

328:     function getBalances(address account, IERC20[] memory tokens)

357:     function getAllBalances(address account, IERC20[] memory tokens)

```

```solidity
File: beanstalk/farm/TokenSupportFacet.sol

70:         bytes memory sig

```

```solidity
File: beanstalk/init/InitSiloEvents.sol

36:     function init(SiloEvents[] memory siloEvents) external {

```

```solidity
File: beanstalk/init/replant/Replant8.sol

25:         string memory _name,

26:         string memory _symbol,

35:         address[10] memory _pools

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

76:         int96[] memory stems,

77:         uint256[] memory amounts

```

```solidity
File: interfaces/IBeanstalk.sol

94:         uint32[] memory crates,

95:         uint256[] memory amounts

```

```solidity
File: interfaces/ICurve.sol

9:     function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);

23:     function add_liquidity(address _pool, uint256[4] memory _deposit_amounts, uint256 _min_mint_amount) external returns (uint256);

24:     function calc_token_amount(address _pool, uint256[4] memory _amounts, bool _is_deposit) external returns (uint256);

34:     function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount, address reciever) external returns (uint256);

35:     function remove_liquidity(uint256 _burn_amount, uint256[2] memory _min_amounts, address reciever) external returns (uint256[2] calldata);

36:     function remove_liquidity_imbalance(uint256[2] memory _amounts, uint256 _max_burn_amount, address reciever) external returns (uint256);

40:     function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount, address reciever) external returns (uint256);

41:     function remove_liquidity(uint256 _burn_amount, uint256[3] memory _min_amounts, address reciever) external returns (uint256[3] calldata);

42:     function remove_liquidity_imbalance(uint256[3] memory _amounts, uint256 _max_burn_amount, address reciever) external returns (uint256);

46:     function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount, address reciever) external returns (uint256);

47:     function remove_liquidity(uint256 _burn_amount, uint256[4] memory _min_amounts, address reciever) external returns (uint256[4] calldata);

48:     function remove_liquidity_imbalance(uint256[4] memory _amounts, uint256 _max_burn_amount, address reciever) external returns (uint256);

70:     function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount) external;

71:     function remove_liquidity(uint256 _burn_amount, uint256[3] memory _min_amounts) external;

72:     function remove_liquidity_imbalance(uint256[3] memory _amounts, uint256 _max_burn_amount) external;

```

```solidity
File: interfaces/IERC4494.sol

21:   function permit(address spender, uint256 tokenId, uint256 deadline, bytes memory sig) external;

```

```solidity
File: interfaces/IFertilizer.sol

12:         uint256[] memory ids,

16:     function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256);

17:     function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256);

19:     function lastBalanceOfBatch(address[] memory account, uint256[] memory id) external view returns (Balance[] memory);

19:     function lastBalanceOfBatch(address[] memory account, uint256[] memory id) external view returns (Balance[] memory);

```

```solidity
File: interfaces/IQuoter.sol

14:     function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut);

35:     function quoteExactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn);

```

```solidity
File: mocks/MockERC1155.sol

9:     constructor (string memory name) ERC1155(name) {}

```

```solidity
File: mocks/MockERC721.sol

21:         bytes memory signature

```

```solidity
File: mocks/MockToken.sol

20:     constructor(string memory name, string memory symbol)

20:     constructor(string memory name, string memory symbol)

```

```solidity
File: mocks/curve/MockCurveZap.sol

26:     function add_liquidity(address pool, uint256[4] memory depAmounts, uint256 minOut) external returns (uint256) {

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

23:     function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256);

205:     function add_liquidity(uint256[N_COINS] memory _amounts, uint256 _min_mint_amount) external returns (uint256) {

209:     function add_liquidity(uint256[N_COINS] memory _amounts, uint256 _min_mint_amount, address _receiver) public returns (uint256) {

296:         uint256[N_COINS] memory _amounts,

303:         uint256[N_COINS] memory _amounts,

534:     function calc_token_amount(uint256[N_COINS] memory _amounts, bool _is_deposit) public view returns (uint256) {

```

```solidity
File: mocks/curve/MockPlainCurve.sol

137:     function add_liquidity(uint256[N_COINS] memory _amounts, uint256 _min_mint_amount) external returns (uint256) {

341:     function calc_token_amount(uint256[N_COINS] memory _amounts, bool _is_deposit) public view returns (uint256) {

```

```solidity
File: mocks/mockFacets/MockConvertFacet.sol

22:         int96[] memory stems,

23:         uint256[] memory amounts,

```

```solidity
File: tokens/ERC20/BeanstalkERC20.sol

34:     constructor(address admin, string memory name, string memory symbol)

34:     constructor(address admin, string memory name, string memory symbol)

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

30:         uint256[] memory ids,

89:     function balanceOfFertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {

98:     function balanceOfUnfertilized(address account, uint256[] memory ids) external view returns (uint256 beans) {

```

```solidity
File: tokens/Fertilizer/Fertilizer1155.sol

22:         bytes memory data

48:         uint256[] memory ids,

49:         uint256[] memory amounts,

50:         bytes memory data

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

37:     function initialize(string memory _uri) public initializer {

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

67:     function lastBalanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (Balance[] memory balances) {

67:     function lastBalanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (Balance[] memory balances) {

```

### <a name="GAS-6"></a>[GAS-6] Use Custom Errors

[Source](https://blog.soliditylang.org/2021/04/21/custom-errors/)
Instead of using error strings, to reduce deployment and runtime cost, you should use Custom Errors. This would save both deployment and runtime cost.

_Instances (206)_:

```solidity
File: beanstalk/Diamond.sol

42:         require(facet != address(0), "Diamond: Function does not exist");

```

```solidity
File: beanstalk/ReentrancyGuard.sol

20:         require(s.reentrantStatus != _ENTERED, "ReentrancyGuard: reentrant call");

```

```solidity
File: beanstalk/barn/UnripeFacet.sol

79:         require(root != bytes32(0), "UnripeClaim: invalid token");

144:         require(isUnripe(unripeToken), "not vesting");

184:         revert("not vesting");

```

```solidity
File: beanstalk/diamond/OwnershipFacet.sol

21:         require(s.ownerCandidate == msg.sender, "Ownership: Not candidate");

```

```solidity
File: beanstalk/diamond/PauseFacet.sol

30:         require(!s.paused, "Pause: already paused.");

39:         require(s.paused, "Pause: not paused.");

```

```solidity
File: beanstalk/farm/CurveFacet.sol

253:             require(is3Pool(pool), "Curve: tri-crypto not supported");

370:         require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");

387:         require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");

401:         require(i < MAX_COINS_128, "Curve: Tokens not in pool");

```

```solidity
File: beanstalk/farm/TokenFacet.sol

213:         revert("Silo: ERC1155 deposits are not accepted yet.");

229:         revert("Silo: ERC1155 deposits are not accepted yet.");

```

```solidity
File: beanstalk/field/FieldFacet.sol

178:             require(plots[i] < s.f.harvestable, "Field: Plot not Harvestable");

196:         require(pods > 0, "Field: no plot");

```

```solidity
File: beanstalk/field/FundraiserFacet.sol

77:             revert("Fundraiser: Token decimals");

112:         require(remaining > 0, "Fundraiser: completed");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

71:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

72:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

73:         require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

96:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

97:         require(s.f.harvestable <= maxHarvestableIndex, "Marketplace: Expired.");

139:         require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");

141:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

142:         require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

166:         require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");

170:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

171:         require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

186:         require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

187:         require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

212:         require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

213:         require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

292:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/MarketplaceFacet.sol

231:         require(amount > 0, "Field: Plot not owned by user.");

232:         require(end > start && amount >= end, "Field: Pod range invalid.");

249:         require(spender != address(0), "Field: Pod Approve to 0 address.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

62:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

63:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

80:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

100:         require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

101:         require(s.a[msg.sender].field.plots[index] >= (start.add(amount)), "Marketplace: Invalid Plot.");

102:         require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

128:         require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

129:         require(s.a[msg.sender].field.plots[index] >= (start.add(amount)), "Marketplace: Invalid Plot.");

130:         require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

220:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/PodTransfer.sol

60:         require(from != to, "Field: Cannot transfer Pods to oneself.");

```

```solidity
File: beanstalk/metadata/MetadataFacet.sol

43:         require(depositMetadata.token != address(0), "Silo: metadata does not exist");

```

```solidity
File: beanstalk/silo/ApprovalFacet.sol

51:         require(spender != address(0), "approve from the zero address");

52:         require(token != address(0), "approve to the zero address");

90:         require(currentAllowance >= subtractedValue, "Silo: decreased allowance below zero");

```

```solidity
File: beanstalk/silo/BDVFacet.sol

47:         revert("BDV: Token not whitelisted");

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

130:         require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");

189:         require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");

352:         require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

182:         require(amounts.length > 0, "Silo: amounts array is empty");

184:             require(amounts[i] > 0, "Silo: amount in array is 0");

216:         require(recipient != address(0), "ERC1155: transfer to the zero address");

247:         require(depositIds.length == amounts.length, "Silo: depositIDs and amounts arrays must be the same length");

248:         require(recipient != address(0), "ERC1155: transfer to the zero address");

```

```solidity
File: beanstalk/sun/SeasonFacet/Oracle.sol

30:         revert("Oracle: Pool not supported");

```

```solidity
File: beanstalk/sun/SeasonFacet/SeasonFacet.sol

53:         require(!paused(), "Season: Paused.");

54:         require(seasonTime() > season(), "Season: Still current Season.");

```

```solidity
File: beanstalk/sun/SeasonFacet/Sun.sol

141:                 require(s.fertilizedIndex == s.unfertilizedIndex, "Paid != owed");

```

```solidity
File: depot/Depot.sol

79:             revert("Mode not supported");

94:         require(sender == msg.sender, "invalid sender");

109:         require(sender == msg.sender, "invalid sender");

```

```solidity
File: ecosystem/price/CurvePrice.sol

97:         require(false, "Price: Convergence false");

```

```solidity
File: libraries/Convert/LibConvert.sol

53:             revert("Convert: Invalid payload");

82:         revert("Convert: Tokens not supported");

110:         revert("Convert: Tokens not supported");

```

```solidity
File: libraries/Convert/LibCurveConvert.sol

128:         require(beansTo > 0, "Convert: P must be >= 1.");

146:         require(lpTo > 0, "Convert: P must be < 1.");

165:         revert("Convert: Not a whitelisted Curve pool.");

```

```solidity
File: libraries/Curve/LibCurve.sol

80:         require(false, "Price: Convergence false");

110:         require(false, "Price: Convergence false");

144:         require(false, "Price: Convergence false");

```

```solidity
File: libraries/LibBytes.sol

19:         require(_start + 1 >= _start, "toUint8_overflow");

20:         require(_bytes.length >= _start + 1 , "toUint8_outOfBounds");

35:         require(_start + 4 >= _start, "toUint32_overflow");

36:         require(_bytes.length >= _start + 4, "toUint32_outOfBounds");

51:         require(_start + 32 >= _start, "toUint256_overflow");

52:         require(_bytes.length >= _start + 32, "toUint256_outOfBounds");

```

```solidity
File: libraries/LibDiamond.sol

71:         require(msg.sender == diamondStorage().contractOwner, "LibDiamond: Must be contract owner");

113:                 revert("LibDiamondCut: Incorrect FacetCutAction");

121:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

123:         require(_facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");

132:             require(oldFacetAddress == address(0), "LibDiamondCut: Can't add function that already exists");

139:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

141:         require(_facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");

150:             require(oldFacetAddress != _facetAddress, "LibDiamondCut: Can't replace function with same function");

158:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

161:         require(_facetAddress == address(0), "LibDiamondCut: Remove facet address must be address(0)");

183:         require(_facetAddress != address(0), "LibDiamondCut: Can't remove function that doesn't exist");

185:         require(_facetAddress != address(this), "LibDiamondCut: Can't remove immutable function");

216:             require(_calldata.length == 0, "LibDiamondCut: _init is address(0) but_calldata is not empty");

218:             require(_calldata.length > 0, "LibDiamondCut: _calldata is empty but _init is not address(0)");

228:                     revert("LibDiamondCut: _init function reverted");

```

```solidity
File: libraries/LibFertilizer.sol

158:             require(s.activeFertilizer == 0, "Still active fertilizer");

```

```solidity
File: libraries/LibFunction.sol

46:         require(facet != address(0), "Diamond: Function does not exist");

93:             revert("Function: Advanced Type not supported");

```

```solidity
File: libraries/LibPRBMath.sol

69:             revert("fixed point overflow");

135:             revert("Log Input Too Small");

```

```solidity
File: libraries/LibSafeMath128.sol

78:         require(c >= a, "SafeMath: addition overflow");

93:         require(b <= a, "SafeMath: subtraction overflow");

110:         require(c / a == b, "SafeMath: multiplication overflow");

127:         require(b > 0, "SafeMath: division by zero");

144:         require(b > 0, "SafeMath: modulo by zero");

```

```solidity
File: libraries/LibSafeMath32.sol

78:         require(c >= a, "SafeMath: addition overflow");

93:         require(b <= a, "SafeMath: subtraction overflow");

110:         require(c / a == b, "SafeMath: multiplication overflow");

127:         require(b > 0, "SafeMath: division by zero");

144:         require(b > 0, "SafeMath: modulo by zero");

```

```solidity
File: libraries/LibSafeMathSigned128.sol

30:         require(!(a == -1 && b == _INT128_MIN), "SignedSafeMath: multiplication overflow");

33:         require(c / a == b, "SignedSafeMath: multiplication overflow");

51:         require(b != 0, "SignedSafeMath: division by zero");

52:         require(!(b == -1 && a == _INT128_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: libraries/LibSafeMathSigned96.sol

30:         require(!(a == -1 && b == _INT96_MIN), "SignedSafeMath: multiplication overflow");

33:         require(c / a == b, "SignedSafeMath: multiplication overflow");

51:         require(b != 0, "SignedSafeMath: division by zero");

52:         require(!(b == -1 && a == _INT96_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: libraries/LibStrings.sol

47:         require(value == 0, "Strings: hex length insufficient");

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

139:             require(crateAmount >= amount, "Silo: Crate balance too low.");

239:         require(seedsPerBdv > 0, "Silo: Token not supported");

259:         require(s.a[account].s.seeds == 0, "only for zero seeds");

261:         require(LibSilo.migrationNeeded(account), "no migration needed");

293:         require((LibSilo.migrationNeeded(account) || balanceOfSeeds(account) > 0), "no migration needed");

391:         require(seedsVariance == seedsDiff, "seeds misalignment, double check submitted deposits");

```

```solidity
File: libraries/Silo/LibSilo.sol

321:         require(!migrationNeeded(account), "Silo: Migration needed");

```

```solidity
File: libraries/Silo/LibSiloPermit.sol

67:         require(block.timestamp <= deadline, "Silo: permit expired deadline");

81:         require(signer == owner, "Silo: permit invalid signature");

103:         require(block.timestamp <= deadline, "Silo: permit expired deadline");

117:         require(signer == owner, "Silo: permit invalid signature");

207:             require(currentAllowance >= amount, "Silo: insufficient allowance");

```

```solidity
File: libraries/Silo/LibTokenSilo.sol

141:         require(bdv > 0, "Silo: No Beans under Token.");

244:         require(amount <= crateAmount, "Silo: Crate balance too low.");

381:         require(stem <= _stemTip, "Silo: Invalid Deposit");

441:         require(value <= uint256(type(int96).max), "SafeCast: value doesn't fit in an int96");

```

```solidity
File: libraries/Silo/LibWhitelist.sol

71:         require(success, "Invalid selector");

73:         require(s.ss[token].milestoneSeason == 0, "Token already whitelisted");

93:         require(s.ss[token].milestoneSeason != 0, "Token not whitelisted");

```

```solidity
File: libraries/Token/LibEth.sol

24:             require(success, "Eth transfer Failed.");

```

```solidity
File: libraries/Token/LibTokenPermit.sol

34:         require(block.timestamp <= deadline, "Token: permit expired deadline");

38:         require(signer == owner, "Token: permit invalid signature");

```

```solidity
File: libraries/Token/LibWeth.sol

28:         require(success, "Weth: unwrap failed");

```

```solidity
File: mocks/MockDiamond.sol

41:         require(facet != address(0), "Diamond: Function does not exist");

```

```solidity
File: mocks/MockWETH.sol

31:         require(success, "MockWETH: Transfer failed.");

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

191:         require(dy >= min_dy, "Curve: error");

223:                 require(amount > 0, "dev: initial deposit requires all coins");

228:         require(D1 > D0, "New D high");

251:         require(mint_amount >= _min_mint_amount, "Curve: Not enough LP");

376:         require(dy >= _min_received, "Curve: Insufficient Output");

449:         require(false, "Price: Convergence false");

463:         require(i >= 0, "Curve: i below zero");

464:         require(i < N_COINS, "Curve: i above N_COINS");

494:         require(false, "Price: Convergence false");

532:         require(false, "Curve: Convergence false");

680:         require(sender != address(0), "ERC20: transfer from the zero address");

681:         require(recipient != address(0), "ERC20: transfer to the zero address");

702:         require(owner != address(0), "ERC20: approve from the zero address");

703:         require(spender != address(0), "ERC20: approve to the zero address");

```

```solidity
File: mocks/curve/MockPlainCurve.sol

151:                 require(amount > 0, "dev: initial deposit requires all coins");

157:         require(D1 > D0, "New D high");

180:         require(mint_amount >= _min_mint_amount, "Curve: Not enough LP");

209:         require(dy >= _min_received, "Curve: Insufficient Output");

293:         require(false, "Price: Convergence false");

307:         require(i >= 0, "Curve: i below zero");

308:         require(i < N_COINS, "Curve: i above N_COINS");

338:         require(false, "Price: Convergence false");

487:         require(sender != address(0), "ERC20: transfer from the zero address");

488:         require(recipient != address(0), "ERC20: transfer to the zero address");

509:         require(owner != address(0), "ERC20: approve from the zero address");

510:         require(spender != address(0), "ERC20: approve to the zero address");

```

```solidity
File: mocks/mockFacets/MockSeasonFacet.sol

41:         require(!paused(), "Season: Paused.");

54:         require(!paused(), "Season: Paused.");

61:         require(!paused(), "Season: Paused.");

70:         require(!paused(), "Season: Paused.");

77:         require(!paused(), "Season: Paused.");

85:         require(!paused(), "Season: Paused.");

93:         require(!paused(), "Season: Paused.");

100:         require(!paused(), "Season: Paused.");

108:         require(!paused(), "Season: Paused.");

124:         require(!paused(), "Season: Paused.");

131:         require(!paused(), "Season: Paused.");

```

```solidity
File: mocks/mockFacets/MockSiloFacet.sol

269:         require(bdv > 0, "Silo: No Beans under Token.");

```

```solidity
File: tokens/ERC20/BeanstalkERC20.sol

52:         require(hasRole(MINTER_ROLE, _msgSender()), "!Minter");

```

```solidity
File: tokens/ERC20/ERC20Permit.sol

53:         require(block.timestamp <= deadline, "ERC20Permit: expired deadline");

60:         require(signer == owner, "ERC20Permit: invalid signature");

```

```solidity
File: tokens/Fertilizer/Fertilizer1155.sol

28:         require(to != address(0), "ERC1155: transfer to the zero address");

56:         require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");

57:         require(to != address(0), "ERC1155: transfer to the zero address");

85:         require(to != address(0), "ERC1155: mint to the zero address");

111:                     revert("ERC1155: ERC1155Receiver rejected tokens");

116:                 revert("ERC1155: transfer to non ERC1155Receiver implementer");

134:                     revert("ERC1155: ERC1155Receiver rejected tokens");

139:                 revert("ERC1155: transfer to non ERC1155Receiver implementer");

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

53:         require(IUSDC.balanceOf(CUSTODIAN) <= MAX_RAISE, "Fertilizer: Not enough remaining");

58:         require(started(), "Fertilizer: Not started");

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

58:         require(account != address(0), "ERC1155: balance query for the zero address");

63:         require(account != address(0), "ERC1155: balance query for the zero address");

83:             require(uint256(fromBalance) >= amount, "ERC1155: insufficient balance for transfer");

```

### <a name="GAS-7"></a>[GAS-7] Don't initialize variables with default value

_Instances (45)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

177:         uint256 numFerts = 0;

```

```solidity
File: beanstalk/farm/CurveFacet.sol

365:         for (uint256 _i = 0; _i < MAX_COINS; ++_i) {

382:         for (uint256 _i = 0; _i < MAX_COINS; ++_i) {

397:         for (uint256 _i = 0; _i < MAX_COINS; ++_i) {

```

```solidity
File: beanstalk/farm/FarmFacet.sol

60:         for (uint256 i = 0; i < data.length; ++i) {

```

```solidity
File: beanstalk/init/InitBipNewSilo.sol

27:     uint32 constant private UNRIPE_BEAN_SEEDS_PER_BDV = 0;

28:     uint32 constant private UNRIPE_BEAN_3CRV_SEEDS_PER_BDV = 0;

```

```solidity
File: beanstalk/init/replant/Replant4.sol

62:             for (uint256 j = 0; j < w[i].seasons.length; j++) {

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

259:         uint256 i = 0;

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

183:         for (uint256 i = 0; i < amounts.length; i++) {

```

```solidity
File: beanstalk/silo/SiloFacet/TokenSilo.sol

474:         for (uint256 i = 0; i < accounts.length; i++) {

```

```solidity
File: depot/Depot.sol

49:         for (uint256 i = 0; i < data.length; i++) {

```

```solidity
File: ecosystem/price/BeanstalkPrice.sol

21:         for (uint256 i = 0; i < p.ps.length; i++) {

```

```solidity
File: ecosystem/price/CurvePrice.sol

32:     uint256 private constant i = 0;

77:         for (uint _i = 0; _i < xp.length; _i++) {

84:         for (uint _i = 0; _i < 256; _i++) {

86:             for (uint _j = 0; _j < xp.length; _j++) {

```

```solidity
File: libraries/Curve/LibBeanMetaCurve.sol

21:     uint256 private constant i = 0;

```

```solidity
File: libraries/Curve/LibCurve.sol

19:     uint256 private constant i = 0;

57:         uint256 _x = 0;

58:         uint256 y_prev = 0;

122:         uint256 _x = 0;

123:         uint256 y_prev = 0;

```

```solidity
File: libraries/LibBytes.sol

70:         for(uint256 i = 0; i < length; ++i) {

```

```solidity
File: libraries/LibPolynomial.sol

189:         uint256 low = 0;

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

304:         for (uint256 i = 0; i < tokens.length; i++) {

309:             for (uint256 j = 0; j < seasons[i].length; j++) {

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

231:         uint256 mint_amount = 0;

236:                 uint256 difference = 0;

324:             uint256 difference = 0;

404:             uint256 dx_expected = 0;

467:         uint256 _x = 0;

468:         uint256 y_prev = 0;

509:         uint256 _x = 0;

510:         uint256 y_prev = 0;

543:         uint256 diff = 0;

```

```solidity
File: mocks/curve/MockPlainCurve.sol

160:         uint256 mint_amount = 0;

165:                 uint256 difference = 0;

237:             uint256 dx_expected = 0;

311:         uint256 _x = 0;

312:         uint256 y_prev = 0;

350:         uint256 diff = 0;

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

253:         for (uint256 i = 0; i < secondsAgos.length; i++) {

```

```solidity
File: pipeline/Pipeline.sol

47:         for (uint256 i = 0; i < pipes.length; i++) {

63:             for (uint256 i = 0; i < pipes.length; ++i) {

```

### <a name="GAS-8"></a>[GAS-8] Long revert strings

_Instances (71)_:

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

71:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

72:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

96:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

139:         require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");

141:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

142:         require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

166:         require(s.podListings[l.index] == lHash, "Marketplace: Listing does not exist.");

170:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

171:         require(s.f.harvestable <= l.maxHarvestableIndex, "Marketplace: Listing has expired.");

186:         require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

187:         require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

212:         require(amount >= l.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

213:         require(l.amount >= amount, "Marketplace: Not enough pods in Listing.");

292:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

62:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

63:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

80:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

100:         require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

102:         require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

128:         require(amount >= o.minFillAmount, "Marketplace: Fill must be >= minimum amount.");

130:         require(index.add(start).add(amount).sub(s.f.harvestable) <= o.maxPlaceInLine, "Marketplace: Plot too far in line.");

220:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/PodTransfer.sol

60:         require(from != to, "Field: Cannot transfer Pods to oneself.");

```

```solidity
File: beanstalk/silo/ApprovalFacet.sol

90:         require(currentAllowance >= subtractedValue, "Silo: decreased allowance below zero");

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

216:         require(recipient != address(0), "ERC1155: transfer to the zero address");

247:         require(depositIds.length == amounts.length, "Silo: depositIDs and amounts arrays must be the same length");

248:         require(recipient != address(0), "ERC1155: transfer to the zero address");

```

```solidity
File: libraries/LibDiamond.sol

71:         require(msg.sender == diamondStorage().contractOwner, "LibDiamond: Must be contract owner");

121:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

123:         require(_facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");

132:             require(oldFacetAddress == address(0), "LibDiamondCut: Can't add function that already exists");

139:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

141:         require(_facetAddress != address(0), "LibDiamondCut: Add facet can't be address(0)");

150:             require(oldFacetAddress != _facetAddress, "LibDiamondCut: Can't replace function with same function");

158:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

161:         require(_facetAddress == address(0), "LibDiamondCut: Remove facet address must be address(0)");

183:         require(_facetAddress != address(0), "LibDiamondCut: Can't remove function that doesn't exist");

185:         require(_facetAddress != address(this), "LibDiamondCut: Can't remove immutable function");

216:             require(_calldata.length == 0, "LibDiamondCut: _init is address(0) but_calldata is not empty");

218:             require(_calldata.length > 0, "LibDiamondCut: _calldata is empty but _init is not address(0)");

```

```solidity
File: libraries/LibSafeMath128.sol

110:         require(c / a == b, "SafeMath: multiplication overflow");

```

```solidity
File: libraries/LibSafeMath32.sol

110:         require(c / a == b, "SafeMath: multiplication overflow");

```

```solidity
File: libraries/LibSafeMathSigned128.sol

30:         require(!(a == -1 && b == _INT128_MIN), "SignedSafeMath: multiplication overflow");

33:         require(c / a == b, "SignedSafeMath: multiplication overflow");

52:         require(!(b == -1 && a == _INT128_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: libraries/LibSafeMathSigned96.sol

30:         require(!(a == -1 && b == _INT96_MIN), "SignedSafeMath: multiplication overflow");

33:         require(c / a == b, "SignedSafeMath: multiplication overflow");

52:         require(!(b == -1 && a == _INT96_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

391:         require(seedsVariance == seedsDiff, "seeds misalignment, double check submitted deposits");

```

```solidity
File: libraries/Silo/LibTokenSilo.sol

441:         require(value <= uint256(type(int96).max), "SafeCast: value doesn't fit in an int96");

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

223:                 require(amount > 0, "dev: initial deposit requires all coins");

680:         require(sender != address(0), "ERC20: transfer from the zero address");

681:         require(recipient != address(0), "ERC20: transfer to the zero address");

702:         require(owner != address(0), "ERC20: approve from the zero address");

703:         require(spender != address(0), "ERC20: approve to the zero address");

```

```solidity
File: mocks/curve/MockPlainCurve.sol

151:                 require(amount > 0, "dev: initial deposit requires all coins");

487:         require(sender != address(0), "ERC20: transfer from the zero address");

488:         require(recipient != address(0), "ERC20: transfer to the zero address");

509:         require(owner != address(0), "ERC20: approve from the zero address");

510:         require(spender != address(0), "ERC20: approve to the zero address");

```

```solidity
File: tokens/Fertilizer/Fertilizer1155.sol

28:         require(to != address(0), "ERC1155: transfer to the zero address");

56:         require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");

57:         require(to != address(0), "ERC1155: transfer to the zero address");

85:         require(to != address(0), "ERC1155: mint to the zero address");

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

58:         require(account != address(0), "ERC1155: balance query for the zero address");

63:         require(account != address(0), "ERC1155: balance query for the zero address");

83:             require(uint256(fromBalance) >= amount, "ERC1155: insufficient balance for transfer");

```

### <a name="GAS-9"></a>[GAS-9] Functions guaranteed to revert when called by normal users can be marked `payable`

If a function modifier such as `onlyOwner` is used, the function will revert if a normal user tries to pay the function. Marking the function as `payable` will lower the gas cost for legitimate callers because the compiler will not include checks for whether a payment was provided.

_Instances (4)_:

```solidity
File: mocks/MockSiloToken.sol

23:     function mint(address account, uint256 amount) public onlyOwner returns (bool) {

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

846:     function setFeeProtocol(uint8 feeProtocol0, uint8 feeProtocol1) external override lock onlyFactoryOwner {

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

36:     function beanstalkMint(address account, uint256 id, uint128 amount, uint128 bpf) external onlyOwner {

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

45:     function setURI(string calldata newuri) public onlyOwner {

```

### <a name="GAS-10"></a>[GAS-10] `++i` costs less gas than `i++`, especially when it's used in `for`-loops (`--i`/`i--` too)

_Saves 5 gas per loop_

_Instances (25)_:

```solidity
File: beanstalk/diamond/DiamondLoupeFacet.sol

32:         for (uint256 i; i < numFacets; i++) {

```

```solidity
File: beanstalk/init/replant/Replant4.sol

62:             for (uint256 j = 0; j < w[i].seasons.length; j++) {

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

311:                 i++;

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

183:         for (uint256 i = 0; i < amounts.length; i++) {

252:         for(uint i; i < depositIds.length; i++) {

```

```solidity
File: beanstalk/silo/SiloFacet/TokenSilo.sol

474:         for (uint256 i = 0; i < accounts.length; i++) {

```

```solidity
File: depot/Depot.sol

49:         for (uint256 i = 0; i < data.length; i++) {

```

```solidity
File: ecosystem/price/BeanstalkPrice.sol

21:         for (uint256 i = 0; i < p.ps.length; i++) {

```

```solidity
File: ecosystem/price/CurvePrice.sol

77:         for (uint _i = 0; _i < xp.length; _i++) {

84:         for (uint _i = 0; _i < 256; _i++) {

86:             for (uint _j = 0; _j < xp.length; _j++) {

```

```solidity
File: libraries/LibDiamond.sol

104:         for (uint256 facetIndex; facetIndex < _diamondCut.length; facetIndex++) {

129:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

134:             selectorPosition++;

147:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

153:             selectorPosition++;

162:         for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {

```

```solidity
File: libraries/LibFunction.sol

90:             for (uint256 i; i < pasteParams.length; i++)

```

```solidity
File: libraries/LibPolynomial.sol

170:                     currentPieceIndex++;

194:             else low++;

```

```solidity
File: libraries/LibStrings.sol

26:             digits++;

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

304:         for (uint256 i = 0; i < tokens.length; i++) {

309:             for (uint256 j = 0; j < seasons[i].length; j++) {

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

253:         for (uint256 i = 0; i < secondsAgos.length; i++) {

```

```solidity
File: pipeline/Pipeline.sol

47:         for (uint256 i = 0; i < pipes.length; i++) {

```

### <a name="GAS-11"></a>[GAS-11] Using `private` rather than `public` for constants, saves gas

If needed, the values can be read from the verified contract source code, or if there are multiple values there can be a single getter function that [returns a tuple](https://github.com/code-423n4/2022-08-frax/blob/90f55a9ce4e25bceed3a74290b854341d8de6afa/src/contracts/FraxlendPair.sol#L156-L178) of the values of all currently-public constants. Saves **3406-3606 gas** in deployment gas due to the compiler not having to create non-payable getter functions for deployment calldata, not having to store the bytes of the value outside of where it's used, and not adding another entry to the method ID table

_Instances (3)_:

```solidity
File: tokens/ERC20/BeanstalkERC20.sol

27:     bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

21:     address constant public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

22:     address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

```

### <a name="GAS-12"></a>[GAS-12] Use shift Right/Left instead of division/multiplication if possible

_Instances (3)_:

```solidity
File: ecosystem/price/CurvePrice.sol

55:         uint256 pegBeans = D / 2 / 1e12;

```

```solidity
File: libraries/Curve/LibBeanMetaCurve.sol

58:         uint256 pegBeans = D / 2 / RATE_MULTIPLIER;

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

889:         uint256 z = (x + 1) / 2;

```

### <a name="GAS-13"></a>[GAS-13] Splitting require() statements that use && saves gas

_Instances (19)_:

```solidity
File: beanstalk/farm/CurveFacet.sol

370:         require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");

387:         require(i < MAX_COINS_128 && j < MAX_COINS_128, "Curve: Tokens not in pool");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

71:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

96:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

141:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

170:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/MarketplaceFacet.sol

232:         require(end > start && amount >= end, "Field: Pod range invalid.");

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

352:         require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

```

```solidity
File: libraries/LibSafeMathSigned128.sol

30:         require(!(a == -1 && b == _INT128_MIN), "SignedSafeMath: multiplication overflow");

52:         require(!(b == -1 && a == _INT128_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: libraries/LibSafeMathSigned96.sol

30:         require(!(a == -1 && b == _INT96_MIN), "SignedSafeMath: multiplication overflow");

52:         require(!(b == -1 && a == _INT96_MIN), "SignedSafeMath: division overflow");

71:         require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

88:         require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

```

```solidity
File: mocks/uniswap/MockUniswapV3Factory.sol

67:         require(tickSpacing > 0 && tickSpacing < 16384);

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

151:         require(success && data.length >= 32);

161:         require(success && data.length >= 32);

```

### <a name="GAS-14"></a>[GAS-14] Use != 0 instead of > 0 for unsigned integer comparison

_Instances (123)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

179:         while (idx > 0) {

186:         while (idx > 0) {

```

```solidity
File: beanstalk/farm/CurveFacet.sol

111:             if (amounts[i] > 0) {

186:                 if (amountOut > 0) LibTransfer.sendToken(IERC20(coins[i]), amountOut, msg.sender, toMode);

226:                 if (amounts[i] > 0) {

262:                 if (amountsOut[i] > 0) {

296:                 if (amountsOut[i] > 0) {

```

```solidity
File: beanstalk/farm/FarmFacet.sol

101:         if (msg.value > 0) s.isFarm = 2;

103:         if (msg.value > 0) {

```

```solidity
File: beanstalk/field/FieldFacet.sol

196:         require(pods > 0, "Field: no plot");

207:         if (s.podListings[index] > 0) {

```

```solidity
File: beanstalk/field/FundraiserFacet.sol

112:         require(remaining > 0, "Fundraiser: completed");

```

```solidity
File: beanstalk/init/InitDiamond.sol

59:         s.season.start = s.season.period > 0 ?

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

71:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

72:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

96:         require(plotSize >= (start.add(amount)) && amount > 0, "Marketplace: Invalid Plot/Amount.");

141:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

170:         require(plotSize >= (l.start.add(l.amount)) && l.amount > 0, "Marketplace: Invalid Plot/Amount.");

238:             s.a[account].field.plots[index] > 0,

279:         if(minFillAmount > 0) lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  minFillAmount, mode == LibTransfer.To.EXTERNAL));

```

```solidity
File: beanstalk/market/MarketplaceFacet/MarketplaceFacet.sol

231:         require(amount > 0, "Field: Plot not owned by user.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

62:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

62:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

63:         require(pricePerPod > 0, "Marketplace: Pod price must be greater than 0.");

67:         if (s.podOrders[id] > 0) _cancelPodOrder(pricePerPod, maxPlaceInLine, minFillAmount, LibTransfer.To.INTERNAL);

80:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

80:         require(beanAmount > 0, "Marketplace: Order amount must be > 0.");

82:         if (s.podOrders[id] > 0) _cancelPodOrderV2(maxPlaceInLine, minFillAmount, pricingFunction, LibTransfer.To.INTERNAL);

209:         if(minFillAmount > 0) id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount));

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

352:         require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

352:         require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

182:         require(amounts.length > 0, "Silo: amounts array is empty");

184:             require(amounts[i] > 0, "Silo: amount in array is 0");

```

```solidity
File: beanstalk/sun/SeasonFacet/Sun.sol

72:         if (deltaB > 0) {

```

```solidity
File: beanstalk/sun/SeasonFacet/Weather.sol

176:             deltaB > 0 ||

242:             if (s.r.roots > 0) {

```

```solidity
File: interfaces/IERC1155Receiver.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: interfaces/IQuoter.sol

2: pragma solidity >=0.7.5;

```

```solidity
File: interfaces/ISwapRouter.sol

2: pragma solidity >=0.7.5;

```

```solidity
File: libraries/Convert/LibCurveConvert.sol

128:         require(beansTo > 0, "Convert: P must be >= 1.");

146:         require(lpTo > 0, "Convert: P must be < 1.");

```

```solidity
File: libraries/Decimal.sol

216:         return compareTo(self, b) > 0;

```

```solidity
File: libraries/LibDiamond.sol

121:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

139:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

158:         require(_functionSelectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

218:             require(_calldata.length > 0, "LibDiamondCut: _calldata is empty but _init is not address(0)");

224:                 if (error.length > 0) {

239:         require(contractSize > 0, _errorMessage);

```

```solidity
File: libraries/LibPRBMath.sol

46:         result = y & 1 > 0 ? x : SCALE;

49:         for (y >>= 1; y > 0; y >>= 1) {

53:             if (y & 1 > 0) {

154:         for (uint256 delta = HALF_SCALE; delta > 0; delta >>= 1) {

275:         if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {

```

```solidity
File: libraries/LibSafeMath128.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

127:         require(b > 0, "SafeMath: division by zero");

144:         require(b > 0, "SafeMath: modulo by zero");

182:         require(b > 0, errorMessage);

202:         require(b > 0, errorMessage);

```

```solidity
File: libraries/LibSafeMath32.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

127:         require(b > 0, "SafeMath: division by zero");

144:         require(b > 0, "SafeMath: modulo by zero");

182:         require(b > 0, errorMessage);

202:         require(b > 0, errorMessage);

```

```solidity
File: libraries/LibSafeMathSigned128.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibSafeMathSigned96.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibStrings.sol

3: pragma solidity >=0.6.0 <0.8.0;

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

239:         require(seedsPerBdv > 0, "Silo: Token not supported");

293:         require((LibSilo.migrationNeeded(account) || balanceOfSeeds(account) > 0), "no migration needed");

380:         if (seedsDiff > 0) {

403:         if (seedsDiff > 0) {

407:             if (currentStalkDiff > 0) {

```

```solidity
File: libraries/Silo/LibSilo.sol

363:         if (_bdv > 0) {

419:         } else if (s.a[account].lastRain > 0) {

454:         if (s.a[account].lastRain > 0) {

627:         return s.a[account].lastUpdate > 0 && s.a[account].lastUpdate < s.season.stemStartSeason;

```

```solidity
File: libraries/Silo/LibTokenSilo.sol

141:         require(bdv > 0, "Silo: No Beans under Token.");

262:         if (crateAmount > 0) delete s.a[account].deposits[depositId];

434:         int96 grownStalkPerBdv = bdv > 0 ? toInt96(grownStalk.div(bdv)) : 0;

```

```solidity
File: libraries/Token/LibEth.sol

20:         if (address(this).balance > 0 && s.isFarm != 2) {

```

```solidity
File: mocks/MockInitDiamond.sol

55:         s.season.start = s.season.period > 0 ?

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

223:                 require(amount > 0, "dev: initial deposit requires all coins");

232:         if (total_supply > 0) {

255:             if (amount > 0)

```

```solidity
File: mocks/curve/MockPlainCurve.sol

151:                 require(amount > 0, "dev: initial deposit requires all coins");

161:         if (total_supply > 0) {

184:             if (amount > 0)

```

```solidity
File: mocks/mockFacets/MockSiloFacet.sol

141:         } else if (s.a[account].lastRain > 0) {

269:         require(bdv > 0, "Silo: No Beans under Token.");

```

```solidity
File: mocks/uniswap/MockUniswapV3Factory.sol

67:         require(tickSpacing > 0 && tickSpacing < 16384);

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

473:         require(amount > 0);

489:         if (amount0 > 0) balance0Before = balance0();

490:         if (amount1 > 0) balance1Before = balance1();

492:         if (amount0 > 0) require(balance0Before.add(amount0) <= balance0(), 'M0');

493:         if (amount1 > 0) require(balance1Before.add(amount1) <= balance1(), 'M1');

512:         if (amount0 > 0) {

516:         if (amount1 > 0) {

544:         if (amount0 > 0 || amount1 > 0) {

544:         if (amount0 > 0 || amount1 > 0) {

636:         bool exactInput = amountSpecified > 0;

691:             if (cache.feeProtocol > 0) {

698:             if (state.liquidity > 0)

770:             if (state.protocolFee > 0) protocolFees.token0 += state.protocolFee;

773:             if (state.protocolFee > 0) protocolFees.token1 += state.protocolFee;

788:             if (amount0 < 0) TransferHelper.safeTransfer(token0, recipient, uint256(-amount0));

807:         require(_liquidity > 0, 'L');

814:         if (amount0 > 0) TransferHelper.safeTransfer(token0, recipient, amount0);

815:         if (amount1 > 0) TransferHelper.safeTransfer(token1, recipient, amount1);

829:         if (paid0 > 0) {

832:             if (uint128(fees0) > 0) protocolFees.token0 += uint128(fees0);

835:         if (paid1 > 0) {

838:             if (uint128(fees1) > 0) protocolFees.token1 += uint128(fees1);

848:             (feeProtocol0 == 0 || (feeProtocol0 >= 4 && feeProtocol0 <= 10)) &&

865:         if (amount0 > 0) {

870:         if (amount1 > 0) {

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

37:         if (_balances[id][account].amount > 0) {

70:         if (amount > 0) IBS(owner()).payFertilizer(account, amount);

81:             if (deltaBpf > 0) {

```

### <a name="GAS-15"></a>[GAS-15] `internal` functions not called by the contract should be removed

If the functions are required by an interface, the contract should inherit from that interface and use the `override` keyword

_Instances (229)_:

```solidity
File: C.sol

75:     function getSeasonPeriod() internal pure returns (uint256) {

79:     function getBlockLengthSeconds() internal pure returns (uint256) {

83:     function getChainId() internal pure returns (uint256) {

87:     function getSeedsPerBean() internal pure returns (uint256) {

91:     function getStalkPerBean() internal pure returns (uint256) {

95:     function getRootsBase() internal pure returns (uint256) {

102:     function unripeLPPool1() internal pure returns (address) {

109:     function unripeLPPool2() internal pure returns (address) {

113:     function unripeBean() internal pure returns (IERC20) {

117:     function unripeLP() internal pure returns (IERC20) {

121:     function bean() internal pure returns (IBean) {

125:     function usdc() internal pure returns (IERC20) {

129:     function curveMetapool() internal pure returns (ICurvePool) {

133:     function curve3Pool() internal pure returns (I3Curve) {

137:     function curveZap() internal pure returns (ICurveZap) {

141:     function curveZapAddress() internal pure returns (address) {

145:     function curve3PoolAddress() internal pure returns (address) {

149:     function threeCrv() internal pure returns (IERC20) {

153:     function UniV3EthUsdc() internal pure returns (address){

157:     function fertilizer() internal pure returns (IFertilizer) {

161:     function fertilizerAddress() internal pure returns (address) {

165:     function fertilizerAdmin() internal pure returns (IProxyAdmin) {

169:     function triCryptoPoolAddress() internal pure returns (address) {

173:     function triCrypto() internal pure returns (IERC20) {

177:     function unripeLPPerDollar() internal pure returns (uint256) {

181:     function dollarPerUnripeLP() internal pure returns (uint256) {

185:     function exploitAddLPRatio() internal pure returns (uint256) {

189:     function precision() internal pure returns (uint256) {

193:     function initialRecap() internal pure returns (uint256) {

```

```solidity
File: beanstalk/init/InitBip0.sol

23:     function diamondStorageOld() internal pure returns (AppStorageOld storage ds) {

```

```solidity
File: beanstalk/init/InitWhitelist.sol

36:     function whitelistPools() internal {

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

60:     function _createPodListing(

85:     function _createPodListingV2(

129:     function _fillListing(PodListing calldata l, uint256 beanAmount) internal {

151:     function _fillListingV2(

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

56:     function _createPodOrder(

74:     function _createPodOrderV2(

92:     function _fillPodOrder(

119:     function _fillPodOrderV2(

```

```solidity
File: beanstalk/market/MarketplaceFacet/PodTransfer.sol

53:     function _transferPlot(

87:     function decrementAllowancePods(

```

```solidity
File: beanstalk/silo/SiloFacet/Silo.sol

96:     function _plant(address account) internal returns (uint256 beans) {

149:     function _claimPlenty(address account) internal {

```

```solidity
File: beanstalk/silo/SiloFacet/SiloExit.sol

347:     function _season() internal view returns (uint32) {

```

```solidity
File: beanstalk/silo/SiloFacet/TokenSilo.sol

165:     function _deposit(

192:     function _withdrawDeposit(

226:     function _withdrawDeposits(

280:     function _transferDeposit(

328:     function _transferDeposits(

```

```solidity
File: beanstalk/sun/SeasonFacet/Oracle.sol

35:     function stepOracle() internal returns (int256 deltaB, uint256[2] memory balances) {

```

```solidity
File: beanstalk/sun/SeasonFacet/Sun.sol

70:     function stepSun(int256 deltaB, uint256 caseId) internal {

```

```solidity
File: beanstalk/sun/SeasonFacet/Weather.sol

13:     function toDecimal(uint256 a) internal pure returns (Decimal.D256 memory) {

100:     function stepWeather(int256 deltaB) internal returns (uint256 caseId) {

```

```solidity
File: libraries/Convert/LibConvert.sol

26:     function convert(bytes calldata convertData)

57:     function getMaxAmountIn(address tokenIn, address tokenOut)

85:     function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)

```

```solidity
File: libraries/Convert/LibConvertData.sol

21:     function convertKind(bytes memory self)

30:     function basicConvert(bytes memory self)

42:     function convertWithAddress(bytes memory self)

57:     function lambdaConvert(bytes memory self)

```

```solidity
File: libraries/Convert/LibCurveConvert.sol

53:     function getBeanAmountOut(address pool, uint256 amountIn) internal view returns(uint256 beans) {

63:     function getLPAmountOut(address pool, uint256 amountIn) internal view returns(uint256 lp) {

73:     function convertLPToBeans(bytes memory convertData)

93:     function convertBeansToLP(bytes memory convertData)

```

```solidity
File: libraries/Convert/LibLambdaConvert.sol

15:     function convert(bytes memory convertData)

```

```solidity
File: libraries/Convert/LibMetaCurveConvert.sol

31:     function beansAtPeg(uint256[2] memory balances)

39:     function lpToPeg(uint256[2] memory balances, uint256 atPeg) internal view returns (uint256 lp) {

```

```solidity
File: libraries/Convert/LibUnripeConvert.sol

21:     function convertLPToBeans(bytes memory convertData)

60:     function convertBeansToLP(bytes memory convertData)

99:     function beansToPeg() internal view returns (uint256 beans) {

109:     function lpToPeg() internal view returns (uint256 lp) {

116:     function getLPAmountOut(uint256 amountIn)

132:     function getBeanAmountOut(uint256 amountIn)

```

```solidity
File: libraries/Curve/LibBeanMetaCurve.sol

31:     function bdv(uint256 amount) internal view returns (uint256) {

47:     function getDeltaB() internal view returns (int256 deltaB) {

87:     function getXP(uint256[2] memory balances)

98:     function getXP0(uint256 balance)

109:     function getX0(uint256 xp0)

```

```solidity
File: libraries/Curve/LibCurve.sol

25:     function getPrice(

37:     function getPrice(

83:     function getD(uint256[2] memory xp, uint256 a)

114:     function getYD(

154:     function getXP(

167:     function getXP(

```

```solidity
File: libraries/Curve/LibMetaCurve.sol

45:     function getDFroms(

```

```solidity
File: libraries/Decimal.sol

32:     function zero()

48:     function from(

58:     function ratio(

71:     function add(

82:     function sub(

93:     function sub(

116:     function div(

127:     function pow(

147:     function add(

158:     function sub(

169:     function sub(

192:     function div(

203:     function equals(D256 memory self, D256 memory b) internal pure returns (bool) {

207:     function greaterThan(D256 memory self, D256 memory b) internal pure returns (bool) {

211:     function lessThan(D256 memory self, D256 memory b) internal pure returns (bool) {

215:     function greaterThanOrEqualTo(D256 memory self, D256 memory b) internal pure returns (bool) {

219:     function lessThanOrEqualTo(D256 memory self, D256 memory b) internal pure returns (bool) {

223:     function isZero(D256 memory self) internal pure returns (bool) {

227:     function asUint256(D256 memory self) internal pure returns (uint256) {

```

```solidity
File: libraries/LibAppStorage.sol

15:     function diamondStorage() internal pure returns (AppStorage storage ds) {

```

```solidity
File: libraries/LibBytes.sol

18:     function toUint8(bytes memory _bytes, uint256 _start) internal pure returns (uint8) {

34:     function toUint32(bytes memory _bytes, uint256 _start) internal pure returns (uint32) {

50:     function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {

68:     function sliceToMemory(bytes calldata b, uint256 start, uint256 length) internal pure returns (bytes memory) {

76:     function packAddressAndStem(address _address, int96 stem) internal pure returns (uint256) {

80:     function unpackAddressAndStem(uint256 data) internal pure returns(address, int96) {

```

```solidity
File: libraries/LibBytes64.sol

20:     function encode(bytes memory data) internal pure returns (string memory) {

```

```solidity
File: libraries/LibDiamond.sol

53:     function setContractOwner(address _newOwner) internal {

60:     function contractOwner() internal view returns (address contractOwner_) {

64:     function enforceIsOwnerOrContract() internal view {

70:     function enforceIsContractOwner() internal view {

76:     function addDiamondFunctions(

```

```solidity
File: libraries/LibDibbler.sol

68:     function sow(uint256 beans, uint256 _morningTemperature, address account, bool abovePeg) internal returns (uint256) {

330:     function scaleSoilUp(

372:     function remainingPods() internal view returns (uint256) {

```

```solidity
File: libraries/LibFertilizer.sol

32:     function addFertilizer(

107:     function push(uint128 id) internal {

151:     function pop() internal returns (bool) {

```

```solidity
File: libraries/LibFunction.sol

21:     function checkReturn(bool success, bytes memory result) internal pure {

39:     function facetForSelector(bytes4 selector)

75:     function useClipboard(

107:     function pasteAdvancedBytes(

```

```solidity
File: libraries/LibIncentive.sol

65:     function determineReward(uint256 initialGasLeft, uint256[2] memory balances, uint256 blocksLate)

```

```solidity
File: libraries/LibPRBMath.sol

44:     function powu(uint256 x, uint256 y) internal pure returns (uint256 result) {

133:     function logBase2(uint256 x) internal pure returns (uint256 result) {

168:     function max(uint256 a, uint256 b) internal pure returns (uint256) {

172:     function min(uint256 a, uint256 b) internal pure returns (uint256) {

176:     function min(uint128 a, uint128 b) internal pure returns (uint256) {

```

```solidity
File: libraries/LibPolynomial.sol

85:     function evaluatePolynomialPiecewise(

137:     function evaluatePolynomialIntegrationPiecewise(

```

```solidity
File: libraries/LibSafeMath128.sol

15:     function tryAdd(uint128 a, uint128 b) internal pure returns (bool, uint128) {

26:     function trySub(uint128 a, uint128 b) internal pure returns (bool, uint128) {

36:     function tryMul(uint128 a, uint128 b) internal pure returns (bool, uint128) {

51:     function tryDiv(uint128 a, uint128 b) internal pure returns (bool, uint128) {

61:     function tryMod(uint128 a, uint128 b) internal pure returns (bool, uint128) {

76:     function add(uint128 a, uint128 b) internal pure returns (uint128) {

92:     function sub(uint128 a, uint128 b) internal pure returns (uint128) {

107:     function mul(uint128 a, uint128 b) internal pure returns (uint128) {

126:     function div(uint128 a, uint128 b) internal pure returns (uint128) {

143:     function mod(uint128 a, uint128 b) internal pure returns (uint128) {

161:     function sub(uint128 a, uint128 b, string memory errorMessage) internal pure returns (uint128) {

181:     function div(uint128 a, uint128 b, string memory errorMessage) internal pure returns (uint128) {

201:     function mod(uint128 a, uint128 b, string memory errorMessage) internal pure returns (uint128) {

```

```solidity
File: libraries/LibSafeMath32.sol

15:     function tryAdd(uint32 a, uint32 b) internal pure returns (bool, uint32) {

26:     function trySub(uint32 a, uint32 b) internal pure returns (bool, uint32) {

36:     function tryMul(uint32 a, uint32 b) internal pure returns (bool, uint32) {

51:     function tryDiv(uint32 a, uint32 b) internal pure returns (bool, uint32) {

61:     function tryMod(uint32 a, uint32 b) internal pure returns (bool, uint32) {

76:     function add(uint32 a, uint32 b) internal pure returns (uint32) {

92:     function sub(uint32 a, uint32 b) internal pure returns (uint32) {

107:     function mul(uint32 a, uint32 b) internal pure returns (uint32) {

126:     function div(uint32 a, uint32 b) internal pure returns (uint32) {

143:     function mod(uint32 a, uint32 b) internal pure returns (uint32) {

161:     function sub(uint32 a, uint32 b, string memory errorMessage) internal pure returns (uint32) {

181:     function div(uint32 a, uint32 b, string memory errorMessage) internal pure returns (uint32) {

201:     function mod(uint32 a, uint32 b, string memory errorMessage) internal pure returns (uint32) {

```

```solidity
File: libraries/LibSafeMathSigned128.sol

22:     function mul(int128 a, int128 b) internal pure returns (int128) {

50:     function div(int128 a, int128 b) internal pure returns (int128) {

69:     function sub(int128 a, int128 b) internal pure returns (int128) {

86:     function add(int128 a, int128 b) internal pure returns (int128) {

```

```solidity
File: libraries/LibSafeMathSigned96.sol

22:     function mul(int96 a, int96 b) internal pure returns (int96) {

50:     function div(int96 a, int96 b) internal pure returns (int96) {

69:     function sub(int96 a, int96 b) internal pure returns (int96) {

86:     function add(int96 a, int96 b) internal pure returns (int96) {

```

```solidity
File: libraries/LibStrings.sol

16:     function toString(uint256 value) internal pure returns (string memory) {

```

```solidity
File: libraries/LibUnripe.sol

22:     function percentBeansRecapped() internal view returns (uint256 percent) {

30:     function percentLPRecapped() internal view returns (uint256 percent) {

54:     function unripeToUnderlying(address unripeToken, uint256 unripe)

65:     function underlyingToUnripe(address unripeToken, uint256 underlying)

76:     function addUnderlying(address token, uint256 underlying) internal {

87:     function removeUnderlying(address token, uint256 underlying) internal {

```

```solidity
File: libraries/Oracle/LibCurveOracle.sol

45:     function check() internal view returns (int256 deltaB) {

61:     function capture() internal returns (int256 deltaB, uint256[2] memory balances) {

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

232:     function seasonToStem(uint256 seedsPerBdv, uint32 season)

257:    function _migrateNoDeposits(address account) internal {

284:     function _mowAndMigrate(

373:     function _mowAndMigrateMerkleCheck(

500:     function _claimWithdrawal(

521:     function _claimWithdrawals(

```

```solidity
File: libraries/Silo/LibLegacyWhitelist.sol

42:     function whitelistToken(

```

```solidity
File: libraries/Silo/LibSilo.sol

143:     function mintStalk(address account, uint256 stalk) internal {

229:     function burnStalk(address account, uint256 stalk) internal {

286:     function transferStalk(

319:    function _mow(address account, address token) internal {

497:     function _removeDepositFromAccount(

550:     function _removeDepositsFromAccount(

```

```solidity
File: libraries/Silo/LibSiloPermit.sol

57:     function permit(

93:     function permits(

125:     function nonces(address owner) internal view returns (uint256) {

199:     function _spendDepositAllowance(

```

```solidity
File: libraries/Silo/LibTokenSilo.sol

90:     function decrementTotalDeposited(address token, uint256 amount, uint256 bdv) internal {

103:     function incrementTotalDepositedBdv(address token, uint256 bdv) internal {

118:     function deposit(

232:     function removeDepositFromAccount(

337:     function stalkEarnedPerSeason(address token) internal view returns (uint256) {

345:     function stalkIssuedPerBdv(address token) internal view returns (uint256) {

370:     function grownStalkForDeposit(

393:     function calculateStalkFromStemAndBdv(address token, int96 grownStalkIndexOfDeposit, uint256 bdv)

407:     function calculateGrownStalkAndStem(address token, uint256 grownStalk, uint256 bdv)

422:     function grownStalkAndBdvToStem(address token, uint256 grownStalk, uint256 bdv)

```

```solidity
File: libraries/Silo/LibUnripeSilo.sol

90:     function removeLegacyUnripeBeanDeposit(

101:     function isUnripeBean(address token) internal pure returns (bool b) {

111:     function unripeBeanDeposit(address account, uint32 season)

156:     function removeLegacyUnripeLPDeposit(

170:     function isUnripeLP(address token) internal pure returns (bool b) {

179:     function unripeLPDeposit(address account, uint32 season)

```

```solidity
File: libraries/Silo/LibWhitelist.sol

60:     function whitelistToken(

87:     function updateStalkPerBdvPerSeasonForToken(

105:     function dewhitelistToken(address token) internal {

```

```solidity
File: libraries/Token/LibApprove.sol

18:     function approveToken(

```

```solidity
File: libraries/Token/LibBalance.sol

39:     function getBalance(address account, IERC20 token)

53:     function increaseInternalBalance(

68:     function decreaseInternalBalance(

```

```solidity
File: libraries/Token/LibEth.sol

16:     function refundEth()

```

```solidity
File: libraries/Token/LibTokenApprove.sol

41:     function spendAllowance(

```

```solidity
File: libraries/Token/LibTokenPermit.sol

24:     function permit(

41:     function nonces(address owner) internal view returns (uint256) {

```

```solidity
File: libraries/Token/LibTransfer.sol

30:     function transferToken(

85:     function burnToken(

103:     function mintToken(

```

```solidity
File: libraries/Token/LibWeth.sol

19:     function wrap(uint256 amount, LibTransfer.To mode) internal {

24:     function unwrap(uint256 amount, LibTransfer.From mode) internal {

```

```solidity
File: mocks/uniswap/MockUniswapV3Deployer.sol

27:     function deploy(

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

31:     function __Internallize_init(string memory uri_) internal {

```

## Non Critical Issues

|               | Issue                                                                      | Instances |
| ------------- | :------------------------------------------------------------------------- | :-------: |
| [NC-1](#NC-1) | `require()` / `revert()` statements should have descriptive reason strings |    28     |
| [NC-2](#NC-2) | Return values of `approve()` not checked                                   |    28     |
| [NC-3](#NC-3) | TODO Left in the code                                                      |     1     |
| [NC-4](#NC-4) | Event is missing `indexed` fields                                          |    95     |
| [NC-5](#NC-5) | Constants should be defined rather than using magic numbers                |    55     |
| [NC-6](#NC-6) | Functions not used internally could be marked external                     |    96     |
| [NC-7](#NC-7) | Typos                                                                      |    270    |

### <a name="NC-1"></a>[NC-1] `require()` / `revert()` statements should have descriptive reason strings

_Instances (28)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

76:         require(msg.sender == C.fertilizerAddress());

```

```solidity
File: beanstalk/init/replant/Replant8.sol

81:         require(NEW_FACTORY.add_existing_metapools([metapool, address(0), address(0), address(0), address(0), address(0), address(0), address(0), address(0), address(0)]));

```

```solidity
File: libraries/LibPRBMath.sol

207:             require(denominator > prod1);

```

```solidity
File: mocks/MockWETH.sol

28:         require(balanceOf(msg.sender) >= wad);

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

283:             require(value >= _min_amounts[i]);

338:         require(burn_amount > 1);

339:         require(burn_amount <= _max_burn_amount);

499:         require(i != j);

500:         require(j >= 0);

501:         require(j < N_COINS);

503:         require(i >= 0);

504:         require(i < N_COINS);

```

```solidity
File: mocks/uniswap/MockUniswapV3Factory.sol

40:         require(tokenA != tokenB);

42:         require(token0 != address(0));

44:         require(tickSpacing != 0);

45:         require(getPool[token0][token1][fee] == address(0));

55:         require(msg.sender == owner);

62:         require(msg.sender == owner);

63:         require(fee < 1000000);

67:         require(tickSpacing > 0 && tickSpacing < 16384);

68:         require(feeAmountTickSpacing[fee] == 0);

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

121:         require(msg.sender == IUniswapV3Factory(factory).owner());

151:         require(success && data.length >= 32);

161:         require(success && data.length >= 32);

196:             require(initializedLower);

205:             require(initializedUpper);

473:         require(amount > 0);

847:         require(

```

### <a name="NC-2"></a>[NC-2] Return values of `approve()` not checked

Not all IERC20 implementations `revert()` when there's a failure in `approve()`. The function signature has a boolean return value and they indicate errors that way instead. By not checking the return value, operations that should have marked as failed, may potentially go through without actually approving anything

_Instances (28)_:

```solidity
File: beanstalk/farm/TokenFacet.sol

109:         LibTokenApprove.approve(msg.sender, spender, token, amount);

120:         LibTokenApprove.approve(

147:         LibTokenApprove.approve(

183:         LibTokenApprove.approve(owner, spender, IERC20(token), value);

```

```solidity
File: beanstalk/init/InitDiamond.sol

38:         C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

39:         C.bean().approve(C.curveZapAddress(), type(uint256).max);

40:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

```

```solidity
File: beanstalk/init/replant/Replant8.sol

83:         bean.approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

84:         bean.approve(C.curveZapAddress(), type(uint256).max);

85:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

```

```solidity
File: libraries/Token/LibTokenApprove.sol

53:             approve(owner, spender, token, currentAllowance - amount);

```

```solidity
File: mocks/MockERC721.sol

23:         _approve(spender, tokenId);

```

```solidity
File: mocks/MockInitDiamond.sol

27:         C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

28:         C.bean().approve(C.curveZapAddress(), type(uint256).max);

29:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

```

```solidity
File: mocks/MockSiloToken.sol

31:             _approve(

```

```solidity
File: mocks/curve/MockCurveZap.sol

22:         IERC20(BEAN).approve(BEAN_METAPOOL, type(uint256).max);

23:         IERC20(THREE_CURVE).approve(BEAN_METAPOOL, type(uint256).max);

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

607:         _approve(msg.sender, spender, amount);

625:         _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));

642:         _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));

661:         _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));

```

```solidity
File: mocks/curve/MockPlainCurve.sol

414:         _approve(msg.sender, spender, amount);

432:         _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));

449:         _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));

468:         _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));

```

```solidity
File: tokens/ERC20/ERC20Permit.sol

62:         _approve(owner, spender, value);

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

38:         IERC20(WETH).approve(SWAP_ROUTER, type(uint256).max);

```

### <a name="NC-3"></a>[NC-3] TODO Left in the code

TODOs may signal that a feature is missing or not ready for audit, consider resolving the issue and removing the TODO comment

_Instances (1)_:

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

38:     //TODO: verify and update this root on launch if there's more drift

```

### <a name="NC-4"></a>[NC-4] Event is missing `indexed` fields

Index event fields make the field more quickly accessible to off-chain tools that parse events. However, note that each index field costs extra gas during emission, so it's not necessarily best to index the maximum allowed per event (three fields). Each event should use three indexed fields if there are three or more fields, and gas usage is not particularly of concern for the events in question. If there are fewer than three fields, all of the fields should be indexed.

_Instances (95)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

23:     event SetFertilizer(uint128 id, uint128 bpf);

```

```solidity
File: beanstalk/barn/UnripeFacet.sol

30:     event AddUnripeToken(

36:     event ChangeUnderlying(address indexed token, int256 underlying);

38:     event Chop(

45:     event Pick(

```

```solidity
File: beanstalk/diamond/PauseFacet.sol

21:     event Pause(uint256 timestamp);

22:     event Unpause(uint256 timestamp, uint256 timePassed);

```

```solidity
File: beanstalk/farm/TokenFacet.sol

31:     event InternalBalanceChanged(

37:      event TokenApproval(

```

```solidity
File: beanstalk/field/FieldFacet.sol

37:     event Sow(

50:     event Harvest(address indexed account, uint256[] plots, uint256 beans);

57:     event PodListingCancelled(address indexed account, uint256 index);

```

```solidity
File: beanstalk/field/FundraiserFacet.sol

33:     event CreateFundraiser(

46:     event FundFundraiser(

```

```solidity
File: beanstalk/init/InitDiamond.sol

25:     event Incentivization(address indexed account, uint256 beans);

```

```solidity
File: beanstalk/init/InitHotFix2.sol

15:     event BeanDeposit(address indexed account, uint256 season, uint256 beans);

16:     event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);

```

```solidity
File: beanstalk/init/InitSiloEvents.sol

25:     event SeedsBalanceChanged(

30:     event StalkBalanceChanged(

```

```solidity
File: beanstalk/init/replant/Replant1.sol

60:     event BeanRemove(

66:     event RemoveSeason(

```

```solidity
File: beanstalk/init/replant/Replant3.sol

26:     event Harvest(address indexed account, uint256[] plots, uint256 beans);

28:     event PodOrderCancelled(address indexed account, bytes32 id);

29:     event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);

```

```solidity
File: beanstalk/init/replant/Replant4.sol

22:     event ClaimSeasons(address indexed account, address indexed token, uint32[] seasons, uint256 amount);

23:     event ClaimSeason(address indexed account, address indexed token, uint32 season, uint256 amount);

24:     event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);

```

```solidity
File: beanstalk/init/replant/Replant5.sol

22:     event BeanRemove(

29:     event AddDeposit(

```

```solidity
File: beanstalk/init/replant/Replant6.sol

22:     event LPRemove(

28:     event RemoveSeasons(

35:     event RemoveSeason(

42:     event AddDeposit(

```

```solidity
File: beanstalk/init/replant/Replant7.sol

38:     event SeedsBalanceChanged(

43:     event StalkBalanceChanged(

```

```solidity
File: beanstalk/init/replant/Replant8.sol

43:     event AddUnripeToken(

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

32:     event PodListingCreated(

45:     event PodListingFilled(

54:     event PodListingCancelled(address indexed account, uint256 index);

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

26:     event PodOrderCreated(

37:     event PodOrderFilled(

47:     event PodOrderCancelled(address indexed account, bytes32 id);

```

```solidity
File: beanstalk/market/MarketplaceFacet/PodTransfer.sol

31:     event PodApproval(

```

```solidity
File: beanstalk/silo/ApprovalFacet.sol

26:     event DepositApproval(

32:     event ApprovalForAll(address indexed account, address indexed operator, bool approved);

```

```solidity
File: beanstalk/silo/ConvertFacet.sol

29:     event Convert(

37:     event RemoveDeposit(

45:     event RemoveDeposits(

```

```solidity
File: beanstalk/silo/SiloFacet/Silo.sol

37:     event Plant(

52:     event ClaimPlenty(

71:     event StalkBalanceChanged(

```

```solidity
File: beanstalk/silo/SiloFacet/TokenSilo.sol

44:     event AddDeposit(

62:     event RemoveDeposit(

81:     event RemoveDeposits(

136:     event RemoveWithdrawals(

143:     event RemoveWithdrawal(

```

```solidity
File: beanstalk/silo/WhitelistFacet.sol

17:     event WhitelistToken(

24:     event UpdatedStalkPerBdvPerSeason(

```

```solidity
File: beanstalk/sun/SeasonFacet/SeasonFacet.sol

29:     event Incentivization(address indexed account, uint256 beans);

```

```solidity
File: beanstalk/sun/SeasonFacet/Sun.sol

47:     event Reward(

59:     event Soil(

```

```solidity
File: beanstalk/sun/SeasonFacet/Weather.sol

51:     event WeatherChange(

63:     event SeasonOfPlenty(

```

```solidity
File: interfaces/IDiamondCut.sol

29:     event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);

```

```solidity
File: libraries/LibDiamond.sol

74:     event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

```

```solidity
File: libraries/LibDibbler.sol

36:     event Sow(

```

```solidity
File: libraries/LibFertilizer.sol

23:     event SetFertilizer(uint128 id, uint128 bpf);

```

```solidity
File: libraries/LibUnripe.sol

18:     event ChangeUnderlying(address indexed token, int256 underlying);

```

```solidity
File: libraries/Oracle/LibCurveOracle.sol

37:     event MetapoolOracle(

```

```solidity
File: libraries/Silo/LibLegacyTokenSilo.sol

45:     event RemoveDeposit(

53:     event SeedsBalanceChanged(

59:     event StalkBalanceChanged(

66:     event RemoveWithdrawals(

72:     event RemoveWithdrawal(

```

```solidity
File: libraries/Silo/LibLegacyWhitelist.sol

32:     event WhitelistToken(

```

```solidity
File: libraries/Silo/LibSilo.sol

66:     event StalkBalanceChanged(

81:     event RemoveDeposit(

99:     event RemoveDeposits(

```

```solidity
File: libraries/Silo/LibSiloPermit.sol

38:     event DepositApproval(

```

```solidity
File: libraries/Silo/LibTokenSilo.sol

54:     event AddDeposit(

```

```solidity
File: libraries/Silo/LibWhitelist.sol

32:     event WhitelistToken(

45:     event UpdatedStalkPerBdvPerSeason(

```

```solidity
File: libraries/Token/LibBalance.sol

30:     event InternalBalanceChanged(

```

```solidity
File: libraries/Token/LibTokenApprove.sol

14:     event TokenApproval(

```

```solidity
File: mocks/MockInitDiamond.sol

21:     event Incentivization(address indexed account, uint256 beans);

```

```solidity
File: mocks/MockWETH.sol

17:     event  Deposit(address indexed dst, uint wad);

18:     event  Withdrawal(address indexed src, uint wad);

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

44:     event Approval(address indexed owner, address indexed spender, uint value);

45:     event Transfer(address indexed from, address indexed to, uint value);

```

```solidity
File: mocks/curve/MockPlainCurve.sol

24:     event Approval(address indexed owner, address indexed spender, uint value);

25:     event Transfer(address indexed from, address indexed to, uint value);

```

```solidity
File: mocks/mockFacets/MockConvertFacet.sol

18:     event MockConvert(uint256 stalkRemoved, uint256 bdvRemoved);

```

```solidity
File: mocks/mockFacets/MockSeasonFacet.sol

29:     event UpdateTWAPs(uint256[2] balances);

30:     event DeltaB(int256 deltaB);

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

22:     event ClaimFertilizer(uint256[] ids, uint256 beans);

```

### <a name="NC-5"></a>[NC-5] Constants should be defined rather than using magic numbers

_Instances (55)_:

```solidity
File: beanstalk/AppStorage.sol

71:         uint128 bdv; // ──────┘ 16 (28/32)

202:         uint32 start; //        │ 4 (24)

203:         uint32 period; //       │ 4 (28)

204:         bool executed; // ──────┘ 1 (29/32)

314:         uint32 lastSopSeason; //   │ 4 (13)

315:         uint32 rainStart; //       │ 4 (17)

316:         bool raining; //           │ 1 (18)

317:         bool fertilizing; //       │ 1 (19)

318:         uint32 sunriseBlock; //    │ 4 (23)

319:         bool abovePeg; //          | 1 (24)

320:         uint16 stemStartSeason; // ┘ 2 (26/32)

336:         uint128 lastDSoil;  // ───┐ 16 (16)

337:         uint32 lastSowTime; //    │ 4  (20)

338:         uint32 thisSowTime; //    │ 4  (24)

339:         uint32 t; // ─────────────┘ 4  (28/32)

499:     uint128 pausedAt; // ───┘ 16 (17/32)

```

```solidity
File: beanstalk/diamond/PauseFacet.sol

42:         timePassed = (timePassed.div(3600).add(1)).mul(3600);

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

292:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

220:         require(pricingFunction.length == LibPolynomial.getNumPieces(pricingFunction).mul(168).add(32), "Marketplace: Invalid pricing function.");

```

```solidity
File: ecosystem/price/CurvePrice.sol

102:         return [10**(36-decimals), I3Curve(CRV3_POOL).get_virtual_price()];

```

```solidity
File: libraries/Curve/LibBeanMetaCurve.sol

19:     uint256 private constant RATE_MULTIPLIER = 1e12; // Bean has 6 Decimals => 1e(18 - delta decimals)

```

```solidity
File: libraries/LibBytes64.sol

64:                 mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))

67:                 mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))

```

```solidity
File: libraries/LibDibbler.sol

175:                             return _scaleTemperature(279415312704);

179:                        return _scaleTemperature(409336034395);

182:                         return _scaleTemperature(494912626048);

187:                         return _scaleTemperature(558830625409);

190:                         return _scaleTemperature(609868162219);

194:                     return _scaleTemperature(652355825780);

200:                         return _scaleTemperature(688751347100);

203:                         return _scaleTemperature(720584687295);

207:                     return _scaleTemperature(748873234524);

212:                     return _scaleTemperature(774327938752);

215:                     return _scaleTemperature(797465225780);

219:                 return _scaleTemperature(818672068791);

226:                         return _scaleTemperature(838245938114);

229:                         return _scaleTemperature(856420437864);

233:                     return _scaleTemperature(873382373802);

238:                     return _scaleTemperature(889283474924);

241:                     return _scaleTemperature(904248660443);

245:                 return _scaleTemperature(918382006208);

251:                     return _scaleTemperature(931771138485);

254:                     return _scaleTemperature(944490527707);

258:                 return _scaleTemperature(956603996980);

263:                 return _scaleTemperature(968166659804);

266:                 return _scaleTemperature(979226436102);

270:             return _scaleTemperature(989825252096);

```

```solidity
File: libraries/LibPolynomial.sol

234:         significands[2] = significandSlice.toUint256(64);

235:         significands[3] = significandSlice.toUint256(96);

246:         bytes memory exponentSlice = f.sliceToMemory((pieceIndex.mul(4)).add(numPieces.mul(160)).add(32), 4);

261:         bytes memory signSlice = f.sliceToMemory((pieceIndex.mul(4)).add(numPieces.mul(164)).add(32), 4);

```

```solidity
File: libraries/LibStrings.sol

33:             buffer[index--] = bytes1(uint8(48 + temp % 10));

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

75:         rate_multiplier = 10 ** (36 - MockToken(_token).decimals());

```

```solidity
File: mocks/uniswap/MockUniswapV3Factory.sol

27:         emit FeeAmountEnabled(500, 10);

29:         emit FeeAmountEnabled(3000, 60);

```

### <a name="NC-6"></a>[NC-6] Functions not used internally could be marked external

_Instances (96)_:

```solidity
File: beanstalk/farm/TokenSupportFacet.sol

30:     function permitERC20(

```

```solidity
File: beanstalk/field/FieldFacet.sol

228:     function podIndex() public view returns (uint256) {

235:     function harvestableIndex() public view returns (uint256) {

243:     function totalPods() public view returns (uint256) {

250:     function totalHarvested() public view returns (uint256) {

260:     function totalHarvestable() public view returns (uint256) {

267:     function totalUnharvestable() public view returns (uint256) {

275:     function plot(address account, uint256 index)

```

```solidity
File: beanstalk/field/FundraiserFacet.sol

168:     function remainingFunding(uint32 id) public view returns (uint256) {

172:     function totalFunding(uint32 id) public view returns (uint256) {

176:     function fundingToken(uint32 id) public view returns (address) {

180:     function fundraiser(uint32 id)

188:     function numberOfFundraisers() public view returns (uint32) {

```

```solidity
File: beanstalk/silo/SiloFacet/SiloExit.sol

57:     function lastUpdate(address account) public view returns (uint32) {

66:     function totalStalk() public view returns (uint256) {

73:     function totalRoots() public view returns (uint256) {

83:     function totalEarnedBeans() public view returns (uint256) {

96:     function balanceOfStalk(address account) public view returns (uint256) {

114:     function balanceOfRoots(address account) public view returns (uint256) {

125:     function balanceOfGrownStalk(address account, address token)

145:     function grownStalkForDeposit(

230:     function lastSeasonOfPlenty() public view returns (uint32) {

250:     function balanceOfRainRoots(address account) public view returns (uint256) {

284:     function stemTipForToken(address token)

298:     function seasonToStem(address token, uint32 season)

327:     function migrationNeeded(address account) public view returns (bool) {

339:     function inVestingPeriod() public view returns (bool) {

```

```solidity
File: beanstalk/silo/SiloFacet/SiloFacet.sol

175:     function transferDeposits(

```

```solidity
File: beanstalk/sun/SeasonFacet/Weather.sol

75:     function weather() public view returns (Storage.Weather memory) {

82:     function rain() public view returns (Storage.Rain memory) {

```

```solidity
File: ecosystem/price/CurvePrice.sol

36:     function getCurve() public view returns (P.Pool memory pool) {

```

```solidity
File: mocks/MockBlockBasefee.sol

22:     function setAnswer(uint256 ans) public {

```

```solidity
File: mocks/MockERC721.sol

17:     function permit(

```

```solidity
File: mocks/MockFertilizer.sol

16:     function initialize() public initializer {

```

```solidity
File: mocks/MockSiloToken.sol

23:     function mint(address account, uint256 amount) public onlyOwner returns (bool) {

28:     function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {

```

```solidity
File: mocks/MockToken.sol

30:     function burnFrom(address account, uint256 amount) public override(ERC20Burnable) {

34:     function burn(uint256 amount) public override(ERC20Burnable) {

38:     function setDecimals(uint256 dec) public {

```

```solidity
File: mocks/MockUpgradeInitDiamond.sol

14:     function init() public {

```

```solidity
File: mocks/MockWETH.sol

27:     function withdraw(uint wad) public {

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

116:     function update(uint256[2] calldata new_balances) public {

534:     function calc_token_amount(uint256[N_COINS] memory _amounts, bool _is_deposit) public view returns (uint256) {

587:     function transfer(address recipient, uint256 amount) public returns (bool) {

595:     function allowance(address owner, address spender) public view returns (uint256) {

606:     function approve(address spender, uint256 amount) public returns (bool) {

623:     function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {

641:     function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {

660:     function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {

```

```solidity
File: mocks/curve/MockPlainCurve.sol

102:     function update(uint256[2] calldata new_balances) public {

341:     function calc_token_amount(uint256[N_COINS] memory _amounts, bool _is_deposit) public view returns (uint256) {

394:     function transfer(address recipient, uint256 amount) public returns (bool) {

402:     function allowance(address owner, address spender) public view returns (uint256) {

413:     function approve(address spender, uint256 amount) public returns (bool) {

430:     function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {

448:     function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {

467:     function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {

```

```solidity
File: mocks/mockFacets/MockAdminFacet.sol

43:     function rewardSunrise(uint256 amount) public {

50:     function fertilizerSunrise(uint256 amount) public {

```

```solidity
File: mocks/mockFacets/MockMarketplaceFacet.sol

18:     function evaluatePolynomialPiecewise(bytes calldata f, uint256 x) public pure returns (uint256) {

22:     function evaluatePolynomialIntegrationPiecewise(bytes calldata f, uint256 start, uint256 end) public pure returns (uint256) {

26:     function findPiecewiseIndex(bytes calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {

```

```solidity
File: mocks/mockFacets/MockSeasonFacet.sol

36:     function setYieldE(uint256 t) public {

40:     function siloSunrise(uint256 amount) public {

53:     function rainSunrise() public {

60:     function rainSunrises(uint256 amount) public {

69:     function droughtSunrise() public {

76:     function rainSiloSunrise(uint256 amount) public {

84:     function droughtSiloSunrise(uint256 amount) public {

92:     function sunSunrise(int256 deltaB, uint256 caseId) public {

99:     function sunTemperatureSunrise(int256 deltaB, uint256 caseId, uint32 t) public {

107:     function lightSunrise() public {

113:     function fastForward(uint32 _s) public {

118:     function teleportSunrise(uint32 _s) public {

123:     function farmSunrise() public {

130:     function farmSunrises(uint256 number) public {

139:     function setMaxTempE(uint32 number) public {

143:     function setAbovePegE(bool peg) public {

147:     function setLastDSoilE(uint128 number) public {

151:     function setNextSowTimeE(uint32 time) public {

155:     function setLastSowTimeE(uint32 number) public {

159:     function setSoilE(uint256 amount) public {

163:     function resetState() public {

198:     function setCurrentSeasonE(uint32 season) public {

202:     function stepWeatherWithParams(

221:     function resetSeasonStart(uint256 amount) public {

```

```solidity
File: mocks/mockFacets/MockSiloFacet.sol

309:     function balanceOfSeeds(address account) public view returns (uint256) {

313:     function totalSeeds() public view returns (uint256) {

```

```solidity
File: mocks/mockFacets/MockUpgradeFacet.sol

14:     function woohoo() public pure returns (uint256) {

```

```solidity
File: mocks/uniswap/MockUniswapV3Factory.sol

61:     function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

105:     function remaining() public view returns (uint256) {

109:     function getMintId() public view returns (uint256) {

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

37:     function initialize(string memory _uri) public initializer {

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

45:     function setURI(string calldata newuri) public onlyOwner {

49:     function name() public pure returns (string memory) {

53:     function symbol() public pure returns (string memory) {

```

### <a name="NC-7"></a>[NC-7] Typos

_Instances (270)_:

```diff
File: C.sol

- 31:     /// @dev The length of a Season meaured in seconds.
+ 31:     /// @dev The length of a Season measured in seconds.

- 72:     // Use external contract for block.basefee as to avoid upgrading existing contracts to solidity v8
+ 72:     // Use external contract for block.basefee to avoid upgrading existing contracts to solidity v8

```

```diff
File: beanstalk/AppStorage.sol

- 490:  * @param vestingPeriodRoots the number of roots to add to the global roots, in the case the user plants in the morning. // placed here to save a storage slot.s
+ 490:  * @param vestingPeriodRoots the number of roots to add to the global roots, in the case the user plants in the morning. // placed here to save a storage slot.

```

```diff
File: beanstalk/AppStorageOld.sol

- 193:     // Added reentrantStatus.
+ 193:     // Added `reentrantStatus`.

```

```diff
File: beanstalk/Diamond.sol

- 6: * Authors: Nick Mudge (https://twitter.com/mudgen)
+ 6: // Authors: Nick Mudge (https://twitter.com/mudgen)

```

```diff
File: beanstalk/ReentrancyGuard.sol

- 11:  * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts%2Fsecurity%2FReentrancyGuard.sol
+ 11: // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts%2Fsecurity%2FReentrancyGuard.sol

```

```diff
File: beanstalk/barn/FertilizerFacet.sol

- 45:         uint128 remaining = uint128(LibFertilizer.remainingRecapitalization().div(1e6)); // remaining <= 77_000_000 so downcasting is safe.
+ 45:         uint128 remaining = uint128(LibFertilizer.remainingRecapitalization().div(1e6)); // remaining <= 77_000_000, so downcasting is safe.

```

```diff
File: beanstalk/barn/UnripeFacet.sol

- 21: /// @notice Manage the logic of the vesting process for the Barnraised Funds
+ 21: /// @notice Manages the logic of the vesting process for the Barnraised Funds

```

```diff
File: beanstalk/diamond/DiamondCutFacet.sol

- 19:     /// @param _init The address of the contract or facet to execute _calldata
+ 19:     /// @param _init The address of the contract or facet to execute _calldata on

```

```diff
File: beanstalk/diamond/DiamondLoupeFacet.sol

- 26:     /// @notice Gets all facets and their selectors.
+ 26:     /// @notice Get all facets and their selectors.

- 39:     /// @notice Gets all the function selectors provided by a facet.
+ 39:     /// @notice Get all the function selectors provided by a facet.

- 59:     /// @notice Gets the facet that supports the given selector.
+ 59:     /// @notice Get the facet that supports the given selector.

```

```diff
File: beanstalk/farm/CurveFacet.sol

- 249:         // 3Pool and Tri-Crypto pools do not return the resulting value,
+ 249:         // 3Pool and Tri-Crypto pools do not return the resulting value.

- 250:         // Thus, we need to call the balanceOf function to determine
+ 250:         // Thus, we need to call the balanceOf function to determine how many tokens were received.

251:         // how many tokens were received.

```

```diff
File: beanstalk/farm/FarmFacet.sol

- 17:  * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
+ 17: // Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)

```

```diff
File: beanstalk/farm/TokenFacet.sol

- 44:     //////////////////////// Transfer ////////////////////////
+ 44:     //////////////////////// Transfer //////////////////////

- 98:     //////////////////////// Transfer ////////////////////////
+ 98:     //////////////////////// Transfer //////////////////////

- 167:     //////////////////////// Permit ////////////////////////
+ 167:     //////////////////////// Permit //////////////////////

- 198:     //////////////////////// ERC1155Reciever ////////////////////////
+ 198:     //////////////////////// ERC1155Receiver //////////////

- 240:     //////////////////////// WETH ////////////////////////
+ 240:     //////////////////////// WETH //////////////////////

- 257:     //////////////////////// GETTERS ////////////////////////
+ 257:     //////////////////////// GETTERS //////////////////////

```

```diff
File: beanstalk/farm/TokenSupportFacet.sol

- 28:     /// @notice permitERC20 is wrapper function for permit of ERC20Permit token
+ 28:     /// @notice permitERC20 is a wrapper function for permit of ERC20Permit token

```

```diff
File: beanstalk/field/FieldFacet.sol

- 105:         // `soil` is the remaining Soil
+ 105:         // `soil` is the remaining soil

- 117:         // If beans >= soil, Sow all of the remaining Soil
+ 117:         // If beans >= soil, sow all of the remaining soil

- 122:         // 1 Bean is Sown in 1 Soil, i.e. soil = beans
+ 122:         // 1 bean is sown in 1 soil, i.e. soil = beans

- 198:         // Calculate how many Pods are harvestable.
+ 198:         // Calculate how many pods are harvestable.

- 199:         // The upstream _harvest function checks that at least some Pods
+ 199:         // The upstream _harvest function checks that at least some pods

- 204:         // Cancel any active Pod Listings active for this Plot.
+ 204:         // Cancel any active pod listings active for this Plot.

- 212:         // If the entire Plot was harvested, exit.
+ 212:         // If the entire plot was harvested, exit.

- 217:         // Create a new Plot with remaining Pods.
+ 217:         // Create a new plot with remaining pods.

- 293:         // Below peg: Soil is fixed to the amount set during {stepWeather}.
+ 293:         // Below peg: soil is fixed to the amount set during {stepWeather}.

- 294:         // Morning Temperature is dynamic, starting small and logarithmically
+ 294:         // Morning temperature is dynamic, starting small and logarithmically

- 300:         // Above peg: the maximum amount of Pods that Beanstalk is willing to mint
+ 300:         // Above peg: the maximum amount of pods that Beanstalk is willing to mint

- 302:         // need to scale up the amount of Soil to hold Pods constant.
+ 302:         // need to scale up the amount of soil to hold pods constant.

- 305:                 uint256(s.f.soil), // max soil offered this Season, reached when `t >= 25`
+ 305:                 uint256(s.f.soil), // max soil offered this season, reached when `t >= 25`

- 321:         // Below peg: Soil is fixed to the amount set during {stepWeather}.
+ 321:         // Below peg: soil is fixed to the amount set during {stepWeather}.

- 326:         // Above peg: Soil is dynamic
+ 326:         // Above peg: soil is dynamic

```

```diff
File: beanstalk/init/InitBip0.sol

- 32:         // Update Silo
+ 32:         // Update Silo State

- 39:         // Update Silo Increase
+ 39:         // Update Silo Increase State

- 44:         // Update Rain + SOP
+ 44:         // Update Rain + SOP State

- 49:         // Migrate State Variables
+ 49:         // Migrate State

- 57:         // migrate bips to new model
+ 57:         // Migrate Bips

```

```diff
File: beanstalk/init/InitBip1.sol

- 23:         IBean(s.c.bean).mint(marketingBudget, 80_000_000_000); // 80,000 Beans
+ 23:         IBean(s.c.bean).mint(marketingBudget, 80_000_000_000); // 80,000,000,000 Beans

- 24:         IBean(s.c.bean).mint(developmentBudget, 120_000_000_000); // 120,000 Beans
+ 24:         IBean(s.c.bean).mint(developmentBudget, 120_000_000_000); // 120,000,000,000 Beans

```

```diff
File: beanstalk/init/InitBip13.sol

- 20:         // Dsc, Sdy, Inc, nul
+ 20:         // Dsc, Sdy, Inc, Nul

- 22:             -1,  -3,  -3,   0,  //          P > 1
+ 22:             -1,  -3,  -3,   0,  //          P >= 1

- 24:             -1,  -3,  -3,   0,  //          P > 1
+ 24:             -1,  -3,  -3,   0,  //          P >= 1

- 26:              0,  -1,  -3,   0,  //          P > 1
+ 26:              0,  -1,  -3,   0,  //          P >= 1

- 28:              0,  -1,  -3,   0   //          P > 1
+ 28:              0,  -1,  -3,   0   //          P >= 1

```

```diff
File: beanstalk/init/InitBip24.sol

- 17:     uint256 private constant payment = 10_000 * 1e6; // 10,000 Beans
+ 17:     uint256 private constant payment = 10_000 * 1e6; // 10,000 Beans per block

```

```diff
File: beanstalk/init/InitBip5.sol

- 25:         IBS(address(this)).createFundraiser(payee, token, 140_000_000_000); // 140,000
+ 25:         IBS(address(this)).createFundraiser(payee, token, 140_000_000_000); // 140,000,000,000

- 26:         IBean(address(bean)).mint(payee, 15_000_000_000); // 15,000
+ 26:         IBean(address(bean)).mint(payee, 15_000_000_000); // 15,000,000,000

```

```diff
File: beanstalk/init/InitBip7.sol

- 18:     uint256 private constant payment = 6_000_000_000; // 6,000
+ 18:     uint256 private constant payment = 6_000_000_000; // 6,000,000,000

```

```diff
File: beanstalk/init/InitBipNewSilo.sol

- 36:         // this adds the ERC1155 indentifier to the diamond:
+ 36:         // this adds the ERC1155 identifier to the diamond:

```

```diff
File: beanstalk/init/InitBipSunriseImprovements.sol

- 17:         uint256 startSoil; // slot 1
+ 17:         uint256 startSoil; // slot 1, 2

- 18:         uint256 lastDSoil; // slot 2
+ 18:         uint256 lastDSoil; // slot 2, 3

- 19:         uint96 lastSoilPercent; // gone
+ 19:         uint96 lastSoilPercent; // slot 3, 4

- 20:         uint32 lastSowTime; // slot 3
+ 20:         uint32 lastSowTime; // slot 4, 5

- 21:         uint32 thisSowTime; // slot 3
+ 21:         uint32 thisSowTime; // slot 5, 6

- 22:         uint32 yield; // slot 3
+ 22:         uint32 yield; // slot 6, 7

- 23:         bool didSowBelowMin; // no
+ 23:         bool didSowBelowMin; // slot 7, 8

- 24:         bool didSowFaster; // no
+ 24:         bool didSowFaster; // slot 8, 9

```

```diff
File: beanstalk/init/InitDiamond.sol

- 43:         // Dsc, Sdy, Inc, nul
+ 43:         // Dsc, Sdy, Inc, Nul

- 45:             -1,  -3,  -3,   0,  //          P > 1
+ 45:             -1,  -3,  -3,   0,  //          P >= 1

- 47:             -1,  -3,  -3,   0,  //          P > 1
+ 47:             -1,  -3,  -3,   0,  //          P >= 1

- 49:              0,  -1,  -3,   0,  //          P > 1
+ 49:              0,  -1,  -3,   0,  //          P >= 1

- 51:              0,  -1,  -3,   0   //          P > 1
+ 51:              0,  -1,  -3,   0   //          P >= 1

```

```diff
File: beanstalk/init/InitHotFix4.sol

- 25:         // Remove all exiting farmable Stalk
+ 25:         // Remove all existing farmable Stalk

- 29:         // Increment unclaimed Roots to total for previous misallocation
+ 29:         // Increment unclaimed Roots to total for previous misallocations

```

```diff
File: beanstalk/init/replant/Replant1.sol

- 85:         // 1. Remove Deposits
+ 85:         // 1. Remove Deposit

- 119:         // 2. Decrement Total Deposited for each token
+ 119:         // 2. Decrement Total Deposited for each bean

```

```diff
File: beanstalk/init/replant/Replant8.sol

- 49:     // Bean Token
+ 49:     // Bean Token (BEAN)

- 51:     uint256 constant INITIAL_LP = 100e6; // 100 Beans
+ 51:     uint256 constant INITIAL_LP = 100e6; // 100 BEAN

- 55:     //Bean 3Crv Pool
+ 55:     //BEAN 3Crv Pool

```

```diff
File: beanstalk/market/MarketplaceFacet/Order.sol

- 52:     // Note: Orders changed and now can accept an arbitary amount of beans, possibly higher than the value of the order
+ 52:     // Note: Orders changed and now can accept an arbitrary amount of beans, possibly higher than the value of the order

```

```diff
File: beanstalk/silo/ConvertFacet.sol

- 190:         // First, remove Deposits because every deposit is in a different season,
+ 190:         // First, remove Deposits because every deposit is in a different season.

- 191:         // we need to get the total Stalk, not just BDV.
+ 191:         // We need to get the total Stalk, not just BDV.

- 198:         //pulled these vars out because of "CompilerError: Stack too deep, try removing local variables."
+ 198:         // Pulled these vars out because of "CompilerError: Stack too deep, try removing local variables."

- 199:         int96 _lastStem = LibTokenSilo.stemTipForToken(token); //need for present season
+ 199:         int96 _lastStem = LibTokenSilo.stemTipForToken(token); // Need for present season

- 208:                 // Ensure that a rounding error does not occur by using the
+ 208:                 // Ensure that a rounding error does not occur by using the remainder BDV for the last Deposit.

- 209:                 // remainder BDV for the last Deposit.
+ 209:                 // depositBdv is a proportional amount of the total bdv. Cheaper than calling the BDV function multiple times.

- 212:                 // depositBdv is a proportional amount of the total bdv.
+ 212:         // Mint Stalk associated with the delta BDV.

- 213:                 // Cheaper than calling the BDV function multiple times.
+ 213:         // a bracket is included here to avoid the "stack too deep" error.

- 240:         // Mint Stalk associated with the delta BDV.
+ 240:                     // Keeping track of stalk removed must happen before we actually remove the deposit.

- 260:         // a bracket is included here to avoid the "stack too deep" error.
+ 260:                     // This is because LibTokenSilo.grownStalkForDeposit() uses the current deposit info.

- 266:                     //keeping track of stalk removed must happen before we actually remove the deposit
+ 266:     // This is only used internal to the convert facet.

- 267:                     //this is because LibTokenSilo.grownStalkForDeposit() uses the current deposit info
+ 267:         uint256 grownStalk // stalk grown previously by this deposit

- 345:     //this is only used internal to the convert facet
+ 345:         // Calculate stem index we need to deposit at from grownStalk and bdv.

- 350:         uint256 grownStalk // stalk grown previously by this deposit
+ 350:         // If we attempt to deposit at a half-season (a grown stalk index that would fall between seasons),

- 354:         //calculate stem index we need to deposit at from grownStalk and bdv
+ 354:         // then in affect we lose that partial season's worth of stalk when we deposit.

- 355:         //if we attempt to deposit at a half-season (a grown stalk index that would fall between seasons)
+ 355:         // So here we need to update grownStalk to be the amount you'd have with the above deposit.

- 356:         //then in affect we lose that partial season's worth of stalk when we deposit
+ 356:         /// @dev the two functions were combined into one function to save gas.

- 357:         //so here we need to update grownStalk to be the amount you'd have with the above deposit
+ 357:         // _stemTip = LibTokenSilo.grownStalkAndBdvToStem(IERC20(token), grownStalk, bdv);

- 359:         /// @dev the two functions were combined into one function to save gas.
+ 359:         // grownStalk = uint256(LibTokenSilo.calculateStalkFromStemAndBdv(IERC20(token), _stemTip, bdv));

360:         // _stemTip = LibTokenSilo.grownStalkAndBdvToStem(IERC20(token), grownStalk, bdv);

361:         // grownStalk = uint256(LibTokenSilo.calculateStalkFromStemAndBdv(IERC20(token), _stemTip, bdv));

```

```diff
File: beanstalk/silo/MigrationFacet.sol

- 51:         //had to break up the migration function into two parts to avoid stack too deep errors
+ 51:         //had to break up the migration function into two parts to avoid stack too deep error

```

```diff
File: beanstalk/silo/SiloFacet/Silo.sol

- 97:         // Need to Mow for `account` before we calculate the balance of
+ 97:         // Need to Mow for `account` before we calculate the balance of Earned Beans.

- 98:         // Earned Beans.
+ 98:         // Per the zero withdraw update, planting is handled differently depending on whether or not the user plants during the vesting period of beanstalk.

- 100:         // per the zero withdraw update, planting is handled differently
+ 100:         // During the vesting period, the earned beans are not issued to the user.

- 101:         // depending whether or not the user plants during the vesting period of beanstalk.
+ 101:         // Thus, the roots calculated for a given user is different.

- 102:         // during the vesting period, the earned beans are not issued to the user.
+ 102:         // This is handled by the super mow function, which stores the difference in roots in deltaRoots.

- 103:         // thus, the roots calculated for a given user is different.
+ 103:         // Calculate balance of Earned Beans.

- 104:         // This is handled by the super mow function, which stores the difference in roots.
+ 104:         s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give an invalid amount of beans.

- 108:         // Calculate balance of Earned Beans.
+ 108:         // Reduce the Silo's supply of Earned Beans.

- 110:         s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give a invalid amount of beans.
+ 110:         // SafeCast unnecessary because beans is <= s.earnedBeans.

- 113:         // Reduce the Silo's supply of Earned Beans.
+ 113:         // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.

- 114:         // SafeCast unnecessary because beans is <= s.earnedBeans.
+ 114:             beans, // amount

- 117:         // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.
+ 117:             beans, // bdv

- 122:             beans, // amount
+ 122:         s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give an invalid amount of beans.

- 123:             beans, // bdv
+ 123:         // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).

- 126:         s.a[account].deltaRoots = 0; // must be 0'd, as calling balanceOfEarnedBeans would give a invalid amount of beans.
+ 126:         // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.

- 128:         // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).
+ 128:         // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.

- 129:         // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.
+ 129:         // The following lines allocate Earned Stalk that has already been minted to `account`.

- 130:         // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.
+ 130:         // Constant is used here rather than s.ss[BEAN].stalkIssuedPerBdv

- 131:         // The following lines allocate Earned Stalk that has already been minted to `account`.
+ 131:         // for gas savings.

- 132:         // Constant is used here rather than s.ss[BEAN].stalkIssuedPerBdv
+ 132:     //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

- 133:         // for gas savings.
+ 133:         // Plenty is earned in the form of 3Crv.

142:     //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

150:         // Plenty is earned in the form of 3Crv.

```

```diff
File: beanstalk/silo/SiloFacet/SiloExit.sol

- 38:         // The Season that it started Raining, if it was Raining during the last
+ 38:         // The Season that it started Raining, if it was Raining during the last Season in which `account` updated their Silo. Otherwise, 0.

- 39:         // Season in which `account` updated their Silo. Otherwise, 0.
+ 39:         // The last Season of Plenty starting Season processed for `account`.

- 41:         // The last Season of Plenty starting Season processed for `account`.
+ 41:         // `account` balance of Roots when it started raining.

- 43:         // `account` balance of Roots when it started raining.
+ 43:         // The global Plenty per Root at the last Season in which `account` updated their Silo.

- 45:         // The global Plenty per Root at the last Season in which `account`
+ 45:         // `account` balance of unclaimed Bean:3Crv from Seasons of Plenty.

- 46:         // updated their Silo.
+ 46:     //////////////////////// UTILTIES ////////////////////////

- 48:         // `account` balance of unclaimed Bean:3Crv from Seasons of Plenty.
+ 48:     //////////////////////// SILO: TOTALS ////////////////////////

- 52:     //////////////////////// UTILTIES ////////////////////////
+ 52:     //////////////////////// SILO: ACCOUNT BALANCES ////////////////////////

- 61:     //////////////////////// SILO: TOTALS ////////////////////////
+ 61:      * [ROOT ERC-20 token](https://roottoken.org/).

- 87:     //////////////////////// SILO: ACCOUNT BALANCES ////////////////////////
+ 87:                 s.a[account].mowStatuses[token].lastStem, //last stem farmer mowed

- 103:      * [ROOT ERC-20 token](https://roottoken.org/).
+ 103:                 LibTokenSilo.stemTipForToken(token), //get latest stem for this token

- 132:                 s.a[account].mowStatuses[token].lastStem, //last stem farmer mowed
+ 132:         // There will be no Roots before the first Deposit is made.

- 133:                 LibTokenSilo.stemTipForToken(token), //get latest stem for this token
+ 133:                 .mul(s.a[account].roots.add(s.a[account].deltaRoots)) // add the delta roots of the user

- 183:         // There will be no Roots before the first Deposit is made.
+ 183:                 .div(s.s.roots.add(s.vestingPeriodRoots)); // add delta of global roots

- 189:                 .mul(s.a[account].roots.add(s.a[account].deltaRoots)) // add the delta roots of the user
+ 189:         // Beanstalk rounds down when minting Roots. Thus, it is possible that

- 190:                 .div(s.s.roots.add(s.vestingPeriodRoots)); // add delta of global roots
+ 190:         // balanceOfRoots / totalRoots * totalStalk < s.a[account].s.stalk.

- 197:         // Beanstalk rounds down when minting Roots. Thus, it is possible that
+ 197:         // As `account` Earned Balance balance should never be negative, Beanstalk returns 0 instead.

- 198:         // balanceOfRoots / totalRoots * totalStalk < s.a[account].s.stalk.
+ 198:         // Calculate Earned Stalk and convert to Earned Beans.

- 199:         // As `account` Earned Balance balance should never be negative,
+ 199:         beans = (stalk - accountStalk).div(C.STALK_PER_BEAN); // Note: SafeMath is redundant here.

- 200:         // Beanstalk returns 0 instead.
+ 200:     //////////////////////// SEASON OF PLENTY ////////////////////////

- 203:         // Calculate Earned Stalk and convert to Earned Beans.
+ 203:     //////////////////////// STEM ////////////////////////

- 204:         beans = (stalk - accountStalk).div(C.STALK_PER_BEAN); // Note: SafeMath is redundant here.
+ 204:     //////////////////////// INTERNAL ////////////////////////

224:     //////////////////////// SEASON OF PLENTY ////////////////////////

271:     //////////////////////// STEM ////////////////////////

342:     //////////////////////// INTERNAL ////////////////////////

```

```diff
File: beanstalk/silo/SiloFacet/SiloFacet.sol

- 265:     //////////////////////// YIELD DISTRUBUTION ////////////////////////
+ 265:     //////////////////////// YIELD DISTRIBUTION ////////////////////////

- 275:     //function to mow multiple tokens given an address
+ 275:     //function to move multiple tokens given an address

```

```diff
File: beanstalk/silo/SiloFacet/TokenSilo.sol

- 252:         // we return the total tokens removed from the deposits,
+ 252:         // We return the total tokens removed from the deposits,

```

```diff
File: beanstalk/sun/SeasonFacet/Sun.sol

- 197:         // This is used in _balanceOfEarnedBeans() to linearly distrubute
+ 197:         // This is used in _balanceOfEarnedBeans() to linearly distribute

```

```diff
File: beanstalk/sun/SeasonFacet/Weather.sol

- 121:         // `s.w.thisSowTime` is set to the number of seconds in it took for
+ 121:         // `s.w.thisSowTime` is set to the number of seconds it took for

- 126:                 s.w.lastSowTime == type(uint32).max || // Didn't Sow all last Season
+ 126:                 s.w.lastSowTime == type(uint32).max || // Didn't sow all last Season

- 127:                 s.w.thisSowTime < SOW_TIME_DEMAND_INCR || // Sow'd all instantly this Season
+ 127:                 s.w.thisSowTime < SOW_TIME_DEMAND_INCR || // Sowed all instantly this Season

- 129:                     s.w.thisSowTime < s.w.lastSowTime.sub(SOW_TIME_STEADY)) // Sow'd all faster
+ 129:                     s.w.thisSowTime < s.w.lastSowTime.sub(SOW_TIME_STEADY)) // Sowed all faster

- 135:                 // Sow'd all in same time
+ 135:                 // Sowed all in same time

- 150:                 deltaPodDemand = Decimal.zero(); // If no one sow'd
+ 150:                 deltaPodDemand = Decimal.zero(); // If no one sowed

- 152:                 deltaPodDemand = Decimal.from(1e18); // If no one sow'd last Season
+ 152:                 deltaPodDemand = Decimal.from(1e18); // If no one sowed last Season

```

```diff
File: ecosystem/price/CurvePrice.sol

- 87:                 D_P = D_P * D / (xp[_j] * N_COINS);  // If division by 0, this will be borked: only withdrawal will work. And that is good
+ 87:                 D_P = D_P * D / (xp[_j] * N_COINS);  // If division by 0, this will be broken: only withdrawal will work. And that is good

- 96:         // if it does happen the pool is borked and LPs can withdraw via `remove_liquidity`
+ 96:         // if it does happen the pool is broken and LPs can withdraw via `remove_liquidity`

```

```diff
File: ecosystem/root/Root.sol

- 87: //     /// @return ownerCandidate The nomindated candidate to become the new owner of the contract
+ 87: //     /// @return ownerCandidate The nominated candidate to become the new owner of the contract

- 108: //     /// @dev Not possible with this smart contract
+ 108: //     /// @dev Not possible with this contract

- 141: //     /// @param token Silo token to be add to the whitelist
+ 141: //     /// @param token Silo token to be added to the whitelist

- 149: //     /// @param token Silo token to be remove from the whitelist
+ 149: //     /// @param token Silo token to be removed from the whitelist

- 330: //     /// @param depositTransfers silo deposit(s) receive
+ 330: //     /// @param depositTransfers silo deposit(s) to receive

- 336: //     /// @param v permit signature
+ 336: //     /// @param v Permit signature

- 337: //     /// @param r permit signature
+ 337: //     /// @param r Permit signature

- 338: //     /// @param s permit signature
+ 338: //     /// @param s Permit signature

- 364: //     /// @param depositTransfers silo deposit(s) receive
+ 364: //     /// @param depositTransfers Silo deposit(s) receive

- 365: //     /// @param mode Burn ROOT token from
+ 365: //     /// @param mode Burn ROOT token from (internal or external)

- 445: //     /// @notice Transfer Silo Deposit(s) between user/ROOT contract and update
+ 445: //     /// @notice Transfer Silo Deposit(s) between user/ROOT contract and update shares

- 538: //     /// @notice Transfer silo deposit(s) between contract/user
+ 538: //     /// @notice Transfer silo deposit(s) between contract/user and return bdvs

```

```diff
File: interfaces/IBlockBasefee.sol

- 6:     // Returns the base fee of this block in wei
+ 6:     // Returns the base fee of this block in Wei

```

```diff
File: interfaces/IDiamondCut.sol

- 5: * Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
+ 5:     /// @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)

```

```diff
File: interfaces/IDiamondLoupe.sol

- 15:     /// @notice Gets all facet addresses and their four byte function selectors.
+ 15:     /// @notice Gets all facet addresses and their four-byte function selectors.

```

```diff
File: interfaces/IERC4494.sol

- 8: /// Implementation from https://eips.ethereum.org/EIPS/eip-4494
+ 8: /// Implementation from https://eips.ethereum.org/EIPS/eip-721

- 14:   /// _INTERFACE_ID_ERC4494 = 0x5604e225
+ 14:   /// _INTERFACE_ID_ERC721 = 0x5604e225

- 22:   /// @notice Returns the nonce of an NFT - useful for creating permits
+ 22:   /// @notice Returns the nonce of an NFT, useful for creating permits

```

```diff
File: interfaces/IPipeline.sol

- 14: // Pipeline supports 2 types of PipeCalls: PipeCall and AdvancedPipeCall.
+ 14: // Pipeline supports 2 types of PipeCalls: PipeCall and AdvancedPipeCall. PipeCall makes a function call with a static target address and callData. AdvancedPipeCall makes a function call with a static target address and both static and dynamic callData. AdvancedPipeCalls support sending Ether in calls.

- 16: // PipeCall makes a function call with a static target address and callData.
+ 16: // [ PipeCall Type | Send Ether Flag | PipeCall Type data | Ether Value (only if flag == 1) ]

- 22: // AdvancedPipeCall makes a function call with a static target address and both static and dynamic callData.
+ 22: // [ 1 byte        | 1 byte          | n bytes            | 0 or 32 bytes                  ]

- 23: // AdvancedPipeCalls support sending Ether in calls.
+ 23: // See LibFunction.useClipboard for more details on the format.

24: // [ PipeCall Type | Send Ether Flag | PipeCall Type data | Ether Value (only if flag == 1)]

25: // [ 1 byte        | 1 byte          | n bytes        | 0 or 32 bytes                      ]

26: // See LibFunction.useClipboard for more details.

```

```diff
File: interfaces/ISwapRouter.sol

- 5: /// @title Router token swapping functionality
+ 5: /// @title Router token swap functionality

- 6: /// @notice Functions for swapping tokens via Uniswap V3
+ 6: /// @notice Functions for swapping tokens via Uniswap V2

```

```diff
File: libraries/Convert/LibConvert.sol

- 62:         /// BEAN:3CRV LP -> BEAN
+ 62:         /// BEAN:3CRV LP -> BEAN:3CRV LP

- 66:         /// BEAN -> BEAN:3CRV LP
+ 66:         /// BEAN -> BEAN

- 70:         /// urBEAN:3CRV LP -> urBEAN
+ 70:         /// urBEAN:3CRV LP -> urBEAN:3CRV LP

- 74:         /// urBEAN -> urBEAN:3CRV LP
+ 74:         /// urBEAN -> urBEAN

- 78:         // Lambda -> Lambda
+ 78:         // Lambda -> Lambda:3CRV LP

- 90:         /// BEAN:3CRV LP -> BEAN
+ 90:         /// BEAN:3CRV LP -> BEAN:3CRV LP

- 94:         /// BEAN -> BEAN:3CRV LP
+ 94:         /// BEAN -> BEAN

- 98:         /// urBEAN:3CRV LP -> urBEAN
+ 98:         /// urBEAN:3CRV LP -> urBEAN:3CRV LP

- 102:         /// urBEAN -> urBEAN:3CRV LP
+ 102:         /// urBEAN -> urBEAN

- 106:         // Lambda -> Lambda
+ 106:         // Lambda -> Lambda:3CRV LP

```

```diff
File: libraries/Convert/LibConvertData.sol

- 20:     /// @notice Decoder for the Convert Enum
+ 20:     /// @notice Decoder for the Convert enum

- 29:     /// @notice Decoder for the addLPInBeans Convert
+ 29:     /// @notice Decoder for the addLPInBeans convert

- 41:     /// @notice Decoder for the addLPInBeans Convert
+ 41:     /// @notice Decoder for the addLPInBeans convert

```

```diff
File: libraries/Convert/LibMetaCurveConvert.sol

- 48:     //////////////////// INTERNAL ////////////////////
+ 48:     //////////////////// INTERNAL /////////////////////

```

```diff
File: libraries/Curve/LibBeanMetaCurve.sol

- 19:     uint256 private constant RATE_MULTIPLIER = 1e12; // Bean has 6 Decimals => 1e(18 - delta decimals)
+ 19:     uint256 private constant RATE_MULTIPLIER = 1e12; // Bean has 6 Decimals => 1e(18 - 6)

- 32:         // By using previous balances and the virtual price, we protect against flash loan
+ 32:         // By using previous balances and the virtual price, we protect against flash loans

```

```diff
File: libraries/LibAppStorage.sol

- 6: // Import all of AppStorage to give importers of LibAppStorage access to {Account}, etc.
+ 6: // Import all of AppStorage to give importers of File access to {Account}, etc.

```

```diff
File: libraries/LibBytes64.sol

- 30:         // Encoding takes 3 bytes chunks of binary data from `bytes` data parameter
+ 30:         // Encoding takes 3 bytes chunks of binary data from `bytes` data parameter,

- 31:         // and split into 4 numbers of 6 bits.
+ 31:         // and splits them into 4 numbers of 6 bits.

- 58:                 // and apply logical AND with 0x3F which is the number of
+ 58:                 // and apply logical AND with 0x3F which is the number

```

```diff
File: libraries/LibDiamond.sol

- 30:         // maps function selector to the facet address and
+ 30:         // maps function selector to the facet address and the position of the selector in the facetFunctionSelectors.selectors array

- 31:         // the position of the selector in the facetFunctionSelectors.selectors array
+ 31:         // maps facet addresses to function selectors and facet addresses

- 33:         // maps facet addresses to function selectors
+ 33:         // Used to query if a contract implements an interface.

- 35:         // facet addresses
+ 35:         // Used to implement ERC-165.

- 37:         // Used to query if a contract implements an interface.
+ 37:         // owner of the contract can only call this function

- 38:         // Used to implement ERC-165.
+ 38:     // Internal function version of diamondCut

- 40:         // owner of the contract
+ 40:         // add new facet address if it does not exist, add new function selector if it does not exist

- 98:     // Internal function version of diamondCut
+ 98:         // if function selector does not exist then do nothing and return

- 125:         // add new facet address if it does not exist
+ 125:         // an immutable function is a function defined directly in a diamond

- 143:         // add new facet address if it does not exist
+ 143:         // replace function selector with last function selector, then delete last function selector

- 160:         // if function does not exist then do nothing and return
+ 160:         // if not the same then replace function selector with last function selector

- 184:         // an immutable function is a function defined directly in a diamond
+ 184:         // delete the last function selector

- 186:         // replace selector with last selector, then delete last selector
+ 186:         // if no more function selectors for facet address then delete the facet address

- 189:         // if not the same then replace _selector with lastSelector
+ 189:             // replace facet address with last facet address and delete last facet address, bubble up the error

195:         // delete the last selector

199:         // if no more selectors for facet address then delete the facet address

201:             // replace facet address with last facet address and delete last facet address

225:                     // bubble up the error

```

```diff
File: libraries/LibDibbler.sol

- 24:     /// @dev Morning Auction scales temperature by 1e6.
+ 24:     /// @dev Morning Auction scales temperature by 1e8.

- 28:     /// `pods = beans * (1 + temperature)`
+ 28:     /// `pods = beans * (1 + temperature / 1e8)`

- 29:     /// `pods = beans * (100% + temperature) / 100%`
+ 29:     /// `pods = beans * (100% + temperature / 1e8) / 100%`

```

```diff
File: libraries/LibFertilizer.sol

- 49:         // Add underlying to Unripe Beans and Unripe LP
+ 49:         // Add underlying to Unripe Beans and Unripe LP balances

- 100:         // Increment underlying balances of Unripe Tokens
+ 100:         // Increment underlying balances of Unripe Beans and Unripe LP

```

```diff
File: libraries/LibFunction.sol

- 112:         // Shift `pasteParams` right 22 bytes to insolated reduceDataIndex
+ 112:         // Shift `pasteParams` right 22 bytes to isolate reduceDataIndex

```

```diff
File: libraries/LibIncentive.sol

- 40:     /// @dev Accounts for extra gas overhead for completing a Sunrise tranasaction.
+ 40:     /// @dev Accounts for extra gas overhead for completing a Sunrise transaction.

- 44:     /// @dev Use external contract for block.basefee as to avoid upgrading existing contracts to solidity v8
+ 44:     /// @dev Use external contract for block.basefee to avoid upgrading existing contracts to solidity v8

```

```diff
File: libraries/LibPRBMath.sol

- 191:             // use the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256
+ 191:             // the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256

- 224:             // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 1.
+ 224:             // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 2.

```

```diff
File: libraries/LibPolynomial.sol

- 109:         uint256 start, //start of breakpoint is assumed to be subtracted
+ 109:         uint256 start, //start of breakpoint is assumed to be subtracted from

- 110:         uint256 end //start of breakpoint is assumed to be subtracted
+ 110:         uint256 end //start of breakpoint is assumed to be subtracted from

```

```diff
File: libraries/LibSafeMath128.sol

- 37:         // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
+ 37:         // Gas optimization: this is cheaper than requiring 'a' not to be zero, but the

```

```diff
File: libraries/LibSafeMath32.sol

- 37:         // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
+ 37:         // Gas optimization: this is cheaper than requiring 'a' not to be zero, but the

```

```diff
File: libraries/LibSafeMathSigned128.sol

- 23:         // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
+ 23:         // Gas optimization: this is cheaper than requiring 'a' not to be zero, but the

```

```diff
File: libraries/LibSafeMathSigned96.sol

- 23:         // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
+ 23:         // Gas optimization: this is cheaper than requiring 'a' not to be zero, but the

```

```diff
File: libraries/Oracle/LibCurveOracle.sol

- 76:             // Since the oracle was just initialized, it is not possible to compute the TWA balances over the Season.
+ 76:             // Since the oracle was just initialized, it is not possible to compute the TWA balances over the season.

```

```diff
File: libraries/Silo/LibLegacyWhitelist.sol

- 51:         s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk"
+ 51:         s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv; //previously just called "stalk" in the code

- 52:         s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds"
+ 52:         s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason; //previously called "seeds" in the code

```

```diff
File: libraries/Silo/LibSiloPermit.sol

- 21:  * https://github.com/BeanstalkFarms/Beanstalk/blob/d2a9a232f50e1d474d976a2e29488b70c8d19461/protocol/utils/permit.js
+ 21: // https://github.com/BeanstalkFarms/Beanstalk/blob/d2a9a232f50e1d474d976a2e29488b70c8d19461/protocol/utils/permit.js

- 24:  * `permit`: https://github.com/BeanstalkFarms/Beanstalk-SDK/blob/df2684aee67241acdb89379d4d0c19322339436c/packages/sdk/src/lib/silo.ts#L657
+ 24: // `permit`: https://github.com/BeanstalkFarms/Beanstalk-SDK/blob/df2684aee67241acdb89379d4d0c19322339436c/packages/sdk/src/lib/silo.ts#L657

- 25:  * `permits`: https://github.com/BeanstalkFarms/Beanstalk-SDK/blob/df2684aee67241acdb89379d4d0c19322339436c/packages/sdk/src/lib/silo.ts#L698
+ 25: // `permits`: https://github.com/BeanstalkFarms/Beanstalk-SDK/blob/df2684aee67241acdb89379d4d0c19322339436c/packages/sdk/src/lib/silo.ts#L698

- 172:      * https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct
+ 172: // https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct

```

```diff
File: libraries/Silo/LibUnripeSilo.sol

- 192:         // Summate the amount acrosses all 4 potential Unripe BEAN:3CRV storage locations.
+ 192:         // Summate the amount across all 4 potential Unripe BEAN:3CRV storage locations.

- 197:         // Summate the BDV acrosses all 3 pre-exploit LP Silo Deposit storages
+ 197:         // Summate the BDV across all 3 pre-exploit LP Silo Deposit storages

```

```diff
File: libraries/Token/LibTokenPermit.sol

- 72:      * @dev Given an already https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct[hashed struct], this
+ 72:      * @dev Given an already https://eips.ethereum.org/EIPS/eip-712#definition-of-hashstruct[hashed struct], this function

```

```diff
File: libraries/Token/LibTransfer.sol

- 91:         // burnToken only can be called with Unripe Bean, Unripe Bean:3Crv or Bean token, which are all Beanstalk tokens.
+ 91:         // burnToken can only be called with Unripe Bean, Unripe Bean:3Crv or Bean token, which are all Beanstalk tokens.

```

```diff
File: mocks/MockDiamond.sol

- 6: * Authors: Nick Mudge (https://twitter.com/mudgen)
+ 6: // Authors: Nick Mudge (https://twitter.com/mudgen)

```

```diff
File: mocks/MockERC721.sol

- 7: /// @title MockERC721
+ 7: /// @title MockERC721.sol

```

```diff
File: mocks/MockInitDiamond.sol

- 32:         // Dsc, Sdy, Inc, nul
+ 32:         // Dsc, Sdy, Inc, Nul

- 47:         // s.refundStatus = 1;
+ 47:         // s.refundStatus = 1; // 0: No refund, 1: Refund

- 48:         // s.beanRefundAmount = 1;
+ 48:         // s.beanRefundAmount = 1; // Amount of beans to refund

- 49:         // s.ethRefundAmount = 1;
+ 49:         // s.ethRefundAmount = 1; // Amount of ether to refund

```

```diff
File: mocks/curve/MockPlainCurve.sol

- 222:         // Solve Eqn against y_i for D - _token_amount
+ 222:         // Solve Eqn against y_i for D - _burn_amount

```

```diff
File: mocks/mockFacets/MockMarketplaceFacet.sol

- 10: // import "../../libraries/LibPolynomial.sol";
+ 10: // import "../../libraries/LibPolynomials.sol";

```

```diff
File: mocks/mockFacets/MockSiloFacet.sol

- 120:         // If no roots, reset Sop counters variables
+ 120:         // If no roots, reset Sop counter variables

- 138:             // save plentyPerRoot in case another SOP happens during rain.
+ 138:             // save plentyPerRoot in case another Sop happens during rain.

```

```diff
File: mocks/uniswap/MockUniswapV3Deployer.sol

- 25:     /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
+ 25:     /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bips

```

```diff
File: mocks/uniswap/MockUniswapV3Factory.sol

- 48:         // populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses
+ 48:         // Populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses

- 64:         // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
+ 64:         // Tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that

```

```diff
File: mocks/uniswap/NoDelegateCall.sol

- 11:         // Immutables are computed in the init code of the contract, and then inlined into the deployed bytecode.
+ 11:         // Immutables are computed in the init code of the contract and then inlined into the deployed bytecode.

- 16:     /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,
+ 16:     /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method

```

```diff
File: tokens/ERC20/BeanstalkERC20.sol

- 26: contract BeanstalkERC20 is ERC20Permit, ERC20Burnable, AccessControl { // removed Context,
+ 26: contract BeanstalkERC20 is ERC20Permit, ERC20Burnable, AccessControl { // removed Context

```

```diff
File: tokens/Fertilizer/Fertilizer.sol

- 56:         uint256[] memory, // amounts
+ 56:         uint256[] memory, // amount

```

```diff
File: tokens/Fertilizer/Fertilizer1155.sol

- 96:     // The 3 functions below are copied from:
+ 96:     // The 3 functions below are copied from

```

```diff
File: tokens/Fertilizer/FertilizerPreMint.sol

- 49:     // Note: Slippage should be properly be accounted for in
+ 49:     // Note: Slippage should be properly accounted for in

```

## Low Issues

|             | Issue                                                                                                                       | Instances |
| ----------- | :-------------------------------------------------------------------------------------------------------------------------- | :-------: |
| [L-1](#L-1) | `abi.encodePacked()` should not be used with dynamic types when passing the result to a hash function such as `keccak256()` |    11     |
| [L-2](#L-2) | Do not use deprecated library functions                                                                                     |     4     |
| [L-3](#L-3) | Empty Function Body - Consider commenting why                                                                               |    10     |
| [L-4](#L-4) | Initializers could be front-run                                                                                             |    53     |
| [L-5](#L-5) | Unsafe ERC20 operation(s)                                                                                                   |    30     |
| [L-6](#L-6) | Unspecific compiler version pragma                                                                                          |     8     |

### <a name="L-1"></a>[L-1] `abi.encodePacked()` should not be used with dynamic types when passing the result to a hash function such as `keccak256()`

Use `abi.encode()` instead which will pad items to 32 bytes, which will [prevent hash collisions](https://docs.soliditylang.org/en/v0.8.13/abi-spec.html#non-standard-packed-mode) (e.g. `abi.encodePacked(0x123,0x456)` => `0x123456` => `abi.encodePacked(0x1,0x23456)`, but `abi.encode(0x123,0x456)` => `0x0...1230...456`). "Unless there is a compelling reason, `abi.encode` should be preferred". If there is only one argument to `abi.encodePacked()` it can often be cast to `bytes()` or `bytes32()` [instead](https://ethereum.stackexchange.com/questions/30912/how-to-compare-strings-in-solidity#answer-82739).
If all arguments are strings and or bytes, `bytes.concat()` should be used instead

_Instances (11)_:

```solidity
File: beanstalk/barn/UnripeFacet.sol

85:         bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));

```

```solidity
File: beanstalk/market/MarketplaceFacet/Listing.sol

279:         if(minFillAmount > 0) lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  minFillAmount, mode == LibTransfer.To.EXTERNAL));

280:         else lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex,  mode == LibTransfer.To.EXTERNAL));

293:         lHash = keccak256(abi.encodePacked(start, amount, pricePerPod, maxHarvestableIndex, minFillAmount, mode == LibTransfer.To.EXTERNAL, pricingFunction));

```

```solidity
File: beanstalk/market/MarketplaceFacet/Order.sol

209:         if(minFillAmount > 0) id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount));

210:         else id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine));

221:         id = keccak256(abi.encodePacked(account, pricePerPod, maxPlaceInLine, minFillAmount, pricingFunction));

```

```solidity
File: libraries/Silo/LibSiloPermit.sol

109:                 keccak256(abi.encodePacked(tokens)),

110:                 keccak256(abi.encodePacked(values)),

187:         return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));

```

```solidity
File: libraries/Token/LibTokenPermit.sol

87:         return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));

```

### <a name="L-2"></a>[L-2] Do not use deprecated library functions

_Instances (4)_:

```solidity
File: libraries/Token/LibApprove.sol

25:         token.safeApprove(spender, 0);

26:         token.safeApprove(spender, amount);

```

```solidity
File: tokens/ERC20/BeanstalkERC20.sol

38:         _setupRole(DEFAULT_ADMIN_ROLE, admin);

39:         _setupRole(MINTER_ROLE, admin);

```

### <a name="L-3"></a>[L-3] Empty Function Body - Consider commenting why

_Instances (10)_:

```solidity
File: beanstalk/Diamond.sol

23:     receive() external payable {}

```

```solidity
File: mocks/MockDiamond.sol

22:     receive() external payable {}

```

```solidity
File: mocks/MockERC1155.sol

9:     constructor (string memory name) ERC1155(name) {}

```

```solidity
File: mocks/MockSiloToken.sol

21:     { }

```

```solidity
File: mocks/MockToken.sol

23:     { }

```

```solidity
File: mocks/MockWETH.sol

15:     constructor() MockToken("Wrapped Ether", "WETH") { }

```

```solidity
File: tokens/Bean.sol

18:     { }

```

```solidity
File: tokens/ERC20/ERC20Permit.sol

39:     constructor(string memory name) EIP712(name, "1") {}

```

```solidity
File: tokens/UnripeBean.sol

18:     { }

```

```solidity
File: tokens/UnripeBean3Crv.sol

18:     { }

```

### <a name="L-4"></a>[L-4] Initializers could be front-run

Initializers could be front-run, allowing an attacker to either set their own values, take ownership of the contract, and in the best case forcing a re-deployment

_Instances (53)_:

```solidity
File: beanstalk/init/InitBip0.sol

29:     function init() external {

```

```solidity
File: beanstalk/init/InitBip1.sol

22:     function init() external {

```

```solidity
File: beanstalk/init/InitBip11.sol

28:     function init() external {

```

```solidity
File: beanstalk/init/InitBip12.sol

29:     function init() external {

```

```solidity
File: beanstalk/init/InitBip13.sol

18:     function init() external {

```

```solidity
File: beanstalk/init/InitBip14.sol

22:     function init() external {

```

```solidity
File: beanstalk/init/InitBip16.sol

29:     function init() external {

```

```solidity
File: beanstalk/init/InitBip2.sol

18:     function init() external {

```

```solidity
File: beanstalk/init/InitBip22.sol

20:     function init() external {

```

```solidity
File: beanstalk/init/InitBip23.sol

20:     function init() external {

```

```solidity
File: beanstalk/init/InitBip24.sol

19:     function init() external {

```

```solidity
File: beanstalk/init/InitBip5.sol

24:     function init() external {

```

```solidity
File: beanstalk/init/InitBip7.sol

20:     function init() external {

```

```solidity
File: beanstalk/init/InitBip8.sol

26:     function init() external {

```

```solidity
File: beanstalk/init/InitBip9.sol

26:     function init() external {

```

```solidity
File: beanstalk/init/InitBipNewSilo.sol

33:     function init() external {

```

```solidity
File: beanstalk/init/InitBipSunriseImprovements.sol

35:     function init() external {

```

```solidity
File: beanstalk/init/InitDiamond.sol

31:     function init() external {

```

```solidity
File: beanstalk/init/InitEBip6.sol

17:     function init() external {

```

```solidity
File: beanstalk/init/InitEmpty.sol

14:     function init() external {

```

```solidity
File: beanstalk/init/InitFundraiser.sol

21:     function init(address fundraiser, address token, uint256 amount) external {

```

```solidity
File: beanstalk/init/InitHotFix2.sol

18:     function init() external {

```

```solidity
File: beanstalk/init/InitHotFix3.sol

13:     function init() external {

```

```solidity
File: beanstalk/init/InitHotFix4.sol

20:     function init() external {

```

```solidity
File: beanstalk/init/InitHotFix5.sol

28:     function init() external {

```

```solidity
File: beanstalk/init/InitMint.sol

15:     function init(address payee, uint256 amount) external {

```

```solidity
File: beanstalk/init/InitOmnisciaAudit.sol

17:     function init() external {

```

```solidity
File: beanstalk/init/InitReplant.sol

21:     function init(address fertilizerImplementation) external {

```

```solidity
File: beanstalk/init/InitSiloEvents.sol

36:     function init(SiloEvents[] memory siloEvents) external {

```

```solidity
File: beanstalk/init/InitSiloToken.sol

18:     function init(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {

```

```solidity
File: beanstalk/init/replant/Replant1.sol

84:     function init() external {

```

```solidity
File: beanstalk/init/replant/Replant3.sol

53:     function init(

```

```solidity
File: beanstalk/init/replant/Replant4.sol

39:     function init(

```

```solidity
File: beanstalk/init/replant/Replant5.sol

44:     function init(V1Deposit[] calldata beanDeposits) external {

```

```solidity
File: beanstalk/init/replant/Replant6.sol

66:     function init(Deposit[] calldata ds) external {

```

```solidity
File: beanstalk/init/replant/Replant7.sol

49:     function init(Earned[] calldata earned) external {

```

```solidity
File: beanstalk/init/replant/Replant8.sol

77:     function init() external {

```

```solidity
File: mocks/MockFertilizer.sol

16:     function initialize() public initializer {

16:     function initialize() public initializer {

17:         __Internallize_init("");

```

```solidity
File: mocks/MockInitDiamond.sol

25:     function init() external {

```

```solidity
File: mocks/MockUpgradeInitDiamond.sol

14:     function init() public {

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

71:     function init(address _token, address _token2, address base_pool) external {

```

```solidity
File: mocks/curve/MockPlainCurve.sol

54:     function init(address _token, address _token2) external {

```

```solidity
File: mocks/uniswap/MockUniswapV3Pool.sol

280:     function initialize(uint160 sqrtPriceX96) external override {

285:         (uint16 cardinality, uint16 cardinalityNext) = observations.initialize(_blockTimestamp());

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

37:     function initialize(string memory _uri) public initializer {

37:     function initialize(string memory _uri) public initializer {

39:         __Internallize_init(_uri);

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

31:     function __Internallize_init(string memory uri_) internal {

32:         __Ownable_init();

33:         __ERC1155_init(uri_);

34:         __ReentrancyGuard_init();

```

### <a name="L-5"></a>[L-5] Unsafe ERC20 operation(s)

_Instances (30)_:

```solidity
File: beanstalk/barn/FertilizerFacet.sol

67:         C.usdc().transferFrom(

```

```solidity
File: beanstalk/farm/TokenFacet.sol

109:         LibTokenApprove.approve(msg.sender, spender, token, amount);

120:         LibTokenApprove.approve(

147:         LibTokenApprove.approve(

183:         LibTokenApprove.approve(owner, spender, IERC20(token), value);

```

```solidity
File: beanstalk/init/InitDiamond.sol

38:         C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

39:         C.bean().approve(C.curveZapAddress(), type(uint256).max);

40:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

```

```solidity
File: beanstalk/init/replant/Replant8.sol

83:         bean.approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

84:         bean.approve(C.curveZapAddress(), type(uint256).max);

85:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

86:         C.usdc().transferFrom(msg.sender, address(this), INITIAL_LP);

94:         IERC20(metapool).transfer(msg.sender, newLP);

```

```solidity
File: mocks/MockInitDiamond.sol

27:         C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);

28:         C.bean().approve(C.curveZapAddress(), type(uint256).max);

29:         C.usdc().approve(C.curveZapAddress(), type(uint256).max);

```

```solidity
File: mocks/curve/MockCurveZap.sol

22:         IERC20(BEAN).approve(BEAN_METAPOOL, type(uint256).max);

23:         IERC20(THREE_CURVE).approve(BEAN_METAPOOL, type(uint256).max);

27:         IERC20(BEAN).transferFrom(msg.sender, address(this), depAmounts[0]);

28:         IERC20(USDC).transferFrom(msg.sender, THREE_POOL, depAmounts[2]);

```

```solidity
File: mocks/curve/MockMeta3Curve.sol

199:         ERC20(coins[i]).transferFrom(msg.sender, address(this), dx);

200:         ERC20(coins[j]).transfer(_receiver, dy);

256:                 IBean(coins[i]).transferFrom(msg.sender, address(this), amount);

286:             ERC20(coins[i]).transfer(_receiver, value);

347:                 ERC20(coins[i]).transfer(_receiver, amount);

381:         IBean(coins[i]).transfer(_receiver, dy);

```

```solidity
File: mocks/curve/MockPlainCurve.sol

185:                 IBean(coins[i]).transferFrom(msg.sender, address(this), amount);

214:         IBean(coins[i]).transfer(msg.sender, dy);

```

```solidity
File: tokens/Fertilizer/FertilizerPreMint.sol

38:         IERC20(WETH).approve(SWAP_ROUTER, type(uint256).max);

46:         IUSDC.transferFrom(msg.sender, CUSTODIAN, amount);

```

### <a name="L-6"></a>[L-6] Unspecific compiler version pragma

_Instances (8)_:

```solidity
File: interfaces/IERC1155Receiver.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: interfaces/IQuoter.sol

2: pragma solidity >=0.7.5;

```

```solidity
File: interfaces/ISwapRouter.sol

2: pragma solidity >=0.7.5;

```

```solidity
File: libraries/LibSafeMath128.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibSafeMath32.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibSafeMathSigned128.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibSafeMathSigned96.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

```solidity
File: libraries/LibStrings.sol

3: pragma solidity >=0.6.0 <0.8.0;

```

## Medium Issues

|             | Issue                                  | Instances |
| ----------- | :------------------------------------- | :-------: |
| [M-1](#M-1) | Centralization Risk for trusted owners |     6     |

### <a name="M-1"></a>[M-1] Centralization Risk for trusted owners

#### Impact:

Contracts have owners with privileged rights to perform admin tasks and need to be trusted to not perform malicious updates or drain funds.

_Instances (6)_:

```solidity
File: mocks/MockSiloToken.sol

15: contract MockSiloToken is Ownable, ERC20Burnable  {

23:     function mint(address account, uint256 amount) public onlyOwner returns (bool) {

```

```solidity
File: tokens/ERC20/BeanstalkERC20.sol

26: contract BeanstalkERC20 is ERC20Permit, ERC20Burnable, AccessControl { // removed Context,

```

```solidity
File: tokens/Fertilizer/Fertilizer.sol

32:     ) external onlyOwner returns (uint256) {

36:     function beanstalkMint(address account, uint256 id, uint128 amount, uint128 bpf) external onlyOwner {

```

```solidity
File: tokens/Fertilizer/Internalizer.sol

45:     function setURI(string calldata newuri) public onlyOwner {

```
