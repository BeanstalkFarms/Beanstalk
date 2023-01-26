"use client";

import { ethers } from "ethers";
import { NextPage } from "next"
import { useEffect, useState } from "react";
import omit from 'lodash/omit'
import Module from "../../../components/Module"
import { Beanstalk__factory } from "../../../generated";
import { TypedEvent } from '../../../generated/common';
import contracts from "../../../lib/contracts"
import { parseArgs } from "../../../lib/utils";
import { chainId } from "../../../lib/provider";

const activateListeners = (
  handler: (event: TypedEvent<any>
) => void) => {
  const wsProvider = new ethers.providers.WebSocketProvider(
    process.env.NEXT_PUBLIC_RPC_WS_URL || '',
    { name: 'Unknown', chainId }
  )
  const _beanstalk = Beanstalk__factory.connect(contracts.beanstalk.address, wsProvider)
  const filters : (keyof typeof _beanstalk.filters)[] = [
    /// Sun
    'Sunrise',
    'Reward',
    'SeasonOfPlenty',
    'WeatherChange',
    'Unpause',
    'Soil',
    'MetapoolOracle',
    'Incentivization',
    /// Balances
    'InternalBalanceChanged',
    /// Field
    'PlotTransfer',
    'Sow',
    'Harvest',
    /// Barn
    'Pick',
    'Chop',
    'SetFertilizer',
    'ChangeUnderlying',
    /// Silo
    'AddDeposit',
    'AddWithdrawal',
    'RemoveDeposit',
    'RemoveDeposits',
    'RemoveWithdrawal',
    'RemoveWithdrawals',
    'Earn',
    'StalkBalanceChanged(address,int256,int256)',
    'SeedsBalanceChanged',
    /// Convert
    'Convert',
    /// Market
    'PodListingCreated',
    'PodListingFilled',
    'PodListingCancelled',
    'PodOrderCreated',
    'PodOrderFilled',
    'PodOrderCancelled',
    /// SOP
    'ClaimPlenty',
  ]

  ///
  filters.forEach((f) => {
    // @ts-ignore
    _beanstalk.on(
      _beanstalk.filters[f](),
      (...args) => {
        console.debug(`handle: ${f}`, args)
        handler(args[args.length - 1] as TypedEvent<any>)
      }
    );
  })

  return () => { _beanstalk.removeAllListeners() };
}

const EventItem : React.FC<{ evt: TypedEvent<any> }> = ({ evt }) => {
  return (
    <Module title={evt.event || 'Unknown'}>
      <div className="p-2 text-xs">
        <pre>{JSON.stringify(parseArgs(omit(evt.args, ['0', '1', '2', '3', '4'])), null, 2)}</pre>
        <div>Block #{evt.blockNumber}</div>
        <div>Tx Hash: {evt.transactionHash}</div>
        <div>Tx Index: {evt.transactionIndex}</div>
        <div>Log Index: {evt.logIndex}</div>
      </div>
    </Module>
  )
}

const Events : NextPage = () => {
  const [on,   setOn]   = useState(false);
  const [evts, setEvts] = useState<TypedEvent[]>([]);
  const start = () => {
    setEvts([]);
    setOn(true);
  };
  const end = () => {
    setOn(false);
  };

  useEffect(() => {
    const cancel = activateListeners(
      (event) => setEvts(
        (prevState) => {
          const newArr = [event, ...prevState]
          return newArr;
        }
      )
    );
    return () => cancel();
  }, [on])

  return (
    <div>
      <button onClick={on ? end : start}>
        {on ? 'Stop' : 'Start'} listening
      </button>
      <div className="w-[800px] space-y-2">
        {evts.map((evt) => (
          <EventItem
            evt={evt}
            key={`${evt.blockNumber}-${evt.transactionIndex}`}
          />
        ))}
      </div>
    </div>
  )
}

export default Events