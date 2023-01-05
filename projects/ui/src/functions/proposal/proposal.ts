import { Handler } from '@netlify/functions';

/**
 * Return BIP content for prior on-chain BIPs.
 * @unused
 */
const handler: Handler = async () =>  ({
  statusCode: 404,
});

// try {
//   const proposal = await new Promise((resolve, reject) => {
//     /// FIXME: may need to bundle these bips with function code,
//     /// and/or use a dynamic import instead of readFile. to research
//     fs.readFile(path.join(__dirname, './bips/bip-0.md'), 'utf8', (err, data) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(data);
//     });
//   });

//   if (!proposal) {
//     return {
//       statusCode: 404,
//     };
//   }

//   return {
//     statusCode: 200,
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(proposal),
//   };
// } catch (err) {
//   console.error(err);
//   return {
//     statusCode: 403,
//   };
// }
// ;

export { handler };
