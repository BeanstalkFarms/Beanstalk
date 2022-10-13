/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../Well/LibWellData.sol";
import "../Well/Type/LibWellType.sol";
import "../Well/LibWell.sol";
import "../Well/LibWellPump.sol";
import "./LibConvertData.sol";

interface IWell {
    
}

library LibWellConvert {
    using LibConvertData for bytes;
    using SafeMath for uint256;

    function convertLPToBeans(bytes calldata convertData, LibWellStorage.WellInfo calldata wi)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        uint256 minOutAmount;
        (inAmount, minOutAmount) = LibConvertData.convertWell(convertData);
        inAmount = LibMath.min(inAmount, lpToPeg(wi));
        outAmount = LibWell.removeLiquidityOneToken(
            wi,
            C.bean(),
            inAmount,
            minOutAmount,
            address(this),
            LibTransfer.From.EXTERNAL
        );
        tokenOut = C.beanAddress();
        tokenIn = wi.wellId;
    }

    function convertBeansToLP(bytes calldata convertData, LibWellStorage.WellInfo calldata wi)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        uint256 minOutAmount;
        (inAmount, minOutAmount) = LibConvertData.convertWell(convertData);
        inAmount = LibMath.min(inAmount, beansToPeg(wi));
        uint256[] memory amounts = new uint256[](wi.tokens.length);
        amounts[LibWellData.getI(wi.tokens, C.bean())] = inAmount;
        outAmount = LibWell.addLiquidity(
            wi,
            amounts,
            minOutAmount,
            address(this),
            LibTransfer.To.EXTERNAL
        );
        tokenIn = C.beanAddress();
        tokenOut = wi.wellId;
    }

    function beansToPeg(LibWellStorage.WellInfo calldata wi)
        internal
        view
        returns (uint256 beans)
    {
        int256 usBeans = LibWellPump.getAddXToPeg(wi, C.bean(), C.usdAddress());
        if (usBeans < 0) return 0;
        beans = uint256(usBeans);
    }

    function lpToPeg(LibWellStorage.WellInfo calldata wi)
        internal
        view
        returns (uint256 lp)
    {
        int256 usLP = LibWellPump.getRemoveDToPeg(wi, C.bean(), C.usdAddress());
        if (usLP < 0) return 0;
        lp = uint256(usLP);
    }

    function getLPAmountOut(uint256 amountIn, LibWellStorage.WellInfo calldata wi)
        internal
        view
        returns (uint256 lp)
    {
        uint256[] memory amounts = new uint256[](wi.tokens.length);
        amounts[LibWellData.getI(wi.tokens, C.bean())] = amountIn;
        lp = LibWell.getAddLiquidityOut(wi, amounts);
    }

    function getBeanAmountOut(
        uint256 amountIn,
        LibWellStorage.WellInfo calldata wi
    ) internal view returns (uint256 beans) {
        beans = LibWell.getRemoveLiquidityOneTokenOut(wi, C.bean(), amountIn);
    }
}
