/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../Curve/LibMetaCurve.sol";

/**
 * @author Publius
 * @title Lib Plain Curve Convert
 **/
library LibPlainCurveConvert {
    using SafeMath for uint256;

    uint256 private constant i = 0;
    uint256 private constant j = 1;

    function beansAtPeg(
        address pool,
        uint256[2] memory balances,
        address[2] memory metaPool,
        uint256[2] memory decimals
    ) internal view returns (uint256 beans) {
        uint256 pool0Price = LibMetaCurve.price(metaPool[i], decimals[i]);
        uint256 pool1Price = LibMetaCurve.price(metaPool[j], decimals[j]);

        uint256[2] memory rates = getPlainRates(decimals);
        uint256[2] memory xp = LibCurve.getXP(balances, rates);
        uint256 a = ICurvePool(pool).A_precise();
        uint256 D = LibCurve.getD(xp, a);

        // The getPrice function will need to be refactored if Bean is not the first token in the pool.
        uint256 poolPrice = LibCurve.getPrice(xp, rates, a, D);

        uint256 pricePadding = decimals[j] - decimals[i];
        uint256 targetPrice = pool0Price.mul(10**pricePadding).div(pool1Price);

        return
            getPlainPegBeansAtPeg(
                xp,
                D,
                36 - decimals[i],
                a,
                targetPrice,
                poolPrice
            );
    }

    struct DeltaB {
        uint256 pegBeans;
        int256 currentBeans;
        int256 deltaBToPeg;
        int256 deltaPriceToTarget;
        int256 deltaPriceToPeg;
        int256 estDeltaB;
        uint256 kBeansAtPeg;
    }

    function getPlainPegBeansAtPeg(
        uint256[2] memory xp,
        uint256 D,
        uint256 padding,
        uint256 a,
        uint256 targetPrice,
        uint256 poolPrice
    ) private pure returns (uint256 b) {
        DeltaB memory db;
        db.currentBeans = int256(xp[0]);
        db.pegBeans = D / 2;
        db.deltaBToPeg = int256(db.pegBeans) - db.currentBeans;

        uint256 prevPrice;
        uint256 x;
        uint256 x2;

        for (uint256 k = 0; k < 256; k++) {
            db.deltaPriceToTarget = int256(targetPrice) - int256(poolPrice);
            db.deltaPriceToPeg = 1e6 - int256(poolPrice);
            db.deltaBToPeg = int256(db.pegBeans) - int256(xp[0]);
            db.estDeltaB =
                (db.deltaBToPeg *
                    int256(
                        (db.deltaPriceToTarget * 1e18) / db.deltaPriceToPeg
                    )) /
                1e18;
            x = uint256(int256(xp[0]) + db.estDeltaB);
            x2 = LibCurve.getY(x, xp, a, D);
            xp[0] = x;
            xp[1] = x2;
            prevPrice = poolPrice;
            poolPrice = LibCurve.getPrice(xp, [padding, padding], a, D);
            if (prevPrice > poolPrice) {
                if (prevPrice - poolPrice <= 1) break;
            } else if (poolPrice - prevPrice <= 1) break;
        }
        return xp[0].mul(1e18).div(10**padding);
    }

    function getPlainRates(uint256[2] memory decimals)
        private
        pure
        returns (uint256[2] memory rates)
    {
        return [10**(36 - decimals[0]), 10**(36 - decimals[1])];
    }
}
