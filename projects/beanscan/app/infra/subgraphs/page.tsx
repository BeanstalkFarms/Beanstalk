import React from 'react';
import type { NextPage } from 'next'
import SubgraphItem from 'app/infra/subgraphs/SubgraphItem';

const SUBGRAPHS = [
  `https://graph.node.bean.money/subgraphs/name/beanstalk`,
  `https://graph.node.bean.money/subgraphs/name/beanstalk-dev`,
  `https://graph.node.bean.money/subgraphs/name/beanstalk-testing`,
  `https://graph.node.bean.money/subgraphs/name/beanstalk-2-1-0`,
  `https://graph.node.bean.money/subgraphs/name/beanstalk-2-0-4`,
  `https://graph.node.bean.money/subgraphs/name/bean`,
  `https://graph.node.bean.money/subgraphs/name/bean-dev`,
  `https://graph.node.bean.money/subgraphs/name/bean-testing`,
]

const Infra: NextPage = () => {
  return (
      <div>
        <table className="max-w-8xl border-separate px-4 py-2 border-spacing-2">
          <thead>
            <tr className="space-x-4">
              <th>Name</th>
              <th>Block Number</th>
              <th>Indexing errors?</th>
              <th>Last Season</th>
              <th>Version</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SUBGRAPHS.map((url) => <SubgraphItem url={url} key={url} latestBlockNumberNetwork={0} />)}
          </tbody>
        </table>
      </div>
  )
}

export default Infra
