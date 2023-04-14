// import React, { useCallback } from 'react';
// import { Button } from '@mui/material';
// import CachedIcon from '@mui/icons-material/Cached';
// import { useAccount } from 'wagmi';
// import { Beanstalk } from '~/generated';
// import { useBeanstalkContract } from '~/hooks/ledger/useContract';
// import useTokenMap from '~/hooks/chain/useTokenMap';
// import { getAccount } from '~/util/Account';
// import { toTokenUnitsBN } from '~/util/Tokens';
// import { ERC20_TOKENS } from '~/constants/tokens';

// export default function DevButton(props: any) {
//   const b = (useBeanstalkContract() as unknown) as Beanstalk;
//   const { data: account } = useAccount();
//   const erc20Tokens = useTokenMap(ERC20_TOKENS);
//   const tokenAddresses = Object.keys(erc20Tokens);
  
//   const onClick = useCallback(async () => {
//     if (account?.address) {
//       const address = getAccount(account?.address);
//       console.log(
//         'getAllBalances',
//         await b.getAllBalances(
//           address,
//           tokenAddresses
//         ).then((results) => results.reduce((prev, val, i) => {
//             const tok = erc20Tokens[tokenAddresses[i]];
//             prev[tok.name] = {
//               internalBalance: toTokenUnitsBN(val.internalBalance.toString(), tok.decimals).toFixed(),
//               externalBalance: toTokenUnitsBN(val.externalBalance.toString(), tok.decimals).toFixed(),
//               totalBalance:    toTokenUnitsBN(val.totalBalance.toString(), tok.decimals).toFixed(),
//             };
//             return prev;
//           }, {} as { [key: string] : any })),
//       );
//     }
//   }, [
//     account,
//     erc20Tokens,
//     tokenAddresses,
//     b
//   ]);

//   return (
//     <Button color="light" variant="contained" onClick={onClick} sx={props.sx as any}>
//       <CachedIcon />
//     </Button>
//   );
// }

export default null;
