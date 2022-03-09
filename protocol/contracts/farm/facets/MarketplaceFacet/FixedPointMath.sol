pragma solidity ^0.7.6;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

// https://github.com/CementDAO/Fixidity/blob/master/contracts/FixidityLib.sol
// https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol

library MathFPSigned {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    uint256 constant maxUintCons = 2**256 - 1;
    
    //returns '1' in FP representation
    function unit(uint8 decimals) internal pure returns(uint256) {
        require(decimals <= 77, "Maximum of 77 decimals.");
        return 10**uint256(decimals);
    }

    // adds x and y assuming they are both fixed point
    function addd(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.add(y);
    }

    function addd(int256 x, int256 y) internal pure returns (int256) {
        return x.add(y);
    }

    //substract assuming both are fixed point
    function subd(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.sub(y);
    }

    function subd(int256 x, int256 y) internal pure returns (int256) {
        return x.sub(y);
    }

    //@dev Multiplies x and y, assuming 36 decimals fixed point
    function muld(uint256 x, uint256 y) internal pure returns (uint256) {
        return muld(x,y,36);
    }

    //@dev Multiplies x and y, assuming 36 decimals fixed point
    function muld(int256 x, int256 y, uint8 decimals) internal pure returns (int256) {
        return muld(x,y,36);
    }

    //@dev Multiplies x and y, assuming a variable decimal fixed point
    function muld(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(y).div(unit(decimals));
    }

    //@dev Multiplies x and y, assuming a variable decimal fixed point
    function muld(int256 x, int256 y, uint8 decimals) internal pure returns (int256) {
        return x.mul(y).div(int256(unit(decimals)));
    }

    //@dev Divides x by y, assuming a 36 decimals fixed point
    function divd(uint256 x, uint256 y) internal pure returns (uint256) {
        return divd(x, y,36);
    }

    //@dev Divides x by y, assuming a 36 decimals fixed point
    function divd(int256 x, int256 y) internal pure returns (int256) {
        return divd(x, y, 36);
    }

    //@dev Divides x by y, assuming a variable decimal fixed point
    function divd(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(unit(decimals)).div(y);
    }

    //@dev Divides x by y, assuming a variable decimal fixed point
    function divd(int256 x, int256 y, uint8 decimals) internal pure returns (int256) {
        return x.mul(int(unit(decimals))).div(y);
    }

    // divides x by y, rounding to the closest representable number
    // assumes 36 digit fixed point
    function divdr(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdr(x, y, 36);
    }

    // divides x by y, rounding to the closest representable number
    // assumes 36 digit fixed point
    function divdr(int256 x, int256 y) internal pure returns (int256) {
        return divdr(x, y, 36);
    }

    // divides x by y, rounding to the closest representable number
    // variable fixed point
    function divdr(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 5) return z / 10 + 1;
        else return z / 10;
    }

     // divides x by y, rounding to the closest representable number
    // variable fixed point
    function divdr(int256 x, int256 y, uint8 decimals) internal pure returns (int256) {
        int256 z = x.mul(int256(unit(decimals + 1))).div(y);
        if (z % 10 > 5) return z / 10 + 1;
        else if (z % 10 < -5) return z / 10 - 1;
        else return z / 10;
    }

    // @dev Divides x by y, rounding up to the closest representable number
    function divdrup(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdrup(x, y, 36);
    }

    function divdrup(int256 x, int256 y) internal pure returns (int256) {
        return divdrup(x, y, 36);
    }

    function divdrup(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 0) return z / 10 + 1;
        else return z / 10;
    }

    function divdrup(int256 x, int256 y, uint8 decimals) internal pure returns (int256) {
        int256 z = x.mul(int256(unit(decimals + 1))).div(y);
        if (z % 10 > 0) return z / 10 + 1;
        else if (z % 10 < 0) return z / 10 - 1;
        else return z / 10;
    }
}