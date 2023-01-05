import commandLineUsage from "command-line-usage";

export const help = () => {
  const sections = [
    {
      header: "Beanstalk Dev CLI",
      content: "Utilities to make developer experience smoother"
    },
    {
      header: "Options",
      optionList: [
        {
          name: "account",
          alias: "a",
          typeLabel: "{underline address}",
          description: "Account to impersonate or run commands against. \n{gray Default: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266}",
          defaultValue: "0x123"
        },
        {
          name: "token",
          alias: "t",
          typeLabel: "{underline SYMBOL}",
          description: "Symbol of token. {gray Default: all tokens}"
        },
        {
          name: "amount",
          alias: "m",
          typeLabel: "{underline number}",
          description: "A human readable value specifying an amount. Ex: '5' for five ETH\n{gray Default: 50000}"
        },
        {
          name: "rpcUrl",
          alias: "r",
          typeLabel: "{underline url}",
          description: "http[s] RPC url to connect with. \n{gray Default: http://localhost:8545}"
        }
      ]
    },
    {
      header: "Commands",
      content: [
        { name: "{bold.greenBright balance}", summary: "Display balance(s). Optionally specify account or token" },
        { name: "{bold.greenBright setbalance}", summary: "Set balance(s). Optionally specify account, token, or amount" },
        { name: "{bold.greenBright help}", summary: "You're looking at it :)" }
      ]
    },
    {
      header: "Examples",
      content: [
        {
          desc: "1. Show all balances. ",
          example: "$ bean balance"
        },
        {
          desc: "2. Show all balances for a specific account and token",
          example: "$ bean balance --token BEAN --account 0x123"
        },
        {
          desc: "3. Set ALL balances to 50,000 for default account",
          example: "$ bean setbalance"
        },
        {
          desc: "4. Set BEAN balance for account 0x123 to 3.14",
          example: "$ bean setbalance -a 0x123 -t BEAN -m 3.14"
        }
      ]
    },
    {
      content: "For bugs or issues: {underline https://github.com/BeanstalkFarms/Beanstalk-SDK/}"
    }
  ];
  const usage = commandLineUsage(sections);
  console.log(usage);
};
