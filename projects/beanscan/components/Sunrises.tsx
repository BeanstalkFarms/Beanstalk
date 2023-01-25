import { useEffect, useState } from "react"
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import { RewardEvent, SunriseEvent } from "../generated/Beanstalk";
import contracts from "../lib/contracts"
import { provider } from "../lib/provider";
import { ethers } from "ethers";
import { TypedEvent } from "../generated/common";

const SECONDS_PER_HOUR  = 60*60;
const AVG_SECONDS_PER_BLOCK = 10;
const AVG_BLOCKS_PER_HOUR = SECONDS_PER_HOUR/AVG_SECONDS_PER_BLOCK;
const NUM_SEASONS = 5;

type SeasonEventNames = 'MetapoolOracle' | 'WeatherChange' | 'SeasonOfPlenty' | 'Reward' | 'Soil';
type Seasons = { [season: string] : { [event: string] : any } };
const none = <em>None</em>

export function Sunrise({ season, events } : { season: string, events: Seasons[string] }) {
  const [exp, setExp] = useState(false);
  return (
    <div key={season} className="border-gray-400 border-b px-2 py-1 hover:bg-gray-800 cursor-pointer" onClick={() => setExp(!exp)}>
      Sunrise #{season.toString()}
      {exp && (
        <div className="ml-2 mt-1 space-y-2 text-sm">
          {/* Event: MetapoolOracle */}
          <div>
            <h2 className="font-bold">MetapoolOracle</h2>
            {events['MetapoolOracle'] ? (
              <div className="ml-2">
                <div>deltaB: {ethers.utils.formatUnits(events['MetapoolOracle'].deltaB || '0', 6)}</div>
                <div>balances: {events['MetapoolOracle']?.balances.map((b: any, i: number) => <div key={i} className="ml-2">{i} = {b.toString()}</div>) || '0'}</div>
              </div>
            ) : none}
          </div>
          {/* Event: WeatherChange */}
          <div>
            <h2 className="font-bold">WeatherChange</h2>
            {events['WeatherChange'] ? (
              <div className="ml-2">
                <div>caseId: {events['WeatherChange'].caseId.toString()}</div>
                <div>change: {events['WeatherChange'].change.toString()}</div>
              </div>
            ) : none}
          </div>
          {/* Event: SeasonOfPlenty */}
          {events['SeasonOfPlenty'] ? (
            <div className="ml-2">
              <h2 className="font-bold">SeasonOfPlenty</h2>
              <div>amount: {events['SeasonOfPlenty'].amount.toString()}</div>
              <div>toField: {events['SeasonOfPlenty'].toField.toString()}</div>
            </div>
          ) : null}
          {/* Event: Reward */}
          <div>
            <h2 className="font-bold">Reward</h2>
            {events['Reward'] ? (
              <div className="ml-2">
                <div>toField: {ethers.utils.formatUnits(events['Reward']?.toField || '0', 6)}</div>
                <div>toSilo: {ethers.utils.formatUnits(events['Reward']?.toSilo || '0', 6)}</div>
                <div>toFertilizer: {ethers.utils.formatUnits(events['Reward']?.toFertilizer || '0', 6)}</div>
              </div>
            ) : none}
          </div>
          {/* Event: Soil */}
          <div>
            <h2 className="font-bold">Soil</h2>
            {events['Soil'] ? (
              <div className="ml-2">
                <div>soil: {ethers.utils.formatUnits(events['Soil']?.soil || '0', 6)}</div>
              </div>
            ) : none}
          </div>
        </div>
      )}
      {/* <div>
        {exp && <pre>{JSON.stringify(events, null, 2)}</pre>}
      </div> */}
    </div>
  )
}


export default function Sunrises() {
  const [eventsBySeason, setSeasonEvents] = useState<null | Seasons>(null);
  useEffect(() => {
    (async () => {
      const [season, blockNumber] = await Promise.all([
        contracts.beanstalk.season(),
        provider.getBlockNumber(),
      ]);
      // const blocksBack =  blockNumber - (NUM_SEASONS + 1) * AVG_BLOCKS_PER_HOUR;
      const seasonsToQuery = Array(NUM_SEASONS).fill(0).map((_, index) => season - index);
      const filters = (name: SeasonEventNames) => {
        return seasonsToQuery.map(
          season => contracts.beanstalk.queryFilter(
            contracts.beanstalk.filters[name](season.toString()), // season.toString()
          )
        );
      };

      const queries = await Promise.all([
        ...filters('MetapoolOracle'),
        ...filters('WeatherChange'),
        ...filters('SeasonOfPlenty'),
        ...filters('Reward'),
        ...filters('Soil'),
      ]);
      const seasons : Seasons = {};
      const flattened = flatten<TypedEvent<any, { season: number | ethers.BigNumber }>>(queries);

      flattened.forEach((event) => {
        const s = event.args?.season?.toString();
        if (s) {
          if (!seasons[s]) seasons[s] = {};
          seasons[s][event.event || 'Unknown'] = event.args;
        }
      });

      setSeasonEvents(seasons);
    })();
  }, [])
  return (
    <div className="border border-gray-400 max-w-sm">
      <h2 className="border-b border-gray-400 bg-gray-700 px-2 py-1 font-bold">
        Sunrises
      </h2>
      {eventsBySeason ? Object.keys(eventsBySeason).sort((a, b) => parseInt(b) - parseInt(a)).map(season => {
        const events = eventsBySeason[season];
        return (
          <Sunrise
            key={season}
            season={season}
            events={events}
          />
        )
      }) : null}
    </div>
  )
}