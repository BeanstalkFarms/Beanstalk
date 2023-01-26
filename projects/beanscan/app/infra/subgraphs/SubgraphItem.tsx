"use client";

import { useCallback, useEffect, useState } from "react";

const checkSubgraphStatus = async (url: string, isBeanstalk: boolean) => {
  return (
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        query: `{
          _meta {
            block {
              number
            }
            deployment
            hasIndexingErrors
          }
          ${isBeanstalk ? `beanstalk(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5") {
            lastUpgrade
            lastSeason
            subgraphVersion
          }` : ''}
        }`
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then((r) => r.json())
    .then((r) => r.data)
  );
}

const SubgraphItem : React.FC<{ url: string, latestBlockNumberNetwork?: number }> = ({ url, latestBlockNumberNetwork }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [intv, setIntv] = useState<null | NodeJS.Timer>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await checkSubgraphStatus(url, url.includes("beanstalk"))
    setData(data);
    setLoading(false);
  }, [url]);

  useEffect(() => {
    if (!intv) {
      load();
      const _intv = setInterval(load, 1000 * 10);
      setIntv(_intv);
    }
  }, [intv, load])

  return (
    <tr className="space-x-4">
      <td><a href={url} target="_blank" rel="noreferrer">{url.split("/").pop()}</a></td>
      <td>{data?._meta.block.number || '-'}</td>
      <td>{data?._meta.hasIndexingErrors.toString() || '-'}</td>
      <td>{data?.beanstalk?.lastSeason || '-'}</td>
      <td>{data?.beanstalk?.subgraphVersion || '-'}</td>
      <td className="text-xs">{data?._meta.deployment || '-'}</td>
      <td>{loading ? 'loading...' : null}</td>
    </tr>
  )
}

export default SubgraphItem;