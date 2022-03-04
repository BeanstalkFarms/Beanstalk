pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


library LibConvertUserData {
    // In order to preserve backwards compatibility, make sure new kinds are added at the end of the enum.
    enum ConvertKind {
        BEANS_TO_UNISWAP_LP,
        UNISWAP_LP_TO_BEANS,
        BEANS_TO_CURVE_LP,
        CURVE_LP_TO_BEANS,
        UNISWAP_BUY_TO_PEG_AND_CURVE_SELL_TO_PEG,
        CURVE_BUY_TO_PEG_AND_UNISWAP_SELL_TO_PEG
    }

    function convertKind(bytes memory self) internal pure returns (ConvertKind) {
        return abi.decode(self, (ConvertKind));
    }

    // SellToPegAndAddLiquidity Functions
    function addLPInBeans(bytes memory self)
        internal
        pure
        returns (uint256 beans, uint256 minLP)
    {
        (, beans, minLP) = abi.decode(self, (ConvertKind, uint256, uint256));
    }

    // BuyToPeg Functions
    function addBeansInLP(bytes memory self)
        internal
        pure
        returns (uint256 lp, uint256 minBeans)
    {
        (, lp, minBeans) = abi.decode(self, (ConvertKind, uint256, uint256));
    }

    function uniswapBuyToPegAndCurveSellToPeg(bytes memory self)
        internal
        pure
        returns (uint256 uniswapLP, uint256 minBeans, uint256 beans, uint256 minCurveLP)
    {
        (, uniswapLP, minBeans, beans, minCurveLP) = abi.decode(self, (ConvertKind, uint256, uint256, uint256, uint256));
    }

    function curveBuyToPegAndUniswapSellToPeg(bytes memory self)
        internal
        pure
        returns (uint256 curveLP, uint256 minBeans, uint256 beans, uint256 minUniswapLP)
    {
        (, curveLP, minBeans, beans, minUniswapLP) = abi.decode(self, (ConvertKind, uint256, uint256, uint256, uint256));
    }
}
