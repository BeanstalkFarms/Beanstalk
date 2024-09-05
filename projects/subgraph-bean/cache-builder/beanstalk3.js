const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const url = "https://graph.bean.money/bean";
const subgraph = new GraphQLClient(url);
