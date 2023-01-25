import React, { useEffect, useState } from 'react';
import { Contract } from 'ethers-multicall';
import { ethers } from 'ethers';

import contracts from '../lib/contracts';
import { Beanstalk } from '../generated';
import { ethcallProvider } from '../lib/provider';
import Module from './Module';

type ModuleSlot = [
  name: string,
  method: (keyof Beanstalk['functions']),
  parseResult?: (value: any) => string | object | JSX.Element,
  args?: any[],
  desc?: string,
];

const Slot = ({
  slot,
  data,
  index,
  raw
}: {
  slot: ModuleSlot,
  data: any[] | null,
  index: number,
  raw?: boolean,
}) => {
  /** expanded? */
  const [exp, setExp] = useState(false);
  const [name, method, parseResult, args, desc] = slot;

  ///
  let content;
  let displayMode : 'column' | 'row' = 'row';
  if (data && data[index]) {
    const dType = typeof data[index];
    if (raw) {
      let displayMode = dType === 'object' ? 'column' : 'row';
      content = (
        <div className="text-xs">
          <pre>{JSON.stringify(data[index].toString(), null, 2)}</pre>
        </div>
      );
    } else {
      if (parseResult) {
        let parsedResult = parseResult(data[index]);
        let dTypeResult  = typeof parsedResult;
        if (dTypeResult === 'string') {
          // string display
          content = (
            <span>{parsedResult as string}</span>
          )
        } else if (dTypeResult === 'object') {
          // object display
          displayMode = 'column';
          content = (
            <div className="text-xs">
              <pre>{Object.entries(parsedResult).reduce((acc, [key, value]) => acc + `${key}: ${value}\n`, "")}</pre>
            </div>
          )
        } else if (dTypeResult === 'function') {
          /// element display
          displayMode = 'column';
          content = (
            <div>{parsedResult as JSX.Element}</div>
          );
        } else {
          /// string display
          content = (
            <div>{parsedResult as string}</div>
          );
        }
      } else {
        // no parseResult provided
        content = (
          <span>{data[index].toString()}</span>
        );
      }
    }
  }

  const cls = displayMode === 'row' 
    ? `flex-row justify-between items-center`
    : `flex-col`

  return (
    <>
      <div className={`flex ${cls} px-2 py-1 gap-2 cursor-pointer hover:bg-gray-800`} onClick={() => setExp(!exp)}>
        <span>{name}</span>
        {content}
      </div>
      {exp && (
        <div className="px-2 text-gray-400 text-sm break-words pb-2">
          {method}({args?.join(', ')})
          {desc && <><br/>{desc}</>}
        </div>
      )}
    </>
  );
}

const CallsModule : React.FC<{
  title: string;
  slots: ModuleSlot[];
  raw?: boolean;
  multicall?: boolean;
}> = ({
  title,
  slots,
  raw = false,
  multicall = true,
}) => {
  const [data, setData] = useState<null | any[]>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  useEffect(() => {
    (async () => {
      try {
        if (multicall) {
          await ethcallProvider.init();
          const results = await ethcallProvider.all(
            slots.map(slot => {
              const args = (slot[3] || []);
              return (contracts.multi.beanstalk as unknown as Contract)[slot[1]](...args);
            })
          );
          setData(results);
          setStatus('ready');
        } else {
          const results = await Promise.all(
            slots
              .map(slot => {
                const args = (slot[3] || []);
                console.log(contracts.beanstalk[slot[1]](...args))
                return (contracts.beanstalk[slot[1]](...args) as Promise<any>).catch((err) => {
                  console.error(err);
                  return null;
                });
              }),
          );
          setData(results);
          setStatus('ready');
        }
      } catch (err) {
        console.error(err);
      }
    })()
  }, [multicall, slots])
  return (
    <Module title={title}>
      {slots.map((slot, index) => (
        <Slot
          key={index}
          index={index}
          slot={slot}
          data={data}
          raw={raw}
        />
      ))}
    </Module>
  )
}

export default CallsModule;