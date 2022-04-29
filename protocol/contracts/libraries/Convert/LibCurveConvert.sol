/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "./LibConvertUserData.sol";
import "./LibMetaCurveConvert.sol";
import "./LibBeanLUSDConvert.sol";
import "../Curve/LibBeanMetaCurve.sol";

/**
 * @author Publius
 * @title Lib Curve Convert
**/
library LibCurveConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    function getBeansAtPeg(address pool, uint256[2] memory balances) internal view returns (uint256 beans) {
        if (pool == C.curveMetapoolAddress()) return LibMetaCurveConvert.beansAtPeg(balances);
        // if (pool == C.curveBeanLUSDAddress()) return LibBeanLUSDConvert.beansAtPeg(balances);
        revert("Convert: Not a whitelisted Curve pool.");
    }

    function beansToPeg(address pool) internal view returns (uint256 beans) {
        uint256[2] memory balances = ICurvePool(pool).get_balances();
        uint256 xp1 = getBeansAtPeg(pool, balances);
        if (xp1 <= balances[0]) return 0;
        beans = xp1.sub(balances[0]);
    }

    function lpToPeg(address pool) internal view returns (uint256 lp) {
        uint256[2] memory balances = ICurvePool(pool).get_balances();
        uint256 xp1 = getBeansAtPeg(pool, balances);
        if (balances[0] <= xp1) return 0;
        lp = C.curveMetapool().calc_token_amount([balances[0].sub(xp1), 0], false);
    }

    /// @notice Takes in encoded bytes for adding Curve LP in beans, extracts the input data, and then calls the
    /// @param userData Contains convert input parameters for a Curve AddLPInBeans convert
    function convertLPToBeans(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        (uint256 lp, uint256 minBeans, address pool) = userData.convertWithAddress();
        (outAmount, inAmount) = _curveRemoveLPAndBuyToPeg(lp, minBeans, pool);
        outToken = C.beanAddress();
        inToken = pool;
        bdv = outAmount;
    }

    /// @notice Takes in encoded bytes for adding beans in Curve LP, extracts the input data, and then calls the
    /// @param userData Contains convert input parameters for a Curve AddBeansInLP convert
    function convertBeansToLP(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        (uint256 beans, uint256 minLP, address pool) = userData.convertWithAddress();
        (outAmount, inAmount) = _curveSellToPegAndAddLiquidity(beans, minLP, pool);
        outToken = pool;
        inToken = C.beanAddress();
        bdv = inAmount;
    }

    /// @notice Takes in parameters to convert beans into LP using Curve
    /// @param beans - amount of beans to convert to Curve LP
    /// @param minLP - min amount of Curve LP to receive
    function _curveSellToPegAndAddLiquidity(uint256 beans, uint256 minLP, address pool) private returns (uint256 lp, uint256 beansConverted) {
        uint256 beansTo = beansToPeg(pool);
        require(beansTo > 0, "Convert: P must be < 1.");
        beansConverted = beans > beansTo ? beansTo : beans;
        lp = ICurvePool(pool).add_liquidity([beansConverted, 0], minLP);
    }

    /// @notice Takes in parameters to remove LP into beans by removing LP in curve through removing beans 
    /// @param lp - the amount of Curve lp to be removed
    /// @param minBeans - min amount of beans to receive   
    function _curveRemoveLPAndBuyToPeg(uint256 lp, uint256 minBeans, address pool) private returns (uint256 beans, uint256 lpConverted) {
        uint256 lpTo = lpToPeg(pool);
        require(lpTo > 0, "Convert: P must be < 1.");
        lpConverted = lp > lpTo ? lpTo : lp;
        beans = ICurvePool(pool).remove_liquidity_one_coin(lpConverted, 0, minBeans);
    }
}
