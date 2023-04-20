/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibConvertData} from "~/libraries/Convert/LibConvertData.sol";
import {LibWell} from "~/libraries/Well/LibWell.sol";
import {LibInternal} from "~/libraries/LibInternal.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "~/C.sol";
import {Call, IWell} from "@wells/interfaces/IWell.sol";
import {IBeanstalkWellFunction} from "@wells/interfaces/IBeanstalkWellFunction.sol";

/**
 * @title Lib Well Convert
 **/
library LibWellConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    function beansToPeg(address well) internal view returns (uint256 beans) {
        (beans, ) = _beansToPeg(well);
    }

    function _beansToPeg(address well) internal view returns (uint256 beans, uint256 beanIndex) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory reserves = IWell(well).getReserves();
        Call memory wellFunction = IWell(well).wellFunction();
        uint256[] memory ratios;
        (ratios, beanIndex) = LibWell.getRatiosAndBeanIndex(tokens);

        uint256 beansAtPeg = IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioLiquidity(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        );
        if (beansAtPeg <= reserves[beanIndex]) return (0, beanIndex);
        beans = beansAtPeg - reserves[beanIndex];
    }

    function lpToPeg(address well) internal view returns (uint256 lp) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory reserves = IWell(well).getReserves();
        Call memory wellFunction = IWell(well).wellFunction();
        uint beanIndex = LibWell.getBeanIndex(tokens);
        uint256[] memory ratios;
        (ratios, beanIndex) = LibWell.getRatiosAndBeanIndex(tokens);

        uint256 lpSupplyNow = IBeanstalkWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );
        uint256 beansAtPeg = IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioLiquidity(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        );

        if (reserves[beanIndex] <= beansAtPeg) return 0;
        reserves[beanIndex] = beansAtPeg;
        return lpSupplyNow - IBeanstalkWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );
    }

    /// @param amountIn The amount of the LP token of `well` to remove as BEAN.
    /// @return beans The amount of BEAN received for removing `amountIn` LP tokens.
    function getBeanAmountOut(address well, uint256 amountIn) internal view returns(uint256 beans) {
        beans = IWell(well).getRemoveLiquidityOneTokenOut(amountIn, IERC20(C.beanAddress()));
    }

    /// @param amountIn The amount of BEAN to deposit into `well`.
    /// @return lp The amount of LP received for depositing BEAN.
    function getLPAmountOut(address well, uint256 amountIn) internal view returns(uint256 lp) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory amounts = new uint256[](tokens.length);
        amounts[LibWell.getBeanIndex(tokens)] = amountIn;
        lp = IWell(well).getAddLiquidityOut(amounts);
    }

    /// @notice Takes in encoded bytes for adding Curve LP in beans, extracts the input data, and then calls the
    /// @param convertData Contains convert input parameters for a Curve AddLPInBeans convert
    function convertLPToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (uint256 lp, uint256 minBeans, address well) = convertData.convertWithAddress();

        tokenOut = C.beanAddress();
        tokenIn = well;
        LibInternal.mow(msg.sender, tokenIn);
        LibInternal.mow(msg.sender, tokenOut);

        (outAmount, inAmount) = _wellRemoveLPAndBuyToPeg(lp, minBeans, well);
    }

    /// @notice Takes in encoded bytes for adding beans in Curve LP, extracts the input data, and then calls the
    /// @param convertData Contains convert input parameters for a Curve AddBeansInLP convert
    function convertBeansToLP(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (uint256 beans, uint256 minLP, address well) = convertData
            .convertWithAddress();
    
        tokenOut = well;
        tokenIn = C.beanAddress();
        LibInternal.mow(msg.sender, C.beanAddress());
        LibInternal.mow(msg.sender, well);

        (outAmount, inAmount) = _wellSellToPegAndAddLiquidity(
            beans,
            minLP,
            well
        );
    }

    /// @notice Takes in parameters to convert beans into LP using Curve
    /// @param beans - amount of beans to convert to Curve LP
    /// @param minLP - min amount of Curve LP to receive
    function _wellSellToPegAndAddLiquidity(
        uint256 beans,
        uint256 minLP,
        address well
    ) internal returns (uint256 lp, uint256 beansConverted) {
        (uint256 maxBeans, uint beanIndex) = _beansToPeg(well);
        require(maxBeans > 0, "Convert: P must be >= 1.");
        beansConverted = beans > maxBeans ? maxBeans : beans;
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory amounts = new uint256[](tokens.length);
        amounts[beanIndex] = beansConverted;
        C.bean().approve(well, beansConverted);
        lp = IWell(well).addLiquidity(
            amounts,
            minLP,
            address(this),
            block.timestamp
        );
    }

    /// @notice Takes in parameters to remove LP into beans by removing LP in curve through removing beans
    /// @param lp - the amount of Curve lp to be removed
    /// @param minBeans - min amount of beans to receive
    function _wellRemoveLPAndBuyToPeg(
        uint256 lp,
        uint256 minBeans,
        address well
    ) internal returns (uint256 beans, uint256 lpConverted) {
        uint256 maxLp = lpToPeg(well);
        require(maxLp > 0, "Convert: P must be < 1.");
        lpConverted = lp > maxLp ? maxLp : lp;
        // TODO: maybe move to init function
        beans = IWell(well).removeLiquidityOneToken(
            lpConverted,
            C.bean(),
            minBeans,
            address(this),
            block.timestamp
        );
    }
}
