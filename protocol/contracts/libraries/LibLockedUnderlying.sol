// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {AppStorage, LibAppStorage} from "./LibAppStorage.sol";

/**
 * @title LibLockedUnderlying
 * @author Brendan
 * @notice Library to calculate the number of Underlying Tokens that would be locked if all of
 * the Unripe Tokens are Chopped.
 */
library LibLockedUnderlying {
    using SafeMath for uint256;

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
                .u[unripeToken]
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
        if (unripeSupply < 1_000_000) return 0; // If < 1_000_000 Assume all supply is unlocked.
        if (unripeSupply > 90_000_000) {
            if (recapPercentPaid > 0.1e6) {
                if (recapPercentPaid > 0.21e6) {
                    if (recapPercentPaid > 0.38e6) {
                        if (recapPercentPaid > 0.45e6) {
                            return 0.2691477202198985e18; // 90,000,000, 0.9
                        } else {
                            return 0.4245158057296602e18; // 90,000,000, 0.45
                        }
                    } else if (recapPercentPaid > 0.29e6) {
                        if (recapPercentPaid > 0.33e6) {
                            return 0.46634353868138156e18; // 90,000,000, 0.38
                        } else {
                            return 0.5016338055689489e18; // 90,000,000, 0.33
                        }
                    } else if (recapPercentPaid > 0.25e6) {
                        if (recapPercentPaid > 0.27e6) {
                            return 0.5339474169852891e18; // 90,000,000, 0.29
                        } else {
                            return 0.5517125463928281e18; // 90,000,000, 0.27
                        }
                    } else {
                        if (recapPercentPaid > 0.23e6) {
                            return 0.5706967827806866e18; // 90,000,000, 0.25
                        } else {
                            return 0.5910297971598633e18; // 90,000,000, 0.23
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.17e6) {
                        if (recapPercentPaid > 0.19e6) {
                            return 0.6128602937515535e18; // 90,000,000, 0.21
                        } else {
                            return 0.6363596297698088e18; // 90,000,000, 0.19
                        }
                    } else if (recapPercentPaid > 0.14e6) {
                        if (recapPercentPaid > 0.15e6) {
                            return 0.6617262928282552e18; // 90,000,000, 0.17
                        } else {
                            return 0.6891914824733962e18; // 90,000,000, 0.15
                        }
                    } else if (recapPercentPaid > 0.12e6) {
                        if (recapPercentPaid > 0.13e6) {
                            return 0.7037939098015373e18; // 90,000,000, 0.14
                        } else {
                            return 0.719026126689054e18; // 90,000,000, 0.13
                        }
                    } else {
                        if (recapPercentPaid > 0.11e6) {
                            return 0.7349296649399273e18; // 90,000,000, 0.12
                        } else {
                            return 0.7515497824365694e18; // 90,000,000, 0.11
                        }
                    }
                }
            } else {
                if (recapPercentPaid > 0.08e6) {
                    if (recapPercentPaid > 0.09e6) {
                        return 0.7689358898389307e18; // 90,000,000, 0.1
                    } else {
                        return 0.7871420372030031e18; // 90,000,000, 0.09
                    }
                } else if (recapPercentPaid > 0.06e6) {
                    if (recapPercentPaid > 0.07e6) {
                        return 0.8062274705566613e18; // 90,000,000, 0.08
                    } else {
                        return 0.8262572704372576e18; // 90,000,000, 0.07
                    }
                } else if (recapPercentPaid > 0.05e6) {
                    if (recapPercentPaid > 0.055e6) {
                        return 0.8473030868055568e18; // 90,000,000, 0.06
                    } else {
                        return 0.8582313943058512e18; // 90,000,000, 0.055
                    }
                } else if (recapPercentPaid > 0.04e6) {
                    if (recapPercentPaid > 0.045e6) {
                        return 0.8694439877186144e18; // 90,000,000, 0.05
                    } else {
                        return 0.8809520709014887e18; // 90,000,000, 0.045
                    }
                }
                if (recapPercentPaid > 0.03e6) {
                    if (recapPercentPaid > 0.035e6) {
                        return 0.892767442816813e18; // 90,000,000, 0.04
                    } else {
                        return 0.9049025374937268e18; // 90,000,000, 0.035
                    }
                } else if (recapPercentPaid > 0.02e6) {
                    if (recapPercentPaid > 0.025e6) {
                        return 0.9173704672485867e18; // 90,000,000, 0.03
                    } else {
                        return 0.9301850694774185e18; // 90,000,000, 0.025
                    }
                } else if (recapPercentPaid > 0.01e6) {
                    if (recapPercentPaid > 0.015e6) {
                        return 0.9433609573691148e18; // 90,000,000, 0.02
                    } else {
                        return 0.9569135749274008e18; // 90,000,000, 0.015
                    }
                } else {
                    if (recapPercentPaid > 0.005e6) {
                        return 0.9708592567341514e18; // 90,000,000, 0.01
                    } else {
                        return 0.9852152929368606e18; // 90,000,000, 0.005
                    }
                }
            }
        } else if (unripeSupply > 10_000_000) {
            if (recapPercentPaid > 0.1e6) {
                if (recapPercentPaid > 0.21e6) {
                    if (recapPercentPaid > 0.38e6) {
                        if (recapPercentPaid > 0.45e6) {
                            return 0.2601562129458128e18; // 10,000,000, 0.9
                        } else {
                            return 0.41636482361397587e18; // 10,000,000, 0.45
                        }
                    } else if (recapPercentPaid > 0.29e6) {
                        if (recapPercentPaid > 0.33e6) {
                            return 0.4587658967980477e18; // 10,000,000, 0.38
                        } else {
                            return 0.49461012289361284e18; // 10,000,000, 0.33
                        }
                    } else if (recapPercentPaid > 0.25e6) {
                        if (recapPercentPaid > 0.27e6) {
                            return 0.5274727741119862e18; // 10,000,000, 0.29
                        } else {
                            return 0.5455524222086705e18; // 10,000,000, 0.27
                        }
                    } else {
                        if (recapPercentPaid > 0.23e6) {
                            return 0.5648800673771895e18; // 10,000,000, 0.25
                        } else {
                            return 0.5855868704094357e18; // 10,000,000, 0.23
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.17e6) {
                        if (recapPercentPaid > 0.19e6) {
                            return 0.6078227259058706e18; // 10,000,000, 0.21
                        } else {
                            return 0.631759681239449e18; // 10,000,000, 0.19
                        }
                    } else if (recapPercentPaid > 0.14e6) {
                        if (recapPercentPaid > 0.15e6) {
                            return 0.6575961226208655e18; // 10,000,000, 0.17
                        } else {
                            return 0.68556193437231e18; // 10,000,000, 0.15
                        }
                    } else if (recapPercentPaid > 0.12e6) {
                        if (recapPercentPaid > 0.13e6) {
                            return 0.7004253506676488e18; // 10,000,000, 0.14
                        } else {
                            return 0.7159249025906607e18; // 10,000,000, 0.13
                        }
                    } else {
                        if (recapPercentPaid > 0.11e6) {
                            return 0.7321012978270447e18; // 10,000,000, 0.12
                        } else {
                            return 0.7489987232590216e18; // 10,000,000, 0.11
                        }
                    }
                }
            } else {
                if (recapPercentPaid > 0.08e6) {
                    if (recapPercentPaid > 0.09e6) {
                        return 0.766665218442354e18; // 10,000,000, 0.1
                    } else {
                        return 0.7851530975272665e18; // 10,000,000, 0.09
                    }
                } else if (recapPercentPaid > 0.06e6) {
                    if (recapPercentPaid > 0.07e6) {
                        return 0.8045194270172396e18; // 10,000,000, 0.08
                    } else {
                        return 0.8248265680621683e18; // 10,000,000, 0.07
                    }
                } else if (recapPercentPaid > 0.05e6) {
                    if (recapPercentPaid > 0.055e6) {
                        return 0.8461427935458878e18; // 10,000,000, 0.06
                    } else {
                        return 0.8572024359670631e18; // 10,000,000, 0.055
                    }
                } else if (recapPercentPaid > 0.04e6) {
                    if (recapPercentPaid > 0.045e6) {
                        return 0.8685429921113414e18; // 10,000,000, 0.05
                    } else {
                        return 0.8801749888510111e18; // 10,000,000, 0.045
                    }
                }
                if (recapPercentPaid > 0.03e6) {
                    if (recapPercentPaid > 0.035e6) {
                        return 0.8921094735432339e18; // 10,000,000, 0.04
                    } else {
                        return 0.9043580459814082e18; // 10,000,000, 0.035
                    }
                } else if (recapPercentPaid > 0.02e6) {
                    if (recapPercentPaid > 0.025e6) {
                        return 0.9169328926903124e18; // 10,000,000, 0.03
                    } else {
                        return 0.9298468237651341e18; // 10,000,000, 0.025
                    }
                } else if (recapPercentPaid > 0.01e6) {
                    if (recapPercentPaid > 0.015e6) {
                        return 0.9431133124739901e18; // 10,000,000, 0.02
                    } else if (recapPercentPaid > 0.01e6) {
                        return 0.956746537865208e18; // 10,000,000, 0.015
                    } else if (recapPercentPaid > 0.005e6) {
                        return 0.970761430644659e18; // 10,000,000, 0.01
                    } else {
                        return 0.9851737226151924e18; // 10,000,000, 0.005
                    }
                }
            }
        } else if (unripeSupply > 1_000_000) {
            if (recapPercentPaid > 0.1e6) {
                if (recapPercentPaid > 0.21e6) {
                    if (recapPercentPaid > 0.38e6) {
                        if (recapPercentPaid > 0.45e6) {
                            return 0.22204456672314377e18; // 1,000,000, 0.9
                        } else {
                            return 0.4085047499499631e18; // 1,000,000, 0.45
                        }
                    } else if (recapPercentPaid > 0.29e6) {
                        if (recapPercentPaid > 0.33e6) {
                            return 0.46027376814120946e18; // 1,000,000, 0.38
                        } else {
                            return 0.5034753937446597e18; // 1,000,000, 0.33
                        }
                    } else if (recapPercentPaid > 0.25e6) {
                        if (recapPercentPaid > 0.27e6) {
                            return 0.5424140302842413e18; // 1,000,000, 0.29
                        } else {
                            return 0.5635119158156667e18; // 1,000,000, 0.27
                        }
                    } else {
                        if (recapPercentPaid > 0.23e6) {
                            return 0.5857864256253713e18; // 1,000,000, 0.25
                        } else {
                            return 0.6093112868361505e18; // 1,000,000, 0.23
                        }
                    }
                } else {
                    if (recapPercentPaid > 0.17e6) {
                        if (recapPercentPaid > 0.19e6) {
                            return 0.6341650041820726e18; // 1,000,000, 0.21
                        } else {
                            return 0.6604311671564058e18; // 1,000,000, 0.19
                        }
                    } else if (recapPercentPaid > 0.14e6) {
                        if (recapPercentPaid > 0.15e6) {
                            return 0.6881987762208012e18; // 1,000,000, 0.17
                        } else {
                            return 0.7175625891924777e18; // 1,000,000, 0.15
                        }
                    } else if (recapPercentPaid > 0.12e6) {
                        if (recapPercentPaid > 0.13e6) {
                            return 0.7328743482797107e18; // 1,000,000, 0.14
                        } else {
                            return 0.7486234889866461e18; // 1,000,000, 0.13
                        }
                    } else {
                        if (recapPercentPaid > 0.11e6) {
                            return 0.7648236427602255e18; // 1,000,000, 0.12
                        } else {
                            return 0.7814888739548376e18; // 1,000,000, 0.11
                        }
                    }
                }
            } else {
                if (recapPercentPaid > 0.08e6) {
                    if (recapPercentPaid > 0.09e6) {
                        return 0.798633693358723e18; // 1,000,000, 0.1
                    } else {
                        return 0.8162730721263407e18; // 1,000,000, 0.09
                    }
                } else if (recapPercentPaid > 0.06e6) {
                    if (recapPercentPaid > 0.07e6) {
                        return 0.8344224561281671e18; // 1,000,000, 0.08
                    } else {
                        return 0.8530977807297004e18; // 1,000,000, 0.07
                    }
                } else if (recapPercentPaid > 0.05e6) {
                    if (recapPercentPaid > 0.055e6) {
                        return 0.8723154860117406e18; // 1,000,000, 0.06
                    } else {
                        return 0.8821330107890434e18; // 1,000,000, 0.055
                    }
                } else if (recapPercentPaid > 0.04e6) {
                    if (recapPercentPaid > 0.045e6) {
                        return 0.8920925324443344e18; // 1,000,000, 0.05
                    } else {
                        return 0.9021962549951718e18; // 1,000,000, 0.045
                    }
                }
                if (recapPercentPaid > 0.03e6) {
                    if (recapPercentPaid > 0.035e6) {
                        return 0.9124464170270961e18; // 1,000,000, 0.04
                    } else {
                        return 0.9228452922244391e18; // 1,000,000, 0.035
                    }
                } else if (recapPercentPaid > 0.02e6) {
                    if (recapPercentPaid > 0.025e6) {
                        return 0.9333951899089395e18; // 1,000,000, 0.03
                    } else {
                        return 0.9440984555862713e18; // 1,000,000, 0.025
                    }
                } else if (recapPercentPaid > 0.01e6) {
                    if (recapPercentPaid > 0.015e6) {
                        return 0.9549574715005937e18; // 1,000,000, 0.02
                    } else if (recapPercentPaid > 0.01e6) {
                        return 0.9659746571972349e18; // 1,000,000, 0.015
                    } else if (recapPercentPaid > 0.005e6) {
                        return 0.9771524700936202e18; // 1,000,000, 0.01
                    } else {
                        return 0.988493406058558e18; // 1,000,000, 0.005
                    }
                }
            }
        }
    }
}
