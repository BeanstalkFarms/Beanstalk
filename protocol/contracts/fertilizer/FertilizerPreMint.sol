// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Internalizer.sol";
import "../interfaces/ISwapRouter.sol";
import "../interfaces/IQuoter.sol";
import "../interfaces/IWETH.sol";

/**
 * @author publius
 * @title Barn Raiser 
 */

contract FertilizerPreMint is Internalizer {

    using SafeERC20Upgradeable for IERC20;

    ////////////////////// Ropsten ///////////////////////
    // address constant public USDC = 0x07865c6E87B9F70255377e024ace6630C1Eaa37F;
    // address constant public WETH = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

    /////////////////////// RINKEBY //////////////////////
    // address constant public USDC = 0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b;
    // address constant public WETH = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

    /////////////////////// MAINNET //////////////////////
    address constant public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // Settings
    address constant CUSTODIAN   = 0x21DE18B6A8f78eDe6D16C50A167f6B222DC08DF7;
    uint256 constant START_TIMESTAMP = 1654531200;
    uint256 constant DECIMALS        = 1e6;
    IERC20 constant IUSDC            = IERC20(USDC);

    // Uniswap Settings
    address constant SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant QUOTER      = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
    uint24 constant POOL_FEE     = 500;
    uint128 constant MAX_RAISE  = 77_000_000_000_000; // 77 million in USDC


    function initialize() public initializer {
        IERC20(WETH).approve(SWAP_ROUTER, type(uint256).max);
        __Internallize_init();
    }

    function mint(uint256 amount) external payable nonReentrant {
        uint256 r = remaining();
        if (amount > r) amount = r;
        __mint(amount);
        IUSDC.transferFrom(msg.sender, CUSTODIAN, amount);
    }

    function buyAndMint(uint256 buyAmount) external payable nonReentrant {
        uint256 amount = buy(buyAmount);
        require(IUSDC.balanceOf(CUSTODIAN) <= MAX_RAISE, "Fertilizer: Not enough remaining");
        __mint(amount);
    }

    function __mint(uint256 amount) private {
        require(started(), "Fertilizer: Not started");
        _safeMint(
            msg.sender,
            getMintId(),
            amount/DECIMALS,
            bytes('0')
        );
    }

    function started() public view returns (bool) {
        return block.timestamp >= start();
    }

    function start() public pure returns (uint256) {
        return START_TIMESTAMP;
    }

    // These functions will be overwritten once Beanstalk has restarted.

    function remaining() public view returns (uint256) {
        return MAX_RAISE - IUSDC.balanceOf(CUSTODIAN);
    }

    function getMintId() public pure returns (uint256) {
        return 6_000_000;
    }

    ///////////////////////////////////// Uniswap //////////////////////////////////////////////

    function buy(uint256 minAmountOut) private returns (uint256 amountOut) {
        IWETH(WETH).deposit{value: msg.value}();
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: USDC,
                fee: POOL_FEE,
                recipient: CUSTODIAN,
                deadline: block.timestamp,
                amountIn: msg.value,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });
        amountOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(params);
    }

    function getUsdcOut(uint ethAmount) public payable returns (uint256) {
        return IQuoter(QUOTER).quoteExactInputSingle(
            WETH,
            USDC,
            POOL_FEE,
            ethAmount,
            0
        );
    }

    function getUsdcOutWithSlippage(uint ethAmount, uint slippage) external payable returns (uint256) {
        return getUsdcOut(ethAmount) * 10000/(10000+slippage);
    }
}