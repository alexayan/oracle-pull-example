const suiSdk = require("@mysten/sui.js/client");
const rpcUrl = suiSdk.getFullnodeUrl("localnet");
const suiClient = new suiSdk.SuiClient({ url: rpcUrl });

const suiTx = require("@mysten/sui.js/transactions");
const suiKeypair = require("@mysten/sui.js/keypairs/ed25519");
const suiUtils = require("@mysten/sui.js/utils");
const { bcs } = require("@mysten/bcs");

const PullServiceClient = require("./pullServiceClient");

async function main() {
  const address = "mainnet-dora.supraoracles.com"; // Set the gRPC server address
  const pairIndexes = [185]; // Set the pair indexes as an array
  const chainType = "sui";

  const client = new PullServiceClient(address);

  const request = {
    pair_indexes: pairIndexes,
    chain_type: chainType,
  };
  console.log("Requesting proof for price index : ", request.pair_indexes);
  client.getProof(request, (err, response) => {
    if (err) {
      console.error("Error:", err.details);
      return;
    }
    console.log("Calling contract to verify the proofs.. ");
    decodeLocal(response.sui);
  });
}

async function decodeLocal(response) {
  const scc_prices = bcs
    .vector(bcs.vector(bcs.u128()))
    .parse(Uint8Array.from(response.scc_prices));
  const scc_decimals = bcs
    .vector(bcs.vector(bcs.u16()))
    .parse(Uint8Array.from(response.scc_decimals));
  const scc_timestamp = bcs
    .vector(bcs.vector(bcs.u128()))
    .parse(Uint8Array.from(response.scc_timestamp));
  const pair_mask = bcs
    .vector(bcs.vector(bcs.bool()))
    .parse(Uint8Array.from(response.pair_mask));

  const scc_pairs = bcs
    .vector(bcs.vector(bcs.u32()))
    .parse(Uint8Array.from(response.scc_pair));

  const pairId = [];
  const pairPrice = [];
  const pairDecimal = [];
  const pairTimestamp = [];
  for (let i = 0; i < pairIndexes.length; ++i) {
    for (let j = 0; j < scc_pairs[i].length; ++j) {
      if (!pair_mask[i][j]) {
        continue;
      }
      pairId.push(scc_pairs[i][j]);
      pairPrice.push(scc_prices[i][j]);
      pairDecimal.push(scc_decimals[i][j]);
      pairTimestamp.push(
        new Date(parseInt(scc_timestamp[i][j])).toLocaleString()
      );
    }
  }

  console.log("Pair index : ", pairId);
  console.log("Pair Price : ", pairPrice);
  console.log("Pair Decimal : ", pairDecimal);
  console.log("Pair Timestamp : ", pairTimestamp);
}

async function callContract(response) {
  const contractAddress = "<CONTRACT ADDRESS>"; // Address of your smart contract
  const moduleName = "<CONTRACT MODULE>"; // Module name of your contract. Ex. pull_example
  const functionName = "<CONTRACT FUNCTION>"; // Module function name of your contract. Ex. get_pair_price

  let txb = new suiTx.TransactionBlock();

  txb.moveCall({
    target: `${contractAddress}::${moduleName}::${functionName}`,
    arguments: [
      txb.pure(response.dkg_object),
      txb.pure(response.oracle_holder_object),

      txb.pure(response.vote_smr_block_round, "vector<vector<u8>>"),
      txb.pure(response.vote_smr_block_timestamp, "vector<vector<u8>>"),
      txb.pure(response.vote_smr_block_author, "vector<vector<u8>>"),
      txb.pure(response.vote_smr_block_qc_hash, "vector<vector<u8>>"),
      txb.pure(response.vote_smr_block_batch_hashes, "vector<vector<u8>>"),
      txb.pure(response.vote_round, "vector<u64>"),

      txb.pure(response.min_batch_protocol, "vector<vector<u8>>"),
      txb.pure(response.min_batch_txn_hashes, "vector<vector<vector<u8>>>"),

      txb.pure(response.min_txn_cluster_hashes, "vector<vector<u8>>"),
      txb.pure(response.min_txn_sender, "vector<vector<u8>>"),
      txb.pure(response.min_txn_protocol, "vector<vector<u8>>"),
      txb.pure(response.min_txn_tx_sub_type, "vector<u8>"),

      txb.pure(response.scc_data_hash, "vector<vector<u8>>"),
      txb.pure(response.scc_pair, "vector<vector<u32>>"),
      txb.pure(response.scc_prices, "vector<vector<u128>>"),
      txb.pure(response.scc_timestamp, "vector<vector<u128>>"),
      txb.pure(response.scc_decimals, "vector<vector<u16>>"),
      txb.pure(response.scc_qc, "vector<vector<u8>>"),
      txb.pure(response.scc_round, "vector<u64>"),
      txb.pure(response.scc_id, "vector<vector<u8>>"),
      txb.pure(response.scc_member_index, "vector<u64>"),
      txb.pure(response.scc_committee_index, "vector<u64>"),

      txb.pure(response.batch_idx, "vector<u64>"),
      txb.pure(response.txn_idx, "vector<u64>"),
      txb.pure(response.cluster_idx, "vector<u32>"),
      txb.pure(response.sig, "vector<vector<u8>>"),
      txb.pure(response.pair_mask, "vector<vector<bool>>"),
    ],
  });

  const raw = suiUtils.fromB64("<PRIVATE KEY BASE64>"); // Your wallet private in base64 format
  let signer = suiKeypair.Ed25519Keypair.fromSecretKey(raw.slice(1));

  const result = await suiClient.signAndExecuteTransactionBlock({
    transactionBlock: txb,
    signer,
  });
  console.log({ result });
}

main();
