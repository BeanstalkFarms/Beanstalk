// import { TestUtils } from '@beanstalk/sdk';

// import { useMemo, useEffect, useState } from 'react';
// import { useSelector } from 'react-redux';
// import { DateTime } from 'luxon';
// import { SupportedChainId } from '~/constants';

// import useSdk from '~/hooks/sdk';
// import useChainId from '~/hooks/chain/useChainId';

// import { IS_DEV } from '~/util';
// import { selectMorning, selectMorningBlockUpdate, selectSunriseBlock } from '~/state/beanstalk/sun/reducer';

// const FORCE_BLOCK_CONFIG = {
//   force: true,
//   debug: true,
//   /// approximately takes 1-2 seconds to force a block
//   lagOffset: 1
// };

// const CAN_FORCE_BLOCK = FORCE_BLOCK_CONFIG.force && IS_DEV;

// /// When developing in local host, blocks don't update automatically.
// /// we force update the block every 12 seconds, relative to when sunrise
// /// was called to replicate on-chain activity
// export default function useForceBlockDevOnly() {
//   const sdk = useSdk();
//   const chainId = useChainId();
//   const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);
//   const sunriseData = useSelector(selectSunriseBlock);
//   const morningData = useSelector(selectMorning);

//   const morningUpdate = useSelector(selectMorningBlockUpdate);

//   const sunriseTime = sunriseData.timestamp;
//   const morningBlock = morningData.blockNumber;
//   const morningBlockTime = morningData.timestamp;

//   console.log("morningBlockTime: ", morningUpdate.remaining.seconds);

//   /// Timer for debugging. To set, set FORCE_BLOCK_CONFIG.debug to true
//   const [_, setLastTime] = useState(0);

//   useEffect(() => {
//     if (
//       !morningData.isMorning ||
//       !CAN_FORCE_BLOCK ||
//       chainId !== SupportedChainId.LOCALHOST ||
//       !sunriseTime
//     ) {
//       return;
//     }

//     // if (morningUpdate.remaining.seconds === 0) {
//     //   chainUtil.forceBlock();
//     // }

//     const currblockTs = morningData.blockNumber;

//     const intervalId = setInterval(async () => {
//       const _sunriseTime = sunriseTime.toSeconds();
//       const _currentTime = DateTime.now().toSeconds();

//       const blockTime = morningData.timestamp

//       const secsDiff = Math.abs(blockTime.toSeconds() - _sunriseTime);

//       console.log("secsDiff: ", secsDiff);

//       const now = DateTime.now();

//       const remaining = Math.ceil(blockTime.diff(now, 'seconds').seconds % 12);
//       console.log("remaining:", remaining);

//       if (remaining === 1) {
//         console.log('[useForceBlock] updating block...');
//         chainUtil.forceBlock();
//       }

//       const secondsDiff = Math.ceil(Math.abs(sunriseTime.diffNow().as('seconds')));
//       const offset = sunriseTime.toSeconds() % 12;

//       /// if it's been less than 1 block since the start of season, return
//       // if (secondsDiff < 12) return;

//       // console.log('secondsDiff % 12', secondsDiff % 12);
//       // if (secondsDiff % 12 === offset) {
//       //   chainUtil.forceBlock();
//       //   if (!FORCE_BLOCK_CONFIG.debug) return;
//       //   setLastTime((prev) => {
//       //     if (prev === 0) {
//       //       console.debug(
//       //         '[useForceBlock][DEV-ONLY]: first time, Forcing block update...'
//       //       );
//       //       return _currentTime;
//       //     }
//       //     const diff = Math.abs(prev - _currentTime);
//       //     const elapsed = diff / 1000;
//       //     console.debug(
//       //       `[useForceBlock][DEV-ONLY]`,
//       //       elapsed,
//       //       'seconds have elapsed. Forcing block update...'
//       //     );
//       //     return _currentTime;
//       //   });
//       // }
//     }, 1_000);

//     return () => {
//       clearInterval(intervalId);
//     };
//   }, [sunriseTime, chainId, chainUtil, morningData.isMorning, morningData.blockNumber, morningData.timestamp]);
// }
