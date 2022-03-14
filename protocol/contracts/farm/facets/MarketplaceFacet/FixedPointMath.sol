pragma solidity ^0.7.6;

// https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol

library MathFP {
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

    //substract assuming both are fixed point
    function subd(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.sub(y);
    }

    //@dev Multiplies x and y, assuming 36 decimals fixed point
    function muld(uint256 x, uint256 y) internal pure returns (uint256) {
        return muld(x,y,36);
    }

    //@dev Multiplies x and y, assuming a variable decimal fixed point
    function muld(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(y).div(unit(decimals));
    }

    //@dev Divides x by y, assuming a 36 decimals fixed point
    function divd(uint256 x, uint256 y) internal pure returns (uint256) {
        return divd(x, y,36);
    }

    //@dev Divides x by y, assuming a variable decimal fixed point
    function divd(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(unit(decimals)).div(y);
    }


    // divides x by y, rounding to the closest representable number
    // assumes 36 digit fixed point
    function divdr(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdr(x, y, 36);
    }

    // divides x by y, rounding to the closest representable number
    // variable fixed point
    function divdr(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 5) return z / 10 + 1;
        else return z / 10;
    }

    // @dev Divides x by y, rounding up to the closest representable number
    function divdrup(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdrup(x, y, 36);
    }

    function divdrup(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 0) return z / 10 + 1;
        else return z / 10;
    }
}