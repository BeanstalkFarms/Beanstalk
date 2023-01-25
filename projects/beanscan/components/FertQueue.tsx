import React, { useEffect, useState } from 'react';
import { FertilizerFacet } from '../generated/Beanstalk';
import contracts from '../lib/contracts';

export default function FertQueue() {
  const [queue, setQueue] = useState<null | FertilizerFacet.SupplyStructOutput[]>(null);
  useEffect(() => {
    (async () => {
      setQueue(await contracts.beanstalk.getFertilizers())
    })()
  }, []);
  return (
    <div className="border border-gray-400 max-w-sm">
      <h2 className="border-b border-gray-400 bg-gray-700 px-2 py-1 font-bold">
        Fertilizer Queue
      </h2>
      <div className="px-2 py-1 space-y-2">
        {queue?.map((item, index) => (
          <div key={index}>
            <h2 className="font-bold">Index {index}</h2>
            <div className="ml-2">
              <div>endBpf = {item.endBpf.toString()}</div>
              <div>supply = {item.supply.toString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}