// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";

/**
 * @title LibLockedUnderlying
 * @author Brendan
 * @notice Library to calculate the number of Underlying Tokens that would be locked if all of
 * the Unripe Tokens are Chopped.
 */
library LibLockedUnderlying {
    using LibRedundantMath256 for uint256;

    uint256 constant DECIMALS = 1e6;

    /**
     * @notice Return the amount of Underlying Tokens that would be locked if all of the Unripe Tokens
     * were chopped.
     */
    function getLockedUnderlying(
        address unripeToken,
        uint256 recapPercentPaid
    ) external view returns (uint256 lockedUnderlying) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            s
                .sys
                .silo
                .unripeSettings[unripeToken]
                .balanceOfUnderlying
                .mul(getPercentLockedUnderlying(unripeToken, recapPercentPaid))
                .div(1e18);
    }

    /**
     * @notice Return the % of Underlying Tokens that would be locked if all of the Unripe Tokens
     * were chopped.
     * @param unripeToken The address of the Unripe Token
     * @param recapPercentPaid The % of Sprouts that have been Rinsed or are Rinsable.
     * Should have 6 decimal precision.
     *
     * @dev Solves the below equation for N_{⌈U/i⌉}:
     * N_{t+1} = N_t - i * R * N_t / (U - i * t)
     * where:
     *  - N_t is the number of Underlying Tokens at step t
     *  - U is the starting number of Unripe Tokens
     *  - R is the % of Sprouts that are Rinsable or Rinsed
     *  - i is the number of Unripe Beans that are chopped at each step. i ~= 46,659 is used as this is aboutr
     *    the average Unripe Beans held per Farmer with a non-zero balance.
     *
     * The equation is solved by using a lookup table of N_{⌈U/i⌉} values for different values of
     * U and R (The solution is independent of N) as solving iteratively is too computationally
     * expensive and there is no more efficient way to solve the equation.
     *
     * The lookup threshold assumes no decimal precision. This library only supports
     * unripe tokens with 6 decimals.
     */
    function getPercentLockedUnderlying(
        address unripeToken,
        uint256 recapPercentPaid
    ) private view returns (uint256 percentLockedUnderlying) {
        uint256 unripeSupply = IERC20(unripeToken).totalSupply().div(DECIMALS);
        if (unripeSupply < 1_000_000) return 0; // If < 1,000,000 Assume all supply is unlocked.
        if (unripeSupply > 5_000_000) {
            if (unripeSupply > 10_000_000) {
                if (recapPercentPaid > 0.1e6) {
                    if (recapPercentPaid > 0.21e6) {
                        if (recapPercentPaid > 0.38e6) {
                            if (recapPercentPaid > 0.45e6) {
                                return 0.000106800755371506e18; // 90,000,000, 0.9
                            } else {
                                return 0.019890729697455534e18; // 90,000,000, 0.45
                            }
                        } else if (recapPercentPaid > 0.29e6) {
                            if (recapPercentPaid > 0.33e6) {
                                return 0.038002726385307994e18; // 90,000,000 0.38
                            } else {
                                return 0.05969915165233464e18; // 90,000,000 0.33
                            }
                        } else if (recapPercentPaid > 0.25e6) {
                            if (recapPercentPaid > 0.27e6) {
                                return 0.08520038853809475e18; // 90,000,000 0.29
                            } else {
                                return 0.10160827712172482e18; // 90,000,000 0.27
                            }
                        } else {
                            if (recapPercentPaid > 0.23e6) {
                                return 0.1210446758987509e18; // 90,000,000 0.25
                            } else {
                                return 0.14404919400935834e18; // 90,000,000 0.23
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.17e6) {
                            if (recapPercentPaid > 0.19e6) {
                                return 0.17125472579906187e18; // 90,000,000, 0.21
                            } else {
                                return 0.2034031571094802e18; // 90,000,000, 0.19
                            }
                        } else if (recapPercentPaid > 0.14e6) {
                            if (recapPercentPaid > 0.15e6) {
                                return 0.24136365460186238e18; // 90,000,000 0.17
                            } else {
                                return 0.2861539540121635e18; // 90,000,000 0.15
                            }
                        } else if (recapPercentPaid > 0.12e6) {
                            if (recapPercentPaid > 0.13e6) {
                                return 0.3114749615435798e18; // 90,000,000 0.14
                            } else {
                                return 0.3389651289211062e18; // 90,000,000 0.13
                            }
                        } else {
                            if (recapPercentPaid > 0.11e6) {
                                return 0.3688051484970447e18; // 90,000,000 0.12
                            } else {
                                return 0.4011903974987394e18; // 90,000,000 0.11
                            }
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.04e6) {
                        if (recapPercentPaid > 0.08e6) {
                            if (recapPercentPaid > 0.09e6) {
                                return 0.4363321054081788e18; // 90,000,000, 0.1
                            } else {
                                return 0.4744586123058411e18; // 90,000,000, 0.09
                            }
                        } else if (recapPercentPaid > 0.06e6) {
                            if (recapPercentPaid > 0.07e6) {
                                return 0.5158167251384363e18; // 90,000,000 0.08
                            } else {
                                return 0.560673179393784e18; // 90,000,000 0.07
                            }
                        } else if (recapPercentPaid > 0.05e6) {
                            if (recapPercentPaid > 0.055e6) {
                                return 0.6093162142284054e18; // 90,000,000 0.06
                            } else {
                                return 0.6351540690346162e18; // 90,000,000 0.055
                            }
                        } else {
                            if (recapPercentPaid > 0.045e6) {
                                return 0.6620572696973799e18; // 90,000,000 0.05
                            } else {
                                return 0.6900686713435757e18; // 90,000,000 0.045
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.03e6) {
                            if (recapPercentPaid > 0.035e6) {
                                return 0.7192328153846157e18; // 90,000,000, 0.04
                            } else {
                                return 0.7495959945573412e18; // 90,000,000, 0.035
                            }
                        } else if (recapPercentPaid > 0.02e6) {
                            if (recapPercentPaid > 0.025e6) {
                                return 0.7812063204281795e18; // 90,000,000 0.03
                            } else {
                                return 0.8141137934523504e18; // 90,000,000 0.025
                            }
                        } else if (recapPercentPaid > 0.01e6) {
                            if (recapPercentPaid > 0.015e6) {
                                return 0.8483703756831885e18; // 90,000,000 0.02
                            } else {
                                return 0.8840300662301638e18; // 90,000,000 0.015
                            }
                        } else {
                            if (recapPercentPaid > 0.005e6) {
                                return 0.921148979567821e18; // 90,000,000 0.01
                            } else {
                                return 0.9597854268015467e18; // 90,000,000 0.005
                            }
                        }
                    }
                }
            } else {
                // > 5,000,000
                if (recapPercentPaid > 0.1e6) {
                    if (recapPercentPaid > 0.21e6) {
                        if (recapPercentPaid > 0.38e6) {
                            if (recapPercentPaid > 0.45e6) {
                                return 0.000340444522821781e18; // 10,000,000, 0.9
                            } else {
                                return 0.04023093970853808e18; // 10,000,000, 0.45
                            }
                        } else if (recapPercentPaid > 0.29e6) {
                            if (recapPercentPaid > 0.33e6) {
                                return 0.06954881077191022e18; // 10,000,000 0.38
                            } else {
                                return 0.10145116013499655e18; // 10,000,000 0.33
                            }
                        } else if (recapPercentPaid > 0.25e6) {
                            if (recapPercentPaid > 0.27e6) {
                                return 0.13625887314323348e18; // 10,000,000 0.29
                            } else {
                                return 0.15757224609763754e18; // 10,000,000 0.27
                            }
                        } else {
                            if (recapPercentPaid > 0.23e6) {
                                return 0.18197183407669726e18; // 10,000,000 0.25
                            } else {
                                return 0.20987581330872107e18; // 10,000,000 0.23
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.17e6) {
                            if (recapPercentPaid > 0.19e6) {
                                return 0.24175584233885106e18; // 10,000,000, 0.21
                            } else {
                                return 0.27814356260741413e18; // 10,000,000, 0.19
                            }
                        } else if (recapPercentPaid > 0.14e6) {
                            if (recapPercentPaid > 0.15e6) {
                                return 0.3196378540296301e18; // 10,000,000 0.17
                            } else {
                                return 0.36691292973511136e18; // 10,000,000 0.15
                            }
                        } else if (recapPercentPaid > 0.1e6) {
                            if (recapPercentPaid > 0.13e6) {
                                return 0.3929517529835418e18; // 10,000,000 0.14
                            } else {
                                return 0.4207273631610372e18; // 10,000,000 0.13
                            }
                        } else {
                            if (recapPercentPaid > 0.11e6) {
                                return 0.450349413795883e18; // 10,000,000 0.12
                            } else {
                                return 0.4819341506654745e18; // 10,000,000 0.11
                            }
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.04e6) {
                        if (recapPercentPaid > 0.08e6) {
                            if (recapPercentPaid > 0.09e6) {
                                return 0.5156047910307769e18; // 10,000,000, 0.1
                            } else {
                                return 0.551491923831086e18; // 10,000,000, 0.09
                            }
                        } else if (recapPercentPaid > 0.06e6) {
                            if (recapPercentPaid > 0.07e6) {
                                return 0.5897339319558434e18; // 10,000,000 0.08
                            } else {
                                return 0.6304774377677631e18; // 10,000,000 0.07
                            }
                        } else if (recapPercentPaid > 0.05e6) {
                            if (recapPercentPaid > 0.055e6) {
                                return 0.6738777731119263e18; // 10,000,000 0.06
                            } else {
                                return 0.6966252960203008e18; // 10,000,000 0.055
                            }
                        } else {
                            if (recapPercentPaid > 0.045e6) {
                                return 0.7200994751088836e18; // 10,000,000 0.05
                            } else {
                                return 0.7443224016328813e18; // 10,000,000 0.045
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.03e6) {
                            if (recapPercentPaid > 0.035e6) {
                                return 0.7693168090963867e18; // 10,000,000, 0.04
                            } else {
                                return 0.7951060911805916e18; // 10,000,000, 0.035
                            }
                        } else if (recapPercentPaid > 0.02e6) {
                            if (recapPercentPaid > 0.025e6) {
                                return 0.8217143201541763e18; // 10,000,000 0.03
                            } else {
                                return 0.8491662657783823e18; // 10,000,000 0.025
                            }
                        } else if (recapPercentPaid > 0.01e6) {
                            if (recapPercentPaid > 0.015e6) {
                                return 0.8774874147196358e18; // 10,000,000 0.02
                            } else {
                                return 0.9067039904828691e18; // 10,000,000 0.015
                            }
                        } else {
                            if (recapPercentPaid > 0.005e6) {
                                return 0.9368429738790524e18; // 10,000,000 0.01
                            } else {
                                return 0.9679321240407666e18; // 10,000,000 0.005
                            }
                        }
                    }
                }
            }
        } else {
            if (unripeSupply > 1_000_000) {
                if (recapPercentPaid > 0.1e6) {
                    if (recapPercentPaid > 0.21e6) {
                        if (recapPercentPaid > 0.38e6) {
                            if (recapPercentPaid > 0.45e6) {
                                return 0.000946395082480844e18; // 3,000,000, 0.9
                            } else {
                                return 0.06786242725985348e18; // 3,000,000, 0.45
                            }
                        } else if (recapPercentPaid > 0.29e6) {
                            if (recapPercentPaid > 0.33e6) {
                                return 0.10822315472628707e18; // 3,000,000 0.38
                            } else {
                                return 0.14899524306327216e18; // 3,000,000 0.33
                            }
                        } else if (recapPercentPaid > 0.25e6) {
                            if (recapPercentPaid > 0.27e6) {
                                return 0.1910488239684135e18; // 3,000,000 0.29
                            } else {
                                return 0.215863137234529e18; // 3,000,000 0.27
                            }
                        } else {
                            if (recapPercentPaid > 0.23e6) {
                                return 0.243564628757033e18; // 3,000,000 0.25
                            } else {
                                return 0.2744582675491247e18; // 3,000,000 0.23
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.17e6) {
                            if (recapPercentPaid > 0.19e6) {
                                return 0.3088786047254358e18; // 3,000,000, 0.21
                            } else {
                                return 0.3471924328319608e18; // 3,000,000, 0.19
                            }
                        } else if (recapPercentPaid > 0.14e6) {
                            if (recapPercentPaid > 0.15e6) {
                                return 0.38980166833777796e18; // 3,000,000 0.17
                            } else {
                                return 0.4371464748698771e18; // 3,000,000 0.15
                            }
                        } else if (recapPercentPaid > 0.12e6) {
                            if (recapPercentPaid > 0.13e6) {
                                return 0.46274355346663876e18; // 3,000,000 0.14
                            } else {
                                return 0.4897086460787351e18; // 3,000,000 0.13
                            }
                        } else {
                            if (recapPercentPaid > 0.11e6) {
                                return 0.518109082463349e18; // 3,000,000 0.12
                            } else {
                                return 0.5480152684204499e18; // 3,000,000 0.11
                            }
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.04e6) {
                        if (recapPercentPaid > 0.08e6) {
                            if (recapPercentPaid > 0.09e6) {
                                return 0.5795008171102514e18; // 3,000,000, 0.1
                            } else {
                                return 0.6126426856374751e18; // 3,000,000, 0.09
                            }
                        } else if (recapPercentPaid > 0.06e6) {
                            if (recapPercentPaid > 0.07e6) {
                                return 0.6475213171017626e18; // 3,000,000 0.08
                            } else {
                                return 0.6842207883207123e18; // 3,000,000 0.07
                            }
                        } else if (recapPercentPaid > 0.05e6) {
                            if (recapPercentPaid > 0.055e6) {
                                return 0.7228289634394097e18; // 3,000,000 0.06
                            } else {
                                return 0.742877347280416e18; // 3,000,000 0.055
                            }
                        } else {
                            if (recapPercentPaid > 0.045e6) {
                                return 0.7634376536479606e18; // 3,000,000 0.05
                            } else {
                                return 0.784522002909275e18; // 3,000,000 0.045
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.03e6) {
                            if (recapPercentPaid > 0.035e6) {
                                return 0.8061427832364296e18; // 3,000,000, 0.04
                            } else {
                                return 0.8283126561589187e18; // 3,000,000, 0.035
                            }
                        } else if (recapPercentPaid > 0.02e6) {
                            if (recapPercentPaid > 0.025e6) {
                                return 0.8510445622247672e18; // 3,000,000 0.03
                            } else {
                                return 0.8743517267721741e18; // 3,000,000 0.025
                            }
                        } else if (recapPercentPaid > 0.01e6) {
                            if (recapPercentPaid > 0.015e6) {
                                return 0.8982476658137254e18; // 3,000,000 0.02
                            } else {
                                return 0.9227461920352636e18; // 3,000,000 0.015
                            }
                        } else {
                            if (recapPercentPaid > 0.005e6) {
                                return 0.9478614209115208e18; // 3,000,000 0.01
                            } else {
                                return 0.9736077769406731e18; // 3,000,000 0.005
                            }
                        }
                    }
                }
            } else {
                if (recapPercentPaid > 0.1e6) {
                    if (recapPercentPaid > 0.21e6) {
                        if (recapPercentPaid > 0.38e6) {
                            if (recapPercentPaid > 0.45e6) {
                                return 0.003360632002379016e18; // 1,000,000, 0.9
                            } else {
                                return 0.12071031956650236e18; // 1,000,000, 0.45
                            }
                        } else if (recapPercentPaid > 0.29e6) {
                            if (recapPercentPaid > 0.33e6) {
                                return 0.1752990554517151e18; // 1,000,000 0.38
                            } else {
                                return 0.22598948369141458e18; // 1,000,000 0.33
                            }
                        } else if (recapPercentPaid > 0.25e6) {
                            if (recapPercentPaid > 0.27e6) {
                                return 0.27509697387157794e18; // 1,000,000 0.29
                            } else {
                                return 0.3029091410266461e18; // 1,000,000 0.27
                            }
                        } else {
                            if (recapPercentPaid > 0.23e6) {
                                return 0.33311222196618273e18; // 1,000,000 0.25
                            } else {
                                return 0.36588364748950297e18; // 1,000,000 0.23
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.17e6) {
                            if (recapPercentPaid > 0.19e6) {
                                return 0.40141235983370593e18; // 1,000,000, 0.21
                            } else {
                                return 0.43989947169522015e18; // 1,000,000, 0.19
                            }
                        } else if (recapPercentPaid > 0.14e6) {
                            if (recapPercentPaid > 0.15e6) {
                                return 0.4815589587559236e18; // 1,000,000 0.17
                            } else {
                                return 0.5266183872325827e18; // 1,000,000 0.15
                            }
                        } else if (recapPercentPaid > 0.12e6) {
                            if (recapPercentPaid > 0.13e6) {
                                return 0.5504980973828455e18; // 1,000,000 0.14
                            } else {
                                return 0.5753196780298556e18; // 1,000,000 0.13
                            }
                        } else {
                            if (recapPercentPaid > 0.11e6) {
                                return 0.6011157438454372e18; // 1,000,000 0.12
                            } else {
                                return 0.6279199091408495e18; // 1,000,000 0.11
                            }
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.04e6) {
                        if (recapPercentPaid > 0.08e6) {
                            if (recapPercentPaid > 0.09e6) {
                                return 0.6557668151543954e18; // 1,000,000, 0.1
                            } else {
                                return 0.6846921580052533e18; // 1,000,000, 0.09
                            }
                        } else if (recapPercentPaid > 0.06e6) {
                            if (recapPercentPaid > 0.07e6) {
                                return 0.7147327173281093e18; // 1,000,000 0.08
                            } else {
                                return 0.745926385603471e18; // 1,000,000 0.07
                            }
                        } else if (recapPercentPaid > 0.05e6) {
                            if (recapPercentPaid > 0.055e6) {
                                return 0.7783121981988174e18; // 1,000,000 0.06
                            } else {
                                return 0.7949646772335068e18; // 1,000,000 0.055
                            }
                        } else {
                            if (recapPercentPaid > 0.045e6) {
                                return 0.8119303641360465e18; // 1,000,000 0.05
                            } else {
                                return 0.8292144735871585e18; // 1,000,000 0.045
                            }
                        }
                    } else {
                        if (recapPercentPaid > 0.03e6) {
                            if (recapPercentPaid > 0.035e6) {
                                return 0.8468222976009872e18; // 1,000,000, 0.04
                            } else {
                                return 0.8647592065514869e18; // 1,000,000, 0.035
                            }
                        } else if (recapPercentPaid > 0.02e6) {
                            if (recapPercentPaid > 0.025e6) {
                                return 0.8830306502110374e18; // 1,000,000 0.03
                            } else {
                                return 0.9016421588014247e18; // 1,000,000 0.025
                            }
                        } else if (recapPercentPaid > 0.01e6) {
                            if (recapPercentPaid > 0.015e6) {
                                return 0.9205993440573136e18; // 1,000,000 0.02
                            } else {
                                return 0.9399079003023474e18; // 1,000,000 0.015
                            }
                        } else {
                            if (recapPercentPaid > 0.005e6) {
                                return 0.959573605538012e18; // 1,000,000 0.01
                            } else {
                                return 0.9796023225453983e18; // 1,000,000 0.005
                            }
                        }
                    }
                }
            }
        }
    }
}
