import { config } from './config';
import { clientToProvider } from './ethersAdapter';

const client = config.getClient();
const provider = clientToProvider(client);

// we're doing this for backwards compatibility during the migration from Wagmi 0.12 to v2.
// A TON of files are importing client.provider so it's simpler to just provide it from here.
export default { provider };
