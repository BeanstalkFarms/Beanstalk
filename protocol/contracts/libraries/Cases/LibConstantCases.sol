// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;


/**
 * @author Brean
 * @title LibConstantCases stores the data for each case.
 * Each case outputs 4 variables: 
 * mT: Temperature Scalar Term.
 * bT: Temperature Arithmetic Term.  
 * mL: Liquidity Scalar Term.
 * bL: Liquidity Arithmetic Term.
 * 
 * Temperature and grownStalk percentage to lp is updated as such:
 * T_n = mT * T_n-1 + bT
 * L_n = mL * L_n-1 + bL
 * 
 * @dev LibConstantCases uses constants order to minimize gas costs.
 * Data is formatted as such: 
 * mT: 3 Bytes (0)
 * bT: 1 Byte (0-255)
 * mL: 3 Bytes 
 * bL: 1 Byte
 * 
 * Thus, each case can be stored in 8 bytes.
 * In total, there are 96 cases (4 * 2 * 3 * 4)
 * In practice, the cases range from 0-127. 
 */


library LibConstantCases {
    bytes8 internal constant CASE0 = 0x0f4240030f424000;
    bytes8 internal constant CASE1 = 0x0f4240010f424000;
    bytes8 internal constant CASE2 = 0x0f4240000f424000;
    // bytes8 internal constant CASE3 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE4 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE5 = 0x0f4240fd0f424000;
    bytes8 internal constant CASE6 = 0x0f4240fd0f424000;
    // bytes8 internal constant CASE7 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE8 = 0x0f4240030f424000;
    bytes8 internal constant CASE9 = 0x0f4240010f424000;
    bytes8 internal constant CASE10 = 0x0f4240000f424000;
    // bytes8 internal constant CASE11 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE12 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE13 = 0x0f4240fd0f424000;
    bytes8 internal constant CASE14 = 0x0f4240fd0f424000;
    // bytes8 internal constant CASE15 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE16 = 0x0f4240030f424000;
    bytes8 internal constant CASE17 = 0x0f4240030f424000;
    bytes8 internal constant CASE18 = 0x0f4240010f424000;
    // bytes8 internal constant CASE19 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE20 = 0x0f4240000f424000;
    bytes8 internal constant CASE21 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE22 = 0x0f4240fd0f424000;
    // bytes8 internal constant CASE23 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE24 = 0x0f4240030f424000;
    bytes8 internal constant CASE25 = 0x0f4240030f424000;
    bytes8 internal constant CASE26 = 0x0f4240010f424000;
    // bytes8 internal constant CASE27 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE28 = 0x0f4240000f424000;
    bytes8 internal constant CASE29 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE30 = 0x0f4240fd0f424000;
    // bytes8 internal constant CASE31 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE32 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE33 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE34 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE35 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE36 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE37 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE38 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE39 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE40 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE41 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE42 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE43 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE44 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE45 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE46 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE47 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE48 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE49 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE50 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE51 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE52 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE53 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE54 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE55 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE56 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE57 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE58 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE59 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE60 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE61 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE62 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE63 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE64 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE65 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE66 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE67 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE68 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE69 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE70 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE71 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE72 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE73 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE74 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE75 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE76 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE77 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE78 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE79 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE80 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE81 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE82 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE83 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE84 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE85 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE86 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE87 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE88 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE89 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE90 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE91 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE92 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE93 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE94 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE95 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE96 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE97 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE98 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE99 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE100 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE101 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE102 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE103 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE104 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE105 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE106 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE107 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE108 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE109 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE110 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE111 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE112 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE113 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE114 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE115 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE116 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE117 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE118 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE119 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE120 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE121 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE122 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE123 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE124 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE125 = 0x0f4240ff0f424000;
    bytes8 internal constant CASE126 = 0x0f4240ff0f424000;
    // bytes8 internal constant CASE127 = 0x0f4240ff0f424000;
}