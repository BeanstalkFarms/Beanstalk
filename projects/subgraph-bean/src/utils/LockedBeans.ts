import { BigDecimal, BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  BEANSTALK,
  GAUGE_BIP45_BLOCK,
  UNRIPE_BEAN,
  UNRIPE_BEAN_3CRV
} from "../../../subgraph-core/utils/Constants";
import { SeedGauge } from "../../generated/Beanstalk/SeedGauge";
import { ONE_BI, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { ERC20 } from "../../generated/Beanstalk/ERC20";
import { Beanstalk } from "../../generated/Beanstalk/Beanstalk";
import { loadOrCreatePool } from "./Pool";
import { loadOrCreateTwaOracle } from "./price/TwaOracle";

export function calcLockedBeans(blockNumber: BigInt): BigInt {
  // If BIP45 is deployed - return the result from the contract
  if (blockNumber >= GAUGE_BIP45_BLOCK) {
    // If we are trying to calculate locked beans on the same block as the sunrise, use the values from the previous hour
    const twaOracle = loadOrCreateTwaOracle(getUnderlyingUnripe(blockNumber).toHexString());
    const twaReserves =
      blockNumber == twaOracle.cumulativeWellReservesBlock ? twaOracle.cumulativeWellReservesPrev : twaOracle.cumulativeWellReserves;
    const twaTime =
      blockNumber == twaOracle.cumulativeWellReservesBlock
        ? twaOracle.cumulativeWellReservesPrevTime
        : twaOracle.cumulativeWellReservesTime;

    let beanstalkBIP45 = SeedGauge.bind(BEANSTALK);
    let lockedBeans = beanstalkBIP45.try_getLockedBeansFromTwaReserves(twaReserves, twaTime);
    if (!lockedBeans.reverted) {
      return lockedBeans.value;
    }
  }

  // Pre-gauge there was no lockedBeans contract function, instead we recreate the same calculation.
  let beanstalk = Beanstalk.bind(BEANSTALK);
  const recapPercentResult = beanstalk.try_getRecapPaidPercent();
  if (recapPercentResult.reverted) {
    // This function was made available later in the Replant process, for a few hundred blocks it is unavailable
    return ZERO_BI;
  }

  const recapPaidPercent = new BigDecimal(recapPercentResult.value).div(BigDecimal.fromString("1000000"));
  const lockedBeansUrBean = LibLockedUnderlying_getLockedUnderlying(UNRIPE_BEAN, recapPaidPercent);
  const lockedUnripeLp = LibLockedUnderlying_getLockedUnderlying(UNRIPE_BEAN_3CRV, recapPaidPercent);
  const underlyingLpPool = getUnderlyingUnripe(blockNumber);

  const poolBeanReserves = loadOrCreatePool(underlyingLpPool.toHexString(), blockNumber).reserves[0];
  const totalLpTokens = ERC20.bind(getUnderlyingUnripe(blockNumber)).totalSupply();
  // Simplification here: does not account for twa reserves nor twa lp tokens
  const lockedBeansUrLP = lockedUnripeLp.times(poolBeanReserves).div(totalLpTokens);

  return lockedBeansUrBean.plus(lockedBeansUrLP);
}

function getUnderlyingUnripe(blockNumber: BigInt): Address {
  if (blockNumber < BEAN_WETH_UNRIPE_MIGRATION_BLOCK) {
    return BEAN_3CRV;
  } else {
    return BEAN_WETH_CP2_WELL;
  }
}

export function LibLockedUnderlying_getLockedUnderlying(unripeToken: Address, recapPercentPaid: BigDecimal): BigInt {
  const balanceOfUnderlying = Beanstalk.bind(BEANSTALK).getTotalUnderlying(unripeToken);
  const percentLocked = LibLockedUnderlying_getPercentLockedUnderlying(unripeToken, recapPercentPaid);
  return BigInt.fromString(new BigDecimal(balanceOfUnderlying).times(percentLocked).truncate(0).toString());
}

// Returns a fraction of the underlying token that is locked for the given unripe token at this recap percent
// Compared to the contract's implementation, the result already has div 1e18 applied.
export function LibLockedUnderlying_getPercentLockedUnderlying(unripeToken: Address, recapPercentPaid: BigDecimal): BigDecimal {
  const unripeSupply = ERC20.bind(unripeToken).totalSupply().div(BigInt.fromString("1000000"));
  if (unripeSupply < BigInt.fromString("1000000")) {
    return ZERO_BD; // If < 1,000,000 Assume all supply is unlocked.
  }
  if (unripeSupply > BigInt.fromString("5000000")) {
    if (unripeSupply > BigInt.fromString("10000000")) {
      if (recapPercentPaid > BigDecimal.fromString("0.1")) {
        if (recapPercentPaid > BigDecimal.fromString("0.21")) {
          if (recapPercentPaid > BigDecimal.fromString("0.38")) {
            if (recapPercentPaid > BigDecimal.fromString("0.45")) {
              return BigDecimal.fromString("0.000106800755371506"); // 90,000,000, 0.9
            } else {
              return BigDecimal.fromString("0.019890729697455534"); // 90,000,000, 0.45
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.29")) {
            if (recapPercentPaid > BigDecimal.fromString("0.33")) {
              return BigDecimal.fromString("0.038002726385307994"); // 90,000,000 0.38
            } else {
              return BigDecimal.fromString("0.05969915165233464"); // 90,000,000 0.33
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.25")) {
            if (recapPercentPaid > BigDecimal.fromString("0.27")) {
              return BigDecimal.fromString("0.08520038853809475"); // 90,000,000 0.29
            } else {
              return BigDecimal.fromString("0.10160827712172482"); // 90,000,000 0.27
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.23")) {
              return BigDecimal.fromString("0.1210446758987509"); // 90,000,000 0.25
            } else {
              return BigDecimal.fromString("0.14404919400935834"); // 90,000,000 0.23
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.17")) {
            if (recapPercentPaid > BigDecimal.fromString("0.19")) {
              return BigDecimal.fromString("0.17125472579906187"); // 90,000,000, 0.21
            } else {
              return BigDecimal.fromString("0.2034031571094802"); // 90,000,000, 0.19
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.14")) {
            if (recapPercentPaid > BigDecimal.fromString("0.15")) {
              return BigDecimal.fromString("0.24136365460186238"); // 90,000,000 0.17
            } else {
              return BigDecimal.fromString("0.2861539540121635"); // 90,000,000 0.15
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.12")) {
            if (recapPercentPaid > BigDecimal.fromString("0.13")) {
              return BigDecimal.fromString("0.3114749615435798"); // 90,000,000 0.14
            } else {
              return BigDecimal.fromString("0.3389651289211062"); // 90,000,000 0.13
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.11")) {
              return BigDecimal.fromString("0.3688051484970447"); // 90,000,000 0.12
            } else {
              return BigDecimal.fromString("0.4011903974987394"); // 90,000,000 0.11
            }
          }
        }
      } else {
        if (recapPercentPaid > BigDecimal.fromString("0.04")) {
          if (recapPercentPaid > BigDecimal.fromString("0.08")) {
            if (recapPercentPaid > BigDecimal.fromString("0.09")) {
              return BigDecimal.fromString("0.4363321054081788"); // 90,000,000, 0.1
            } else {
              return BigDecimal.fromString("0.4744586123058411"); // 90,000,000, 0.09
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.06")) {
            if (recapPercentPaid > BigDecimal.fromString("0.07")) {
              return BigDecimal.fromString("0.5158167251384363"); // 90,000,000 0.08
            } else {
              return BigDecimal.fromString("0.560673179393784"); // 90,000,000 0.07
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.05")) {
            if (recapPercentPaid > BigDecimal.fromString("0.055")) {
              return BigDecimal.fromString("0.6093162142284054"); // 90,000,000 0.06
            } else {
              return BigDecimal.fromString("0.6351540690346162"); // 90,000,000 0.055
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.045")) {
              return BigDecimal.fromString("0.6620572696973799"); // 90,000,000 0.05
            } else {
              return BigDecimal.fromString("0.6900686713435757"); // 90,000,000 0.045
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.03")) {
            if (recapPercentPaid > BigDecimal.fromString("0.035")) {
              return BigDecimal.fromString("0.7192328153846157"); // 90,000,000, 0.04
            } else {
              return BigDecimal.fromString("0.7495959945573412"); // 90,000,000, 0.035
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.02")) {
            if (recapPercentPaid > BigDecimal.fromString("0.025")) {
              return BigDecimal.fromString("0.7812063204281795"); // 90,000,000 0.03
            } else {
              return BigDecimal.fromString("0.8141137934523504"); // 90,000,000 0.025
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.01")) {
            if (recapPercentPaid > BigDecimal.fromString("0.015")) {
              return BigDecimal.fromString("0.8483703756831885"); // 90,000,000 0.02
            } else {
              return BigDecimal.fromString("0.8840300662301638"); // 90,000,000 0.015
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.005")) {
              return BigDecimal.fromString("0.921148979567821"); // 90,000,000 0.01
            } else {
              return BigDecimal.fromString("0.9597854268015467"); // 90,000,000 0.005
            }
          }
        }
      }
    } else {
      // > 5,000,000
      if (recapPercentPaid > BigDecimal.fromString("0.1")) {
        if (recapPercentPaid > BigDecimal.fromString("0.21")) {
          if (recapPercentPaid > BigDecimal.fromString("0.38")) {
            if (recapPercentPaid > BigDecimal.fromString("0.45")) {
              return BigDecimal.fromString("0.000340444522821781"); // 10,000,000, 0.9
            } else {
              return BigDecimal.fromString("0.04023093970853808"); // 10,000,000, 0.45
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.29")) {
            if (recapPercentPaid > BigDecimal.fromString("0.33")) {
              return BigDecimal.fromString("0.06954881077191022"); // 10,000,000 0.38
            } else {
              return BigDecimal.fromString("0.10145116013499655"); // 10,000,000 0.33
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.25")) {
            if (recapPercentPaid > BigDecimal.fromString("0.27")) {
              return BigDecimal.fromString("0.13625887314323348"); // 10,000,000 0.29
            } else {
              return BigDecimal.fromString("0.15757224609763754"); // 10,000,000 0.27
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.23")) {
              return BigDecimal.fromString("0.18197183407669726"); // 10,000,000 0.25
            } else {
              return BigDecimal.fromString("0.20987581330872107"); // 10,000,000 0.23
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.17")) {
            if (recapPercentPaid > BigDecimal.fromString("0.19")) {
              return BigDecimal.fromString("0.24175584233885106"); // 10,000,000, 0.21
            } else {
              return BigDecimal.fromString("0.27814356260741413"); // 10,000,000, 0.19
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.14")) {
            if (recapPercentPaid > BigDecimal.fromString("0.15")) {
              return BigDecimal.fromString("0.3196378540296301"); // 10,000,000 0.17
            } else {
              return BigDecimal.fromString("0.36691292973511136"); // 10,000,000 0.15
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.1")) {
            if (recapPercentPaid > BigDecimal.fromString("0.13")) {
              return BigDecimal.fromString("0.3929517529835418"); // 10,000,000 0.14
            } else {
              return BigDecimal.fromString("0.4207273631610372"); // 10,000,000 0.13
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.11")) {
              return BigDecimal.fromString("0.450349413795883"); // 10,000,000 0.12
            } else {
              return BigDecimal.fromString("0.4819341506654745"); // 10,000,000 0.11
            }
          }
        }
      } else {
        if (recapPercentPaid > BigDecimal.fromString("0.04")) {
          if (recapPercentPaid > BigDecimal.fromString("0.08")) {
            if (recapPercentPaid > BigDecimal.fromString("0.09")) {
              return BigDecimal.fromString("0.5156047910307769"); // 10,000,000, 0.1
            } else {
              return BigDecimal.fromString("0.551491923831086"); // 10,000,000, 0.09
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.06")) {
            if (recapPercentPaid > BigDecimal.fromString("0.07")) {
              return BigDecimal.fromString("0.5897339319558434"); // 10,000,000 0.08
            } else {
              return BigDecimal.fromString("0.6304774377677631"); // 10,000,000 0.07
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.05")) {
            if (recapPercentPaid > BigDecimal.fromString("0.055")) {
              return BigDecimal.fromString("0.6738777731119263"); // 10,000,000 0.06
            } else {
              return BigDecimal.fromString("0.6966252960203008"); // 10,000,000 0.055
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.045")) {
              return BigDecimal.fromString("0.7200994751088836"); // 10,000,000 0.05
            } else {
              return BigDecimal.fromString("0.7443224016328813"); // 10,000,000 0.045
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.03")) {
            if (recapPercentPaid > BigDecimal.fromString("0.035")) {
              return BigDecimal.fromString("0.7693168090963867"); // 10,000,000, 0.04
            } else {
              return BigDecimal.fromString("0.7951060911805916"); // 10,000,000, 0.035
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.02")) {
            if (recapPercentPaid > BigDecimal.fromString("0.025")) {
              return BigDecimal.fromString("0.8217143201541763"); // 10,000,000 0.03
            } else {
              return BigDecimal.fromString("0.8491662657783823"); // 10,000,000 0.025
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.01")) {
            if (recapPercentPaid > BigDecimal.fromString("0.015")) {
              return BigDecimal.fromString("0.8774874147196358"); // 10,000,000 0.02
            } else {
              return BigDecimal.fromString("0.9067039904828691"); // 10,000,000 0.015
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.005")) {
              return BigDecimal.fromString("0.9368429738790524"); // 10,000,000 0.01
            } else {
              return BigDecimal.fromString("0.9679321240407666"); // 10,000,000 0.005
            }
          }
        }
      }
    }
  } else {
    if (unripeSupply > BigInt.fromString("1000000")) {
      if (recapPercentPaid > BigDecimal.fromString("0.1")) {
        if (recapPercentPaid > BigDecimal.fromString("0.21")) {
          if (recapPercentPaid > BigDecimal.fromString("0.38")) {
            if (recapPercentPaid > BigDecimal.fromString("0.45")) {
              return BigDecimal.fromString("0.000946395082480844"); // 3,000,000, 0.9
            } else {
              return BigDecimal.fromString("0.06786242725985348"); // 3,000,000, 0.45
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.29")) {
            if (recapPercentPaid > BigDecimal.fromString("0.33")) {
              return BigDecimal.fromString("0.10822315472628707"); // 3,000,000 0.38
            } else {
              return BigDecimal.fromString("0.14899524306327216"); // 3,000,000 0.33
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.25")) {
            if (recapPercentPaid > BigDecimal.fromString("0.27")) {
              return BigDecimal.fromString("0.1910488239684135"); // 3,000,000 0.29
            } else {
              return BigDecimal.fromString("0.215863137234529"); // 3,000,000 0.27
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.23")) {
              return BigDecimal.fromString("0.243564628757033"); // 3,000,000 0.25
            } else {
              return BigDecimal.fromString("0.2744582675491247"); // 3,000,000 0.23
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.17")) {
            if (recapPercentPaid > BigDecimal.fromString("0.19")) {
              return BigDecimal.fromString("0.3088786047254358"); // 3,000,000, 0.21
            } else {
              return BigDecimal.fromString("0.3471924328319608"); // 3,000,000, 0.19
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.14")) {
            if (recapPercentPaid > BigDecimal.fromString("0.15")) {
              return BigDecimal.fromString("0.38980166833777796"); // 3,000,000 0.17
            } else {
              return BigDecimal.fromString("0.4371464748698771"); // 3,000,000 0.15
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.12")) {
            if (recapPercentPaid > BigDecimal.fromString("0.13")) {
              return BigDecimal.fromString("0.46274355346663876"); // 3,000,000 0.14
            } else {
              return BigDecimal.fromString("0.4897086460787351"); // 3,000,000 0.13
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.11")) {
              return BigDecimal.fromString("0.518109082463349"); // 3,000,000 0.12
            } else {
              return BigDecimal.fromString("0.5480152684204499"); // 3,000,000 0.11
            }
          }
        }
      } else {
        if (recapPercentPaid > BigDecimal.fromString("0.04")) {
          if (recapPercentPaid > BigDecimal.fromString("0.08")) {
            if (recapPercentPaid > BigDecimal.fromString("0.09")) {
              return BigDecimal.fromString("0.5795008171102514"); // 3,000,000, 0.1
            } else {
              return BigDecimal.fromString("0.6126426856374751"); // 3,000,000, 0.09
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.06")) {
            if (recapPercentPaid > BigDecimal.fromString("0.07")) {
              return BigDecimal.fromString("0.6475213171017626"); // 3,000,000 0.08
            } else {
              return BigDecimal.fromString("0.6842207883207123"); // 3,000,000 0.07
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.05")) {
            if (recapPercentPaid > BigDecimal.fromString("0.055")) {
              return BigDecimal.fromString("0.7228289634394097"); // 3,000,000 0.06
            } else {
              return BigDecimal.fromString("0.742877347280416"); // 3,000,000 0.055
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.045")) {
              return BigDecimal.fromString("0.7634376536479606"); // 3,000,000 0.05
            } else {
              return BigDecimal.fromString("0.784522002909275"); // 3,000,000 0.045
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.03")) {
            if (recapPercentPaid > BigDecimal.fromString("0.035")) {
              return BigDecimal.fromString("0.8061427832364296"); // 3,000,000, 0.04
            } else {
              return BigDecimal.fromString("0.8283126561589187"); // 3,000,000, 0.035
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.02")) {
            if (recapPercentPaid > BigDecimal.fromString("0.025")) {
              return BigDecimal.fromString("0.8510445622247672"); // 3,000,000 0.03
            } else {
              return BigDecimal.fromString("0.8743517267721741"); // 3,000,000 0.025
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.01")) {
            if (recapPercentPaid > BigDecimal.fromString("0.015")) {
              return BigDecimal.fromString("0.8982476658137254"); // 3,000,000 0.02
            } else {
              return BigDecimal.fromString("0.9227461920352636"); // 3,000,000 0.015
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.005")) {
              return BigDecimal.fromString("0.9478614209115208"); // 3,000,000 0.01
            } else {
              return BigDecimal.fromString("0.9736077769406731"); // 3,000,000 0.005
            }
          }
        }
      }
    } else {
      if (recapPercentPaid > BigDecimal.fromString("0.1")) {
        if (recapPercentPaid > BigDecimal.fromString("0.21")) {
          if (recapPercentPaid > BigDecimal.fromString("0.38")) {
            if (recapPercentPaid > BigDecimal.fromString("0.45")) {
              return BigDecimal.fromString("0.003360632002379016"); // 1,000,000, 0.9
            } else {
              return BigDecimal.fromString("0.12071031956650236"); // 1,000,000, 0.45
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.29")) {
            if (recapPercentPaid > BigDecimal.fromString("0.33")) {
              return BigDecimal.fromString("0.1752990554517151"); // 1,000,000 0.38
            } else {
              return BigDecimal.fromString("0.22598948369141458"); // 1,000,000 0.33
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.25")) {
            if (recapPercentPaid > BigDecimal.fromString("0.27")) {
              return BigDecimal.fromString("0.27509697387157794"); // 1,000,000 0.29
            } else {
              return BigDecimal.fromString("0.3029091410266461"); // 1,000,000 0.27
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.23")) {
              return BigDecimal.fromString("0.33311222196618273"); // 1,000,000 0.25
            } else {
              return BigDecimal.fromString("0.36588364748950297"); // 1,000,000 0.23
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.17")) {
            if (recapPercentPaid > BigDecimal.fromString("0.19")) {
              return BigDecimal.fromString("0.40141235983370593"); // 1,000,000, 0.21
            } else {
              return BigDecimal.fromString("0.43989947169522015"); // 1,000,000, 0.19
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.14")) {
            if (recapPercentPaid > BigDecimal.fromString("0.15")) {
              return BigDecimal.fromString("0.4815589587559236"); // 1,000,000 0.17
            } else {
              return BigDecimal.fromString("0.5266183872325827"); // 1,000,000 0.15
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.12")) {
            if (recapPercentPaid > BigDecimal.fromString("0.13")) {
              return BigDecimal.fromString("0.5504980973828455"); // 1,000,000 0.14
            } else {
              return BigDecimal.fromString("0.5753196780298556"); // 1,000,000 0.13
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.11")) {
              return BigDecimal.fromString("0.6011157438454372"); // 1,000,000 0.12
            } else {
              return BigDecimal.fromString("0.6279199091408495"); // 1,000,000 0.11
            }
          }
        }
      } else {
        if (recapPercentPaid > BigDecimal.fromString("0.04")) {
          if (recapPercentPaid > BigDecimal.fromString("0.08")) {
            if (recapPercentPaid > BigDecimal.fromString("0.09")) {
              return BigDecimal.fromString("0.6557668151543954"); // 1,000,000, 0.1
            } else {
              return BigDecimal.fromString("0.6846921580052533"); // 1,000,000, 0.09
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.06")) {
            if (recapPercentPaid > BigDecimal.fromString("0.07")) {
              return BigDecimal.fromString("0.7147327173281093"); // 1,000,000 0.08
            } else {
              return BigDecimal.fromString("0.745926385603471"); // 1,000,000 0.07
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.05")) {
            if (recapPercentPaid > BigDecimal.fromString("0.055")) {
              return BigDecimal.fromString("0.7783121981988174"); // 1,000,000 0.06
            } else {
              return BigDecimal.fromString("0.7949646772335068"); // 1,000,000 0.055
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.045")) {
              return BigDecimal.fromString("0.8119303641360465"); // 1,000,000 0.05
            } else {
              return BigDecimal.fromString("0.8292144735871585"); // 1,000,000 0.045
            }
          }
        } else {
          if (recapPercentPaid > BigDecimal.fromString("0.03")) {
            if (recapPercentPaid > BigDecimal.fromString("0.035")) {
              return BigDecimal.fromString("0.8468222976009872"); // 1,000,000, 0.04
            } else {
              return BigDecimal.fromString("0.8647592065514869"); // 1,000,000, 0.035
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.02")) {
            if (recapPercentPaid > BigDecimal.fromString("0.025")) {
              return BigDecimal.fromString("0.8830306502110374"); // 1,000,000 0.03
            } else {
              return BigDecimal.fromString("0.9016421588014247"); // 1,000,000 0.025
            }
          } else if (recapPercentPaid > BigDecimal.fromString("0.01")) {
            if (recapPercentPaid > BigDecimal.fromString("0.015")) {
              return BigDecimal.fromString("0.9205993440573136"); // 1,000,000 0.02
            } else {
              return BigDecimal.fromString("0.9399079003023474"); // 1,000,000 0.015
            }
          } else {
            if (recapPercentPaid > BigDecimal.fromString("0.005")) {
              return BigDecimal.fromString("0.959573605538012"); // 1,000,000 0.01
            } else {
              return BigDecimal.fromString("0.9796023225453983"); // 1,000,000 0.005
            }
          }
        }
      }
    }
  }
}
