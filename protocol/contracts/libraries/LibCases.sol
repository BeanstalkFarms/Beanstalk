// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import {Decimal, SafeMath} from "contracts/libraries/Decimal.sol";
import "contracts/libraries/LibSafeMath32.sol";


/**
 * @author Brean
 * @title LibCases gives the output for each case. 
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
 * @dev LibCases uses immutable storage in order to minimize gas costs.
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


library LibCases {
    // TODO update cases to reflect current cases
    bytes8 private constant CASE0 = 0x0f4240ff0f424000;
    bytes8 private constant CASE1 = 0x0f4240ff0f424000;
    bytes8 private constant CASE2 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE3 = 0x0f4240ff0f424000;
    bytes8 private constant CASE4 = 0x0f4240ff0f424000;
    bytes8 private constant CASE5 = 0x0f4240ff0f424000;
    bytes8 private constant CASE6 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE7 = 0x0f4240ff0f424000;
    bytes8 private constant CASE8 = 0x0f4240ff0f424000;
    bytes8 private constant CASE9 = 0x0f4240ff0f424000;
    bytes8 private constant CASE10 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE11 = 0x0f4240ff0f424000;
    bytes8 private constant CASE12 = 0x0f4240ff0f424000;
    bytes8 private constant CASE13 = 0x0f4240ff0f424000;
    bytes8 private constant CASE14 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE15 = 0x0f4240ff0f424000;
    bytes8 private constant CASE16 = 0x0f4240ff0f424000;
    bytes8 private constant CASE17 = 0x0f4240ff0f424000;
    bytes8 private constant CASE18 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE19 = 0x0f4240ff0f424000;
    bytes8 private constant CASE20 = 0x0f4240ff0f424000;
    bytes8 private constant CASE21 = 0x0f4240ff0f424000;
    bytes8 private constant CASE22 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE23 = 0x0f4240ff0f424000;
    bytes8 private constant CASE24 = 0x0f4240ff0f424000;
    bytes8 private constant CASE25 = 0x0f4240ff0f424000;
    bytes8 private constant CASE26 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE27 = 0x0f4240ff0f424000;
    bytes8 private constant CASE28 = 0x0f4240ff0f424000;
    bytes8 private constant CASE29 = 0x0f4240ff0f424000;
    bytes8 private constant CASE30 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE31 = 0x0f4240ff0f424000;
    bytes8 private constant CASE32 = 0x0f4240ff0f424000;
    bytes8 private constant CASE33 = 0x0f4240ff0f424000;
    bytes8 private constant CASE34 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE35 = 0x0f4240ff0f424000;
    bytes8 private constant CASE36 = 0x0f4240ff0f424000;
    bytes8 private constant CASE37 = 0x0f4240ff0f424000;
    bytes8 private constant CASE38 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE39 = 0x0f4240ff0f424000;
    bytes8 private constant CASE40 = 0x0f4240ff0f424000;
    bytes8 private constant CASE41 = 0x0f4240ff0f424000;
    bytes8 private constant CASE42 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE43 = 0x0f4240ff0f424000;
    bytes8 private constant CASE44 = 0x0f4240ff0f424000;
    bytes8 private constant CASE45 = 0x0f4240ff0f424000;
    bytes8 private constant CASE46 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE47 = 0x0f4240ff0f424000;
    bytes8 private constant CASE48 = 0x0f4240ff0f424000;
    bytes8 private constant CASE49 = 0x0f4240ff0f424000;
    bytes8 private constant CASE50 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE51 = 0x0f4240ff0f424000;
    bytes8 private constant CASE52 = 0x0f4240ff0f424000;
    bytes8 private constant CASE53 = 0x0f4240ff0f424000;
    bytes8 private constant CASE54 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE55 = 0x0f4240ff0f424000;
    bytes8 private constant CASE56 = 0x0f4240ff0f424000;
    bytes8 private constant CASE57 = 0x0f4240ff0f424000;
    bytes8 private constant CASE58 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE59 = 0x0f4240ff0f424000;
    bytes8 private constant CASE60 = 0x0f4240ff0f424000;
    bytes8 private constant CASE61 = 0x0f4240ff0f424000;
    bytes8 private constant CASE62 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE63 = 0x0f4240ff0f424000;
    bytes8 private constant CASE64 = 0x0f4240ff0f424000;
    bytes8 private constant CASE65 = 0x0f4240ff0f424000;
    bytes8 private constant CASE66 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE67 = 0x0f4240ff0f424000;
    bytes8 private constant CASE68 = 0x0f4240ff0f424000;
    bytes8 private constant CASE69 = 0x0f4240ff0f424000;
    bytes8 private constant CASE70 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE71 = 0x0f4240ff0f424000;
    bytes8 private constant CASE72 = 0x0f4240ff0f424000;
    bytes8 private constant CASE73 = 0x0f4240ff0f424000;
    bytes8 private constant CASE74 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE75 = 0x0f4240ff0f424000;
    bytes8 private constant CASE76 = 0x0f4240ff0f424000;
    bytes8 private constant CASE77 = 0x0f4240ff0f424000;
    bytes8 private constant CASE78 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE79 = 0x0f4240ff0f424000;
    bytes8 private constant CASE80 = 0x0f4240ff0f424000;
    bytes8 private constant CASE81 = 0x0f4240ff0f424000;
    bytes8 private constant CASE82 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE83 = 0x0f4240ff0f424000;
    bytes8 private constant CASE84 = 0x0f4240ff0f424000;
    bytes8 private constant CASE85 = 0x0f4240ff0f424000;
    bytes8 private constant CASE86 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE87 = 0x0f4240ff0f424000;
    bytes8 private constant CASE88 = 0x0f4240ff0f424000;
    bytes8 private constant CASE89 = 0x0f4240ff0f424000;
    bytes8 private constant CASE90 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE91 = 0x0f4240ff0f424000;
    bytes8 private constant CASE92 = 0x0f4240ff0f424000;
    bytes8 private constant CASE93 = 0x0f4240ff0f424000;
    bytes8 private constant CASE94 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE95 = 0x0f4240ff0f424000;
    bytes8 private constant CASE96 = 0x0f4240ff0f424000;
    bytes8 private constant CASE97 = 0x0f4240ff0f424000;
    bytes8 private constant CASE98 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE99 = 0x0f4240ff0f424000;
    bytes8 private constant CASE100 = 0x0f4240ff0f424000;
    bytes8 private constant CASE101 = 0x0f4240ff0f424000;
    bytes8 private constant CASE102 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE103 = 0x0f4240ff0f424000;
    bytes8 private constant CASE104 = 0x0f4240ff0f424000;
    bytes8 private constant CASE105 = 0x0f4240ff0f424000;
    bytes8 private constant CASE106 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE107 = 0x0f4240ff0f424000;
    bytes8 private constant CASE108 = 0x0f4240ff0f424000;
    bytes8 private constant CASE109 = 0x0f4240ff0f424000;
    bytes8 private constant CASE110 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE111 = 0x0f4240ff0f424000;
    bytes8 private constant CASE112 = 0x0f4240ff0f424000;
    bytes8 private constant CASE113 = 0x0f4240ff0f424000;
    bytes8 private constant CASE114 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE115 = 0x0f4240ff0f424000;
    bytes8 private constant CASE116 = 0x0f4240ff0f424000;
    bytes8 private constant CASE117 = 0x0f4240ff0f424000;
    bytes8 private constant CASE118 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE119 = 0x0f4240ff0f424000;
    bytes8 private constant CASE120 = 0x0f4240ff0f424000;
    bytes8 private constant CASE121 = 0x0f4240ff0f424000;
    bytes8 private constant CASE122 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE123 = 0x0f4240ff0f424000;
    bytes8 private constant CASE124 = 0x0f4240ff0f424000;
    bytes8 private constant CASE125 = 0x0f4240ff0f424000;
    bytes8 private constant CASE126 = 0x0f4240ff0f424000;
    // bytes8 private constant CASE127 = 0x0f4240ff0f424000;

    function getDataFromCase(uint256 caseId) private pure returns (bytes8 caseData){
        if(caseId < 64){
            if(caseId < 32) {
                if(caseId < 16) {
                    if(caseId < 8) {
                        if(caseId < 4){
                            if(caseId < 2){
                                if(caseId == 1){
                                    return CASE1;
                                } else {
                                    return CASE0;
                                }
                            } else {
                                // return CASE3;
                                return 0;
                            }
                        }
                        if(caseId < 6){
                            if(caseId == 5){
                                return CASE5;
                            } else {
                                return CASE4;
                            }
                        }
                        if(caseId == 7){
                            return 0;
                            // return CASE7;
                        } else {
                            return CASE6;
                        }
                    }
                    if(caseId < 12) {
                        if(caseId < 10){
                            if(caseId == 9){
                                return CASE9;
                            } else {
                                return CASE8;
                            }
                        }
                        if(caseId == 11){
                            return 0;
                            // return CASE11;
                        } else {
                            return CASE10;
                        }
                    }
                    if(caseId < 14){
                        if(caseId == 13){
                            return CASE13;
                        } else {
                            return CASE12;
                        }
                    }
                    if(caseId == 15) {
                        return 0;
                        // return CASE15;
                    } else {
                        return CASE14;
                    }
                }
                if(caseId < 24) {
                    if(caseId < 20){
                        if(caseId < 18){
                            if(caseId == 17){
                                return CASE17;
                            } else {
                                return CASE16;
                            }
                        }
                        if(caseId == 19) {
                            return 0;
                            // return CASE19;
                        } else {
                            return CASE18;
                        }
                    }
                    if(caseId < 22){
                        if(caseId == 21){
                            return CASE21;
                        } else {
                            return CASE20; 
                        }
                    }
                    if(caseId == 23){
                        return 0;
                        // return CASE23;
                    } else {
                        return CASE22;
                    }
                }
                if(caseId < 28) {
                    if(caseId < 26){
                        if(caseId == 25){
                            return CASE25;
                        } else {
                            return CASE24;
                        }
                    }
                    if(caseId == 27){
                        return 0;
                        // return CASE27;
                    } else {
                        return CASE26;
                    }
                }
                if(caseId < 30) {
                    if(caseId == 29) {
                        return CASE29;
                    } else {
                        return CASE28;
                    }
                }
                if(caseId == 31){
                    return 0;
                    // return CASE31;
                } else {
                    return CASE30;
                }
            }
            if(caseId < 48) {
                if(caseId < 40) {
                    if(caseId < 36){
                        if(caseId < 34){
                            if(caseId == 33){
                                return CASE33;
                            } else {
                                return CASE32;
                            }
                        } 
                        if(caseId == 35){
                            return 0;
                            // return CASE35;
                        } else {
                            return CASE34;
                        }
                    }
                    if(caseId < 38){
                        if(caseId == 37){
                            return CASE37;
                        } else {
                            return CASE36;
                        }
                    }
                    if(caseId == 39){
                        return 0;
                        // return CASE39;
                    } else {
                        return CASE38;
                    }
                }
                if(caseId < 44) {
                    if(caseId < 42){
                        if(caseId == 41){
                            return CASE41;
                        } else {
                            return CASE40;
                        }
                    }
                    if(caseId == 43){
                        return 0;
                        // return CASE43;
                    } else {
                        return CASE44;
                    }
                }
                if(caseId < 46){
                    if(caseId == 45){
                        return CASE45;
                    } else {
                        return CASE44;
                    }
                }
                if(caseId == 47) {
                    return 0;
                    // return CASE47;
                } else {
                    return CASE46;
                }
            }
            if(caseId < 56) {
                if(caseId < 52){
                    if(caseId < 50){
                        if(caseId == 49){
                            return CASE49;
                        } else {
                            return CASE48;
                        }
                    }
                    if(caseId == 51) {
                        return 0;
                        // return CASE51;
                    } else {
                        return CASE50;
                    }
                }
                if(caseId < 54){
                    if(caseId == 53){
                        return CASE53;
                    } else {
                        return CASE52; 
                    }
                }
                if(caseId == 55){
                    return 0;
                    // return CASE55;
                } else {
                    return CASE54;
                }
            }
            if(caseId < 60) {
                if(caseId < 58){
                    if(caseId == 57){
                        return CASE57;
                    } else {
                        return CASE56;
                    }
                }
                if(caseId == 59){
                    return 0;
                    // return CASE59;
                } else {
                    return CASE58;
                }
            }
            if(caseId < 62) {
                if(caseId == 61) {
                    return CASE61;
                } else {
                    return CASE60;
                }
            }
            if(caseId == 63){
                return 0;
                // return CASE63;
            } else {
                return CASE62;
            }
        }
        if(caseId < 96) {
            if(caseId < 80) {
                if(caseId < 72) {
                    if(caseId < 68){
                        if(caseId < 66){
                            if(caseId == 65){
                                return CASE65;
                            } else {
                                return CASE64;
                            }
                        } else {
                            return 0;
                            // return CASE67;
                        }
                    }
                    if(caseId < 70){
                        if(caseId == 69){
                            return CASE69;
                        } else {
                            return CASE68;
                        }
                    }
                    if(caseId == 71){
                        return 0;
                        // return CASE71;
                    } else {
                        return CASE70;
                    }
                }
                if(caseId < 76) {
                    if(caseId < 74){
                        if(caseId == 73){
                            return CASE73;
                        } else {
                            return CASE72;
                        }
                    }
                    if(caseId == 75){
                        return 0;
                        // return CASE75;
                    } else {
                        return CASE74;
                    }
                }
                if(caseId < 78){
                    if(caseId == 77){
                        return CASE77;
                    } else {
                        return CASE76;
                    }
                }
                if(caseId == 79) {
                    return 0;
                    // return CASE79;
                } else {
                    return CASE78;
                }
            }
            if(caseId < 88) {
                if(caseId < 84){
                    if(caseId < 82){
                        if(caseId == 81){
                            return CASE81;
                        } else {
                            return CASE80;
                        }
                    }
                    if(caseId == 83) {
                        return 0;
                        // return CASE83;
                    } else {
                        return CASE82;
                    }
                }
                if(caseId < 86){
                    if(caseId == 85){
                        return CASE85;
                    } else {
                        return CASE84; 
                    }
                }
                if(caseId == 87){
                    return 0;
                    // return CASE87;
                } else {
                    return CASE86;
                }
            }
            if(caseId < 92) {
                if(caseId < 90){
                    if(caseId == 89) {
                        return CASE89;
                    } else {
                        return CASE88;
                    }
                }
                if(caseId == 91){
                    return 0;
                    // return CASE91;
                } else {
                    return CASE90;
                }
            }
            if(caseId < 94) {
                if(caseId == 93) {
                    return CASE93;
                } else {
                    return CASE92;
                }
            }
            if(caseId == 95){
                return 0;
                // return CASE95;
            } else {
                return CASE94;
            }
        }
        if(caseId < 112) {
            if(caseId < 104) {
                if(caseId < 100){
                    if(caseId < 98){
                        if(caseId == 97){
                            return CASE97;
                        } else {
                            return CASE96;
                        }
                    }
                    if(caseId == 99){
                        return 0;
                        // return CASE99;
                    } else {
                        return CASE98;
                    }
                }
                if(caseId < 102){
                    if(caseId == 101){
                        return CASE101;
                    } else {
                        return CASE100;
                    }
                }
                if(caseId == 103){
                    return 0;
                    // return CASE103;
                } else {
                    return CASE102;
                }
            }
            if(caseId < 108) {
                if(caseId < 1061){
                    if(caseId == 105){
                        return CASE105;
                    } else {
                        return CASE104;
                    }
                }
                if(caseId == 107){
                    return 0;
                    // return CASE107;
                } else {
                    return CASE106;
                }
            }
            if(caseId < 110){
                if(caseId == 109){
                    return CASE109;
                } else {
                    return CASE108;
                }
            }
            if(caseId == 111) {
                return 0;
                // return CASE111;
            } else {
                return CASE110;
            }
        }
        if(caseId < 120) {
            if(caseId < 116){
                if(caseId < 114){
                    if(caseId == 113){
                        return CASE113;
                    } else {
                        return CASE112;
                    }
                }
                if(caseId == 115) {
                    return 0;
                    // return CASE115;
                } else {
                    return CASE114;
                }
            }
            if(caseId < 118){
                if(caseId == 117){
                    return CASE117;
                } else {
                    return CASE116; 
                }
            }
            if(caseId == 119){
                return 0;
                // return CASE119;
            } else {
                return CASE118;
            }
        }
        if(caseId < 124) {
            if(caseId < 122){
                if(caseId == 121){
                    return CASE121;
                } else {
                    return CASE120;
                }
            }
            if(caseId == 123){
                return 0;
                // return CASE123;
            } else {
                return CASE122;
            }
        }
        if(caseId < 126) {
            if(caseId == 125) {
                return CASE125;
            } else {
                return CASE124;
            }
        }
        if(caseId < 128){
            if(caseId == 127){
                return 0;
                // return CASE127;
            } else {
            return CASE126; 
        } 
        }
    }

    function decodeCaseData(uint256 caseId) 
    internal pure returns (
        uint24 mT,
        int8 bT,
        uint24 mL,
        int8 bL
    ) {
        bytes8 _caseData = getDataFromCase(caseId);
        mT = uint24(bytes3(_caseData));
        bT = int8(bytes1(_caseData << 24));
        mL = uint24(bytes3(_caseData << 32));
        bL = int8(bytes1(_caseData << 56));
    }
    
}