import Card from "components/Card";
import EvmValue from "components/EvmValue";
import TokenList from "components/TokenList";
import { provider } from "lib/provider"
import { getWell, getWellFunction } from "lib/well";

interface Params {
  address: string;
}

export default async function InspectWellAddress({ params } : { params: Params }) {
  const well = getWell(params.address, provider);

  const wellData = await well.well();
  const [name, symbol, totalSupply, reserves] = await Promise.all([
    well.name(),
    well.symbol(),
    well.totalSupply(),
    well.getReserves(),
  ]);

  const wellFunction = getWellFunction(wellData._wellFunction.target, provider);
  const wellFunctionName = await wellFunction.name();

  return (
    <div className="space-y-3">
      <h1 className="text-2xl">{name} &middot; {symbol}</h1>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <h3>Reserves</h3>
          <TokenList
            tokens={wellData._tokens}
            values={reserves}
          />
        </Card>
        <Card>
          <h3>Well Function</h3>
          <EvmValue label={wellFunctionName}>{wellFunction.address}</EvmValue>
        </Card>
        <Card>
          <h3>Pumps</h3>
          <TokenList
            tokens={wellData._pumps.map(p => p.target)}
            values={wellData._pumps.map(p => p.data === "0x" ? '' : p.data)}
          />
        </Card>
        <Card>
          <h3>LP Supply</h3>
          <div>{totalSupply.toString()}</div>
        </Card>
      </div>
      <div>
        Deployed by <EvmValue>{wellData._auger}</EvmValue>
      </div>
    </div>
  )
}
