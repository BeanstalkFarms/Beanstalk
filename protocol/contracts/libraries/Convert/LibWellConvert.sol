/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibConvertData} from "contracts/libraries/Convert/LibConvertData.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";
import {Call, IWell} from "contracts/interfaces/basin/IWell.sol";
import {IBeanstalkWellFunction} from "contracts/interfaces/basin/IBeanstalkWellFunction.sol";

/**
 * @title Well Convert Library
 * @notice Contains Functions to convert from/to Well LP tokens to/from Beans
 * in the direction of the Peg.
 **/
library LibWellConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    /**
     * @dev Calculates the maximum amount of Beans that can be
     * convert to the LP Token of a given `well` while maintaining a delta B >= 0.
     */
    function beansToPeg(address well) internal view returns (uint256 beans) {
        (beans, ) = _beansToPeg(well);
    }

    /**
     * An internal version of `beansToPeg` that always returns the
     * index of the Bean token in a given `well`.
     */
    function _beansToPeg(address well) internal view returns (uint256 beans, uint256 beanIndex) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory reserves = IWell(well).getReserves();
        Call memory wellFunction = IWell(well).wellFunction();
        uint256[] memory ratios; bool success;
        (ratios, beanIndex, success) = LibWell.getRatiosAndBeanIndex(tokens);
        // If the USD Oracle oracle call fails, the convert should not be allowed.
        require(success, "Convert: USD Oracle failed");

        uint256 beansAtPeg = IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioLiquidity(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        );

        if (beansAtPeg <= reserves[beanIndex]) return (0, beanIndex);
        // SafeMath is unnecessary as above line performs the check
        beans = beansAtPeg - reserves[beanIndex];
    }

    /**
     * @dev Calculates the maximum amount of LP Tokens of a given `well` that can be 
     * converted to Beans while maintaining a delta B <= 0.
     */
    function lpToPeg(address well) internal view returns (uint256 lp) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory reserves = IWell(well).getReserves();
        Call memory wellFunction = IWell(well).wellFunction();
        (uint256[] memory ratios, uint256 beanIndex, bool success) = LibWell.getRatiosAndBeanIndex(tokens);
        // If the USD Oracle oracle call fails, the convert should not be allowed.
        require(success, "Convert: USD Oracle failed");

        uint256 beansAtPeg = IBeanstalkWellFunction(wellFunction.target).calcReserveAtRatioLiquidity(
            reserves,
            beanIndex,
            ratios,
            wellFunction.data
        );

        if (reserves[beanIndex] <= beansAtPeg) return 0;

        uint256 lpSupplyNow = IBeanstalkWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        );

        reserves[beanIndex] = beansAtPeg;
        return lpSupplyNow.sub(IBeanstalkWellFunction(wellFunction.target).calcLpTokenSupply(
            reserves,
            wellFunction.data
        ));
    }

    /**
     * @dev Calculates the amount of Beans recieved from converting
     * `amountIn` LP Tokens of a given `well`.
     */
    function getBeanAmountOut(address well, uint256 amountIn) internal view returns(uint256 beans) {
        beans = IWell(well).getRemoveLiquidityOneTokenOut(amountIn, IERC20(C.BEAN));
    }

    /**
     * @dev Calculates the amount of LP Tokens of a given `well` recieved from converting
     * `amountIn` Beans.
     */
    function getLPAmountOut(address well, uint256 amountIn) internal view returns(uint256 lp) {
        IERC20[] memory tokens = IWell(well).tokens();
        uint256[] memory amounts = new uint256[](tokens.length);
        amounts[LibWell.getBeanIndex(tokens)] = amountIn;
        lp = IWell(well).getAddLiquidityOut(amounts);
    }

    /**
     * @notice Converts `lp` LP Tokens of a given `well` into at least `minBeans` Beans
     * while ensuring that delta B <= 0 in the Bean:3Crv Curve Metapool.
     * @param convertData Contains the encoding of `lp`, `minBeans` and `well`.
     * @return tokenOut The token to convert to.
     * @return tokenIn The token to convert from
     * @return amountOut The number of `tokenOut` convert to
     * @return amountIn The number of `tokenIn` converted from
     */
    function convertLPToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        (uint256 lp, uint256 minBeans, address well) = convertData.convertWithAddress();

        tokenOut = C.BEAN;
        tokenIn = well;

        (amountOut, amountIn) = _wellRemoveLiquidityTowardsPeg(lp, minBeans, well);
    }

    /**
     * @dev Removes Liquidity as Beans with the constraint that delta B <= 0.
     */
    function _wellRemoveLiquidityTowardsPeg(
        uint256 lp,
        uint256 minBeans,
        address well
    ) internal returns (uint256 beans, uint256 lpConverted) {
        uint256 maxLp = lpToPeg(well);
        require(maxLp > 0, "Convert: P must be < 1.");
        lpConverted = lp > maxLp ? maxLp : lp;
        beans = IWell(well).removeLiquidityOneToken(
            lpConverted,
            C.bean(),
            minBeans,
            address(this),
            block.timestamp
        );
    }

    /**
     * @notice Converts `beans` Beans into at least `minLP` LP Tokens of a given `well`
     * while ensuring that delta B >= 0 in the Bean:3Crv Curve Metapool.
     * @param convertData Contains the encoding of `beans`, `minLp` and `well`.
     * @return tokenOut The token to convert to.
     * @return tokenIn The token to convert from
     * @return amountOut The number of `tokenOut` convert to
     * @return amountIn The number of `tokenIn` converted from
     */
    function convertBeansToLP(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        (uint256 beans, uint256 minLP, address well) = convertData
            .convertWithAddress();
    
        tokenOut = well;
        tokenIn = C.BEAN;

        (amountOut, amountIn) = _wellAddLiquidityTowardsPeg(
            beans,
            minLP,
            well
        );
    }

    /**
     * @dev Adds as Beans Liquidity with the constraint that delta B >= 0.
     */
    function _wellAddLiquidityTowardsPeg(
        uint256 beans,
        uint256 minLP,
        address well
    ) internal returns (uint256 lp, uint256 beansConverted) {
        (uint256 maxBeans, uint beanIndex) = _beansToPeg(well);
        require(maxBeans > 0, "Convert: P must be >= 1.");
        beansConverted = beans > maxBeans ? maxBeans : beans;
        C.bean().transfer(well, beansConverted);
        lp = IWell(well).sync(
            address(this),
            minLP
        );
    }
}
