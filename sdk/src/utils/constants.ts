export class Constants {
  static readonly RELATIONSHIP_SCHEMA_ID = "0x41b8c81288eebbf173b2f54b9fb2f1d37f2caca51ef39e8f99299b53c2599a3a";
  static readonly NAMED_GRAPH_RELATIONSHIP_SCHEMA_ID =
    "0x8f83a0ef7871f63455a506f6bca0db98a88721764ae6dbde2afddd8e12e442b8";
  static readonly OFFCHAIN_DATA_SCHEMA_ID = "0xa288e257097a4bed4166c002cb6911713edacc88e30b6cb2b0104df9c365327d";
}

export enum SDKMode {
  BACKEND = "BACKEND",
  FRONTEND = "FRONTEND",
}

export enum ActionType {
  Simulation = "Simulation",
  Transaction = "Transaction",
}
