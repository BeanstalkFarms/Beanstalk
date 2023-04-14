// import { useDispatch } from 'react-redux';
// import { useAccount, useConnect, useNetwork, useProvider } from 'wagmi';
// import { useWhatChanged } from '@simbathesailor/use-what-changed';
// import useChainId from '~/hooks/useChain';
// import { useGetPools } from './bean/pools/updater';

// // -- Updater

// const TestUpdater = () => {
//   const [fetch] = useGetPools();
//   const dispatch = useDispatch();
//   const { status: netStatus, isLoading, pendingChainId } = useNetwork(); 
//   const { status: connectStatus, pendingConnector } = useConnect();
//   const { status: accountStatus, data: account } = useAccount();
//   const provider = useProvider();
//   const chainId = useChainId();

//   // ----------------------
//   // WAGMI Connection Flow:
//   // ----------------------
//   // On page load with autoconnect:
//   //    1. netStatus      = idle
//   //       connStatus     = reconnecting
//   //       accountStatus  = loading
//   //    2. accountStatus  = success
//   //       account.address = [string]
//   //    3. connStatus     = connected
//   //    4. account.connector.name = [string]
//   //
//   // On switch wallets:
//   //    1. account.address = [new address]
//   // 
//   useWhatChanged([
//     netStatus,
//     isLoading,
//     connectStatus,
//     pendingConnector,
//     accountStatus,
//     account?.address,
//     account?.connector?.name
//   ], 'net status, net isLoading, conn status, pendingConnector, accountStatus, account.address, account.connector.name', 'wagmi wallet');

//   // ----------------------
//   // WAGMI Network Flow:
//   // ----------------------
//   // On change network:
//   //  1. chainId => new id
//   //  2. provider => new instance
//   useWhatChanged([
//     chainId,
//     pendingChainId,
//     provider
//   ], 'chainId, pendingChainId, provider', 'wagmi network');

//   // ----------------------
//   // Refresh sequencing:
//   // ----------------------
//   // priceContract -> fetch
//   // priceContract -> fetch
//   // pools -> fetch
//   // chainId
//   useWhatChanged([
//     chainId,
//     dispatch,
//     fetch,
//     netStatus,
//   ], 'chainId, dispatch, fetch, netStatus');

//   return null;
// };

export default null;
