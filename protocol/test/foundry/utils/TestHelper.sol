/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import "forge-std/Test.sol";

////// Mocks //////
import {MockToken} from "contracts/mocks/MockToken.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {MockSeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";

///// TEST HELPERS //////
import {BeanstalkDeployer} from "test/foundry/utils/BeanstalkDeployer.sol";
import {BasinDeployer} from "test/foundry/utils/BasinDeployer.sol";
import {DepotDeployer} from "test/foundry/utils/DepotDeployer.sol";
import {OracleDeployer} from "test/foundry/utils/OracleDeployer.sol";
import {FertilizerDeployer} from "test/foundry/utils/FertilizerDeployer.sol";
import {ShipmentDeployer} from "test/foundry/utils/ShipmentDeployer.sol";
import {IWell, IERC20} from "contracts/interfaces/basin/IWell.sol";
import {C} from "contracts/C.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

///// COMMON IMPORTED LIBRARIES //////
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {LibArbitrum} from "contracts/libraries/LibArbitrum.sol";
///// ECOSYSTEM //////
import {Pipeline} from "contracts/pipeline/Pipeline.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract TestHelper is
    Test,
    BeanstalkDeployer,
    BasinDeployer,
    DepotDeployer,
    OracleDeployer,
    FertilizerDeployer,
    ShipmentDeployer
{
    Pipeline pipeline;

    MockToken bean = MockToken(BEAN);
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);

    // ideally, timestamp should be set to 1_000_000.
    // however, beanstalk rounds down to the nearest hour.
    // 1_000_000 / 3600 * 3600 = 997200.
    uint256 constant PERIOD = 3600;
    uint256 constant START_TIMESTAMP = 1_000_000;
    uint256 constant INITIAL_TIMESTAMP = (START_TIMESTAMP / PERIOD) * PERIOD;

    // The largest deposit that can occur on the first season.
    // Given the supply of beans should starts at 0,
    // this should never occur.
    uint256 constant MAX_DEPOSIT_BOUND = 1.7e16; // 2 ** 128 / 2e16

    struct initERC20params {
        address targetAddr;
        string name;
        string symbol;
        uint8 decimals;
    }

    /**
     * @notice initializes the state of the beanstalk contracts for testing.
     */
    function initializeBeanstalkTestState(bool mock, bool verbose) public {
        // general mock interface for beanstalk.
        bs = IMockFBeanstalk(BEANSTALK);

        // initialize misc contracts.
        initMisc();

        // sets block.timestamp to 1_000_000,
        // as starting from an timestamp of 0 can cause issues.
        vm.warp(INITIAL_TIMESTAMP);

        // initalize mock tokens.
        initMockTokens(verbose);

        // initialize Depot:
        initDepot(verbose);

        // initialize Basin, deploy wells.
        initBasin(mock, verbose);

        // initialize chainlink oracles (note by default mocks).
        initChainlink(verbose);

        // initialize uniswap pools.
        initUniswapPools(verbose);

        // deploy fertilizer contract, and transfer ownership to beanstalk.
        // note: does not initailize barn raise.
        initFertilizer(verbose);
        transferFertilizerOwnership(BEANSTALK);

        // initialize Diamond, initalize users:
        setupDiamond(mock, verbose);

        // Initialize Shipment Routes and Plans.
        initShipping(verbose);

        // initialize oracle configuration
        initWhitelistOracles(verbose);

        initMockArbitrumSys();
    }

    /**
     * @notice many of fertilizer functionality requires
     * unripe assets to exist.
     */
    function initializeUnripeTokens(
        address user,
        uint256 unripeBeanAmount,
        uint256 unripeLpAmount
    ) internal {
        // mint tokens to users.
        mintTokensToUser(user, UNRIPE_BEAN, unripeBeanAmount);
        mintTokensToUser(user, UNRIPE_LP, unripeLpAmount);
    }

    /**
     * @notice deploys a list of mock tokens.
     * @dev each token is deployed with the MockToken.sol contract,
     * which allows for arbitary minting for testing purposes.
     */
    function initMockTokens(bool verbose) internal {
        initERC20params[8] memory tokens = [
            initERC20params(BEAN, "Bean", "BEAN", 6),
            initERC20params(UNRIPE_BEAN, "Unripe Bean", "UrBEAN", 6),
            initERC20params(UNRIPE_LP, "Unripe LP", "UrBEAN3CRV", 18),
            initERC20params(WETH, "Weth", "WETH", 18),
            initERC20params(WSTETH, "wstETH", "WSTETH", 18),
            initERC20params(USDC, "USDC", "USDC", 6),
            initERC20params(USDT, "USDT", "USDT", 6),
            initERC20params(WBTC, "WBTC", "WBTC", 8)
        ];

        for (uint i; i < tokens.length; i++) {
            address token = tokens[i].targetAddr;
            string memory name = tokens[i].name;
            string memory symbol = tokens[i].symbol;
            uint256 decimals = tokens[i].decimals;

            string memory mock = "MockToken.sol";
            // unique ERC20s should be appended here.
            if (token == WETH) {
                mock = "MockWETH.sol";
            }
            deployCodeTo(mock, abi.encode(name, symbol), token);
            MockToken(token).setDecimals(decimals);
            if (verbose) console.log(name, "Deployed at:", token);
            vm.label(token, name);
        }
    }

    function initMockArbitrumSys() internal {
        deployCodeTo("MockArbitrumSys.sol", "", LibArbitrum.ARB_SYS_PRECOMPILE);
    }

    /**
     * @notice max approves bean for beanstalk.
     */
    function maxApproveBeanstalk(address[] memory users) public {
        for (uint i; i < users.length; i++) {
            vm.prank(users[i]);
            bean.approve(BEANSTALK, type(uint256).max);
        }
    }

    /**
     * @notice Mints tokens to a list of users.
     * @dev Max approves beanstalk to spend `token`.
     */
    function mintTokensToUsers(address[] memory users, address token, uint256 amount) internal {
        for (uint i; i < users.length; i++) {
            mintTokensToUser(users[i], token, amount);
        }
    }

    /**
     * @notice Mints tokens to a list of users.
     * @dev Max approves beanstalk to spend `token`.
     */
    function mintTokensToUser(address user, address token, uint256 amount) internal {
        MockToken(token).mint(user, amount);
        vm.prank(user);
        MockToken(token).approve(BEANSTALK, type(uint256).max);
    }

    function addLiquidityToWell(
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal returns (uint256) {
        return addLiquidityToWell(users[0], well, beanAmount, nonBeanTokenAmount);
    }

    /**
     * @notice assumes a CP2 well with bean as one of the tokens.
     */
    function addLiquidityToWell(
        address user,
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal returns (uint256 lpOut) {
        (address nonBeanToken, ) = bs.getNonBeanTokenAndIndexFromWell(well);

        if (runningOnFork()) {
            console.log("dealing tokens on fork");
            deal(address(BEAN), well, beanAmount, true);
            deal(address(nonBeanToken), well, nonBeanTokenAmount, true);
        } else {
            // mint and sync.
            MockToken(BEAN).mint(well, beanAmount);
            MockToken(nonBeanToken).mint(well, nonBeanTokenAmount);
        }

        lpOut = IWell(well).sync(user, 0);

        // sync again to update reserves.
        IWell(well).sync(user, 0);
    }

    function runningOnFork() public view returns (bool) {
        bool isForked;

        try vm.activeFork() returns (uint256) {
            isForked = true;
        } catch {
            isForked = false;
        }
        return isForked;
    }

    /**
     * @notice sets the reserves of a well by adding/removing liquidity.
     * @dev if the reserves decrease, manually remove liquidity.
     * if the reserves incerase, add token amounts and sync.
     */
    function setReserves(
        address well,
        uint256 beanAmount,
        uint256 nonBeanTokenAmount
    ) internal prank(users[0]) {
        uint256[] memory reserves = new uint256[](2);
        IERC20[] memory tokens = new IERC20[](2);
        tokens = IWell(well).tokens();
        reserves = IWell(well).getReserves();
        uint256 beanIndex = bs.getBeanIndex(tokens);
        uint256 tknIndex = beanIndex == 1 ? 0 : 1;

        uint256[] memory removedTokens = new uint256[](2);

        // calculate amount of tokens to remove.
        if (reserves[beanIndex] > beanAmount) {
            removedTokens[beanIndex] = reserves[beanIndex] - beanAmount;
        }

        if (reserves[tknIndex] > nonBeanTokenAmount) {
            removedTokens[tknIndex] = reserves[tknIndex] - nonBeanTokenAmount;
        }

        // liquidity is removed first.
        if (removedTokens[0] > 0 || removedTokens[1] > 0) {
            IWell(well).removeLiquidityImbalanced(
                type(uint256).max,
                removedTokens,
                users[0],
                type(uint256).max
            );
        }

        // mint amount to add to well, call sync.
        if (reserves[beanIndex] < beanAmount) {
            bean.mint(well, beanAmount - reserves[beanIndex]);
        }
        if (reserves[tknIndex] < nonBeanTokenAmount) {
            MockToken(address(tokens[tknIndex])).mint(
                well,
                nonBeanTokenAmount - reserves[tknIndex]
            );
        }

        IWell(well).sync(users[0], 0);
        IWell(well).sync(users[0], 0);
    }

    /**
     * @notice mints `amount` and deposits it to beanstalk.
     * @dev if 'token' is a well, 'amount' corresponds to the amount of non-bean tokens underlying the output amount.
     */
    function depositForUser(
        address user,
        address token,
        uint256 amount
    ) internal prank(user) returns (uint256 outputAmount) {
        address[] memory tokens = bs.getWhitelistedWellLpTokens();
        bool isWell;
        for (uint i; i < tokens.length; i++) {
            if (tokens[i] == token) {
                isWell = true;
                break;
            }
        }
        if (isWell) {
            (amount, ) = addLiquidityToWellAtCurrentPrice(user, token, amount);
        } else {
            MockToken(token).mint(user, amount);
        }
        outputAmount = amount;
        MockToken(token).approve(BEANSTALK, amount);
        bs.deposit(token, amount, 0);
    }

    /**
     * @notice adds an amount of non-bean tokens in the well,
     * and adds the amount of beans such that the well matches the price oracles.
     */
    function addLiquidityToWellAtCurrentPrice(
        address well,
        uint256 amount
    ) internal returns (uint256 lpAmountOut, address tokenInWell) {
        (lpAmountOut, tokenInWell) = addLiquidityToWellAtCurrentPrice(users[0], well, amount);
    }

    /**
     * @notice adds an amount of non-bean tokens in the well,
     * and adds the amount of beans such that the well matches the price oracles.
     */
    function addLiquidityToWellAtCurrentPrice(
        address user,
        address well,
        uint256 amount
    ) internal returns (uint256 lpAmountOut, address tokenInWell) {
        (tokenInWell, ) = bs.getNonBeanTokenAndIndexFromWell(well);
        uint256 beanAmount = (amount * 1e6) / bs.getUsdTokenPrice(tokenInWell);
        lpAmountOut = addLiquidityToWell(user, well, beanAmount, amount);
    }

    function initMisc() internal {
        pipeline = Pipeline(PIPELINE);
    }

    function abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    function initializeChainlinkOraclesForWhitelistedWells() internal noGasMetering {
        address[] memory lp = bs.getWhitelistedLpTokens();
        address chainlinkOracle;
        for (uint i; i < lp.length; i++) {
            // oracles will need to be added here,
            // as obtaining the chainlink oracle to well is not feasible on chain.
            if (lp[i] == BEAN_ETH_WELL) {
                chainlinkOracle = chainlinkOracles[0];
            } else if (lp[i] == BEAN_WSTETH_WELL) {
                chainlinkOracle = chainlinkOracles[1];
            }
            updateChainlinkOracleWithPreviousData(chainlinkOracle);
        }
    }

    function updateAllChainlinkOraclesWithPreviousData() internal {
        address[] memory lp = bs.getWhitelistedLpTokens();
        address chainlinkOracle;
        for (uint i; i < lp.length; i++) {
            // oracles will need to be added here,
            // as obtaining the chainlink oracle to well is not feasible on chain.
            if (lp[i] == BEAN_ETH_WELL) {
                chainlinkOracle = chainlinkOracles[0];
            } else if (lp[i] == BEAN_WSTETH_WELL) {
                chainlinkOracle = chainlinkOracles[1];
            }
            updateChainlinkOracleWithPreviousData(chainlinkOracle);
        }
    }

    function setDeltaBForWellsWithEntropy(
        uint256 entropy
    ) internal returns (int256[] memory deltaBPerWell) {
        address[] memory lps = bs.getWhitelistedWellLpTokens();
        deltaBPerWell = new int256[](lps.length);
        for (uint i; i < lps.length; i++) {
            // unix time is used to generate an unique deltaB upon every test.
            int256 deltaB = int256(uint256(keccak256(abi.encode(entropy, i, vm.unixTime()))));
            deltaB = bound(deltaB, -1000e6, 1000e6);
            (address tokenInWell, ) = bs.getNonBeanTokenAndIndexFromWell(lps[i]);
            setDeltaBforWell(deltaB, lps[i], tokenInWell);
            deltaBPerWell[i] = deltaB;
        }
    }

    /**
     * @notice update deltaB in wells. excess is minted to the well.
     * commands are called twice to update pumps, due to mocks and everything
     * executing in the same block.
     */
    function setDeltaBforWell(int256 deltaB, address wellAddress, address tokenInWell) internal {
        IWell well = IWell(wellAddress);
        IERC20 tokenOut;
        int256 initialDeltaB = bs.poolCurrentDeltaB(wellAddress);

        // find difference between initial and final deltaB
        int256 deltaBdiff = deltaB - initialDeltaB;

        if (deltaBdiff > 0) {
            uint256 tokenAmountIn = well.getSwapIn(IERC20(tokenInWell), bean, uint256(deltaBdiff));
            MockToken(tokenInWell).mint(wellAddress, tokenAmountIn);
            tokenOut = bean;
        } else {
            bean.mint(wellAddress, uint256(-deltaBdiff));
            tokenOut = IERC20(tokenInWell);
        }
        well.shift(tokenOut, 0, users[1]);
        well.shift(tokenOut, 0, users[1]);
    }

    /**
     * @notice adds 'x' fertilizer based on the amount of sprouts.
     * @dev the amount of sprouts are a function of the humidity,
     * which is a function of the season of mint.
     * returns the actual amount of sprouts issued, as fertilizer
     * is unitless per dollar. ERC1155 is NOT issued here.
     */
    function addFertilizerBasedOnSprouts(
        uint128 _season,
        uint256 sprouts
    ) public returns (uint256, uint256) {
        // calculate the amount of fertilizer needed to be issued.
        // note: fertilizer rounds down.
        uint256 humidity = bs.getHumidity(_season);
        uint256 fertOut = sprouts / ((1000 + humidity) / 1000);
        // calculate the amount of the barnRaiseToken needed to equal usdAmount.
        uint256 tokenAmount = fertOut * bs.getUsdTokenPrice(bs.getBarnRaiseToken());

        // add fertilizer.
        mockAddFertilizer(_season, uint128(tokenAmount));

        // return the amount of sprouts minted.
        return (fertOut * (1000 + bs.getHumidity(_season)) * 1000, fertOut);
    }

    /**
     * @notice adds fertilizer based on token amount in.
     * @dev 'season' determine the interest rate and id of the fertilizer.
     * {see. LibFertilizer.addFertilizer}
     */
    function mockAddFertilizer(uint128 _season, uint128 tokenAmountIn) internal {
        // mint tokens to user.
        address barnRaiseToken = bs.getBarnRaiseToken();
        mintTokensToUser(address(this), barnRaiseToken, tokenAmountIn);
        // add fertilizer.
        if (tokenAmountIn > 0) {
            bs.addFertilizer(_season, tokenAmountIn, 0);
        }
    }

    //////////////// CONVERT HELPERS /////////////////

    function convertEncoder(
        LibConvertData.ConvertKind kind,
        address token,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal pure returns (bytes memory) {
        if (kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            // lamda_lamda encoding
            return abi.encode(kind, amountIn, token);
        } else {
            // default encoding
            return abi.encode(kind, amountIn, minAmountOut, token);
        }
    }

    function createBeanToLPConvert(
        address well,
        uint256 amountIn
    ) internal pure returns (bytes memory) {
        return
            convertEncoder(
                LibConvertData.ConvertKind.BEANS_TO_WELL_LP,
                well, // well
                amountIn, // amountIn
                0 // minOut
            );
    }

    function rand(uint256 lowerBound, uint256 upperBound) internal returns (uint256) {
        return bound(uint256(keccak256(abi.encode(vm.unixTime()))), lowerBound, upperBound);
    }

    /**
     * @notice returns a random number between lowerBound and upperBound,
     * using unix time and salt as the source of randomness.
     */
    function rand(
        uint256 lowerBound,
        uint256 upperBound,
        bytes memory salt
    ) internal returns (uint256) {
        return bound(uint256(keccak256(abi.encode(vm.unixTime(), salt))), lowerBound, upperBound);
    }

    /**
     * @notice Calls sunrise twice to pass the germination process.
     */
    function passGermination() public {
        // call sunrise twice to end the germination process.
        bs.siloSunrise(0);
        bs.siloSunrise(0);
    }

    /**
     * @notice Set up the silo deposit test by depositing beans to the silo from multiple users.
     * @param amount The amount of beans to deposit.
     * @return _amount The actual amount of beans deposited.
     * @return stem The stem tip for the deposited beans.
     */
    function setUpSiloDepositTest(
        uint256 amount,
        address[] memory _farmers
    ) public returns (uint256 _amount, int96 stem) {
        _amount = bound(amount, 1, MAX_DEPOSIT_BOUND);

        depositForUsers(_farmers, BEAN, _amount, LibTransfer.From.EXTERNAL);
        stem = bs.stemTipForToken(BEAN);
    }

    /**
     * @notice Deposit beans to the silo from multiple users.
     * @param users The users to deposit beans from.
     * @param token The token to deposit.
     * @param amount The amount of beans to deposit.
     * @param mode The deposit mode.
     */
    function depositForUsers(
        address[] memory users,
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) public {
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            bs.deposit(token, amount, uint8(mode)); // switching from silo.deposit to bs.deposit, but bs does not have a From enum, so casting to uint8.
        }
    }

    /**
     * @notice mints `sowAmount` beans for farmer,
     * issues `sowAmount` of beans to farmer.
     * sows `sowAmount` of beans.
     */
    function sowAmountForFarmer(address farmer, uint256 sowAmount) internal {
        bs.setSoilE(sowAmount);
        mintTokensToUser(farmer, BEAN, sowAmount);
        vm.prank(farmer);
        bs.sow(sowAmount, 0, uint8(LibTransfer.From.EXTERNAL));
    }

    /**
     * @notice gets the next time the sunrise can be called,
     * and warps the time to that timestamp.
     */
    function warpToNextSeasonTimestamp() internal noGasMetering {
        uint256 nextTimestamp = season.getNextSeasonStart();
        vm.warp(nextTimestamp);
    }

    function warpToNextSeasonAndUpdateOracles() internal noGasMetering {
        warpToNextSeasonTimestamp();
        updateAllChainlinkOraclesWithPreviousData();
    }
}
