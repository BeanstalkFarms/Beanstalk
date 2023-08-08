// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
import {LibAppStorage, AppStorage} from "../LibAppStorage.sol";
import {Decimal, SafeMath} from "../Decimal.sol";
import "../LibSafeMath32.sol";
import "../Cases/LibConstantCases.sol";


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

    function getDataFromCase(uint256 caseId) internal pure returns (bytes8 caseData) {
        if (caseId < 64) {
            if (caseId < 32) {
                if (caseId < 16) {
                    if (caseId < 8) {
                        if (caseId < 4) {
                            if (caseId < 2) {
                                if (caseId == 1) {
                                    return LibConstantCases.CASE1;
                                } else {
                                    return LibConstantCases.CASE0;
                                }
                            } else {
                                if (caseId == 3) {
                                    return 0;
                                    // return LibConstantCases.CASE3;
                                } else {
                                    return LibConstantCases.CASE2;
                                }
                            }
                        }
                        if (caseId < 6) {
                            if (caseId == 5) {
                                return LibConstantCases.CASE5;
                            } else {
                                return LibConstantCases.CASE4;
                            }
                        }
                        if (caseId == 7) {
                            return 0;
                            // return LibConstantCases.CASE7;
                        } else {
                            return LibConstantCases.CASE6;
                        }
                    }
                    if (caseId < 12) {
                        if (caseId < 10) {
                            if (caseId == 9) {
                                return LibConstantCases.CASE9;
                            } else {
                                return LibConstantCases.CASE8;
                            }
                        }
                        if (caseId == 11) {
                            return 0;
                            // return LibConstantCases.CASE11;
                        } else {
                            return LibConstantCases.CASE10;
                        }
                    }
                    if (caseId < 14) {
                        if (caseId == 13) {
                            return LibConstantCases.CASE13;
                        } else {
                            return LibConstantCases.CASE12;
                        }
                    }
                    if (caseId == 15) {
                        return 0;
                        // return LibConstantCases.CASE15;
                    } else {
                        return LibConstantCases.CASE14;
                    }
                }
                if (caseId < 24) {
                    if (caseId < 20) {
                        if (caseId < 18) {
                            if (caseId == 17) {
                                return LibConstantCases.CASE17;
                            } else {
                                return LibConstantCases.CASE16;
                            }
                        }
                        if (caseId == 19) {
                            return 0;
                            // return LibConstantCases.CASE19;
                        } else {
                            return LibConstantCases.CASE18;
                        }
                    }
                    if (caseId < 22) {
                        if (caseId == 21) {
                            return LibConstantCases.CASE21;
                        } else {
                            return LibConstantCases.CASE20; 
                        }
                    }
                    if (caseId == 23) {
                        return 0;
                        // return LibConstantCases.CASE23;
                    } else {
                        return LibConstantCases.CASE22;
                    }
                }
                if (caseId < 28) {
                    if (caseId < 26) {
                        if (caseId == 25) {
                            return LibConstantCases.CASE25;
                        } else {
                            return LibConstantCases.CASE24;
                        }
                    }
                    if (caseId == 27) {
                        return 0;
                        // return LibConstantCases.CASE27;
                    } else {
                        return LibConstantCases.CASE26;
                    }
                }
                if (caseId < 30) {
                    if (caseId == 29) {
                        return LibConstantCases.CASE29;
                    } else {
                        return LibConstantCases.CASE28;
                    }
                }
                if (caseId == 31) {
                    return 0;
                    // return LibConstantCases.CASE31;
                } else {
                    return LibConstantCases.CASE30;
                }
            }
            if (caseId < 48) {
                if (caseId < 40) {
                    if (caseId < 36) {
                        if (caseId < 34) {
                            if (caseId == 33) {
                                return LibConstantCases.CASE33;
                            } else {
                                return LibConstantCases.CASE32;
                            }
                        } 
                        if (caseId == 35) {
                            return 0;
                            // return LibConstantCases.CASE35;
                        } else {
                            return LibConstantCases.CASE34;
                        }
                    }
                    if (caseId < 38) {
                        if (caseId == 37) {
                            return LibConstantCases.CASE37;
                        } else {
                            return LibConstantCases.CASE36;
                        }
                    }
                    if (caseId == 39) {
                        return 0;
                        // return LibConstantCases.CASE39;
                    } else {
                        return LibConstantCases.CASE38;
                    }
                }
                if (caseId < 44) {
                    if (caseId < 42) {
                        if (caseId == 41) {
                            return LibConstantCases.CASE41;
                        } else {
                            return LibConstantCases.CASE40;
                        }
                    }
                    if (caseId == 43) {
                        return 0;
                        // return LibConstantCases.CASE43;
                    } else {
                        return LibConstantCases.CASE44;
                    }
                }
                if (caseId < 46) {
                    if (caseId == 45) {
                        return LibConstantCases.CASE45;
                    } else {
                        return LibConstantCases.CASE44;
                    }
                }
                if (caseId == 47) {
                    return 0;
                    // return LibConstantCases.CASE47;
                } else {
                    return LibConstantCases.CASE46;
                }
            }
            if (caseId < 56) {
                if (caseId < 52) {
                    if (caseId < 50) {
                        if (caseId == 49) {
                            return LibConstantCases.CASE49;
                        } else {
                            return LibConstantCases.CASE48;
                        }
                    }
                    if (caseId == 51) {
                        return 0;
                        // return LibConstantCases.CASE51;
                    } else {
                        return LibConstantCases.CASE50;
                    }
                }
                if (caseId < 54) {
                    if (caseId == 53) {
                        return LibConstantCases.CASE53;
                    } else {
                        return LibConstantCases.CASE52; 
                    }
                }
                if (caseId == 55) {
                    return 0;
                    // return LibConstantCases.CASE55;
                } else {
                    return LibConstantCases.CASE54;
                }
            }
            if (caseId < 60) {
                if (caseId < 58) {
                    if (caseId == 57) {
                        return LibConstantCases.CASE57;
                    } else {
                        return LibConstantCases.CASE56;
                    }
                }
                if (caseId == 59) {
                    return 0;
                    // return LibConstantCases.CASE59;
                } else {
                    return LibConstantCases.CASE58;
                }
            }
            if (caseId < 62) {
                if (caseId == 61) {
                    return LibConstantCases.CASE61;
                } else {
                    return LibConstantCases.CASE60;
                }
            }
            if (caseId == 63) {
                return 0;
                // return LibConstantCases.CASE63;
            } else {
                return LibConstantCases.CASE62;
            }
        }
        if (caseId < 96) {
            if (caseId < 80) {
                if (caseId < 72) {
                    if (caseId < 68) {
                        if (caseId < 66) {
                            if (caseId == 65) {
                                return LibConstantCases.CASE65;
                            } else {
                                return LibConstantCases.CASE64;
                            }
                        } else {
                            return 0;
                            // return LibConstantCases.CASE67;
                        }
                    }
                    if (caseId < 70) {
                        if (caseId == 69) {
                            return LibConstantCases.CASE69;
                        } else {
                            return LibConstantCases.CASE68;
                        }
                    }
                    if (caseId == 71) {
                        return 0;
                        // return LibConstantCases.CASE71;
                    } else {
                        return LibConstantCases.CASE70;
                    }
                }
                if (caseId < 76) {
                    if (caseId < 74) {
                        if (caseId == 73) {
                            return LibConstantCases.CASE73;
                        } else {
                            return LibConstantCases.CASE72;
                        }
                    }
                    if (caseId == 75) {
                        return 0;
                        // return LibConstantCases.CASE75;
                    } else {
                        return LibConstantCases.CASE74;
                    }
                }
                if (caseId < 78) {
                    if (caseId == 77) {
                        return LibConstantCases.CASE77;
                    } else {
                        return LibConstantCases.CASE76;
                    }
                }
                if (caseId == 79) {
                    return 0;
                    // return LibConstantCases.CASE79;
                } else {
                    return LibConstantCases.CASE78;
                }
            }
            if (caseId < 88) {
                if (caseId < 84) {
                    if (caseId < 82) {
                        if (caseId == 81) {
                            return LibConstantCases.CASE81;
                        } else {
                            return LibConstantCases.CASE80;
                        }
                    }
                    if (caseId == 83) {
                        return 0;
                        // return LibConstantCases.CASE83;
                    } else {
                        return LibConstantCases.CASE82;
                    }
                }
                if (caseId < 86) {
                    if (caseId == 85) {
                        return LibConstantCases.CASE85;
                    } else {
                        return LibConstantCases.CASE84; 
                    }
                }
                if (caseId == 87) {
                    return 0;
                    // return LibConstantCases.CASE87;
                } else {
                    return LibConstantCases.CASE86;
                }
            }
            if (caseId < 92) {
                if (caseId < 90) {
                    if (caseId == 89) {
                        return LibConstantCases.CASE89;
                    } else {
                        return LibConstantCases.CASE88;
                    }
                }
                if (caseId == 91) {
                    return 0;
                    // return LibConstantCases.CASE91;
                } else {
                    return LibConstantCases.CASE90;
                }
            }
            if (caseId < 94) {
                if (caseId == 93) {
                    return LibConstantCases.CASE93;
                } else {
                    return LibConstantCases.CASE92;
                }
            }
            if (caseId == 95) {
                return 0;
                // return LibConstantCases.CASE95;
            } else {
                return LibConstantCases.CASE94;
            }
        }
        if (caseId < 112) {
            if (caseId < 104) {
                if (caseId < 100) {
                    if (caseId < 98) {
                        if (caseId == 97) {
                            return LibConstantCases.CASE97;
                        } else {
                            return LibConstantCases.CASE96;
                        }
                    }
                    if (caseId == 99) {
                        return 0;
                        // return LibConstantCases.CASE99;
                    } else {
                        return LibConstantCases.CASE98;
                    }
                }
                if (caseId < 102) {
                    if (caseId == 101) {
                        return LibConstantCases.CASE101;
                    } else {
                        return LibConstantCases.CASE100;
                    }
                }
                if (caseId == 103) {
                    return 0;
                    // return LibConstantCases.CASE103;
                } else {
                    return LibConstantCases.CASE102;
                }
            }
            if (caseId < 108) {
                if (caseId < 1061) {
                    if (caseId == 105) {
                        return LibConstantCases.CASE105;
                    } else {
                        return LibConstantCases.CASE104;
                    }
                }
                if (caseId == 107) {
                    return 0;
                    // return LibConstantCases.CASE107;
                } else {
                    return LibConstantCases.CASE106;
                }
            }
            if (caseId < 110) {
                if (caseId == 109) {
                    return LibConstantCases.CASE109;
                } else {
                    return LibConstantCases.CASE108;
                }
            }
            if (caseId == 111) {
                return 0;
                // return LibConstantCases.CASE111;
            } else {
                return LibConstantCases.CASE110;
            }
        }
        if (caseId < 120) {
            if (caseId < 116) {
                if (caseId < 114) {
                    if (caseId == 113) {
                        return LibConstantCases.CASE113;
                    } else {
                        return LibConstantCases.CASE112;
                    }
                }
                if (caseId == 115) {
                    return 0;
                    // return LibConstantCases.CASE115;
                } else {
                    return LibConstantCases.CASE114;
                }
            }
            if (caseId < 118) {
                if (caseId == 117) {
                    return LibConstantCases.CASE117;
                } else {
                    return LibConstantCases.CASE116; 
                }
            }
            if (caseId == 119) {
                return 0;
                // return LibConstantCases.CASE119;
            } else {
                return LibConstantCases.CASE118;
            }
        }
        if (caseId < 124) {
            if (caseId < 122) {
                if (caseId == 121) {
                    return LibConstantCases.CASE121;
                } else {
                    return LibConstantCases.CASE120;
                }
            }
            if (caseId == 123) {
                return 0;
                // return LibConstantCases.CASE123;
            } else {
                return LibConstantCases.CASE122;
            }
        }
        if (caseId < 126) {
            if (caseId == 125) {
                return LibConstantCases.CASE125;
            } else {
                return LibConstantCases.CASE124;
            }
        }
        if (caseId < 128) {
            if (caseId == 127) {
                return 0;
                // return LibConstantCases.CASE127;
            } else {
                return LibConstantCases.CASE126; 
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