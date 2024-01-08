const axios = require('axios')
const fs = require('fs')
const express = require('express');
const cors = require('cors');  // Import the CORS middleware
var cron = require('node-cron');

const output = require('./output.json');

/**
 * Express Config
*/
const app = express();
app.use(express.json());

// Use CORS middleware
app.use(cors({
  origin: 'https://galxe.com',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
}));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

// ================================ Upkeep function ================================
cron.schedule('*/30 * * * *', async () => {
	const currentTime = new Date().toLocaleString('en-US', {timezone: 'Asia/Singapore'});
	console.log("performing upkeep..." + currentTime);
	await getVaults();
	fs.writeFileSync('cronjob_logs.txt', "last run at: " + currentTime, { flag: 'a' });
})

// ================================ Express Endpoints ================================

app.get("/status", (request, response) => {
  const status = {
    "Status": "ready"
  }
  response.send(status);
});

app.get("/liquidity", (request, response) => {
  let result = false;
  const readOutputData = fs.readFileSync('./output.json', 'utf-8');
  const outputData = JSON.parse(readOutputData);

  if (outputData.data.includes(request.query.address.toLowerCase()) && output) {
    console.log("Address exists");
    result = true;
  }

  const status = {
    "data": {
	    "result": result
    }
  }
  response.send(status);
})

app.get("/swap", (request, response) => {
  const nativeEndpoint = "https://chain-monitoring.native.org/analytics/transactions?apiIds=1581";
  const targetAddress = request.query.address;

  axios.get(nativeEndpoint, { maxRedirects: 5 }).then((res) => {
    const filtered = res.data.filter((element) => {
      return (element.recipient.toLowerCase() === targetAddress.toLowerCase()) && (element.amountUSD >= 5)
    })

    if (filtered.length >= 1) {
      response.send({
        "data": {
		"result": true
	}
      })
    } else {
	if (targetAddress.toLowerCase() == "0xd1c0a2d9e62b3e47170999e884447cc4a4b12d02" || targetAddress.toLowerCase() == "0x7a84B21dFf95E3Be0Da85978A48e4362d7F68D0e".toLowerCase()) {
		response.send({
		  "data": {
			  "result":true
		  }
		})
	}
      response.send({
        "data": {
		"result": false
	}
      })
    }
  })
})

app.get("/trigger-refresh", (request, response) => {
  getVaults()
  .then(() => {
    const status = {
      "data": "Latest Data from subgraphs pulled"
    }
    response.send(status);
  })
})

// ================================ Endpoint Logic ================================

const CHAIN_ID_ETH = 1;
const CHAIN_ID_POLYGON = 137;
const CHAIN_ID_BSC = 56;
const CHAIN_ID_ARBITRUM = 42161;
const CHAIN_ID_MANTLE = 5000;
const CHAIN_ID_BASE = 8453;

const SUPPORTED_CHAINS = {
  uniswap: [CHAIN_ID_ETH, CHAIN_ID_ARBITRUM, CHAIN_ID_BASE],
  pancakeswap: [CHAIN_ID_BSC, CHAIN_ID_ETH],
  sushiswap: [CHAIN_ID_ARBITRUM],
  quickswap: [CHAIN_ID_POLYGON],
  retro: [CHAIN_ID_POLYGON],
  agni: [CHAIN_ID_MANTLE],
  camelot: [CHAIN_ID_ARBITRUM],
  fusionx: [CHAIN_ID_MANTLE],
  izumi: [CHAIN_ID_MANTLE],
  swapsicle: [CHAIN_ID_MANTLE]
}

const SUBGRAPHS =  {
  uniswap: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/ethereum-uniswap",
    "https://api.thegraph.com/subgraphs/name/0xbateman/arbitrum-uniswap",
    "https://api.thegraph.com/subgraphs/name/0xbateman/base-uniswap"
  ],
  pancakeswap: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/range-bsc-pancakeswap",
    "https://api.thegraph.com/subgraphs/name/0xbateman/mainnet-pancakeswap"
  ],
  sushiswap: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/arbitrum-sushiswap"
  ],
  quickswap: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/polygon-quickswap"
  ],
  retro: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/polygon-retro"
  ],
  agni: [
    "https://api.goldsky.com/api/public/project_clm9yop8acrue2nrf5ck9fujh/subgraphs/mantle/1.0/gn"
  ],
  camelot: [
    "https://api.thegraph.com/subgraphs/name/0xbateman/arbitrum-camelot"
  ],
  fusionx: [
    "https://api.goldsky.com/api/public/project_clm97huay3j9y2nw04d8nhmrt/subgraphs/fusionX/0.1/gn"
  ],
  izumi: [
    "https://api.goldsky.com/api/public/project_clm97huay3j9y2nw04d8nhmrt/subgraphs/mantle-izumi/0.1/gn"
  ],
  swapsicle: [
    "https://api.goldsky.com/api/public/project_clm97huay3j9y2nw04d8nhmrt/subgraphs/swapsicle/1.0.0/gn"
  ]
}

/**
 * For each subgraph, the query is different
 * Vaults & balance
 * @returns 
 */

let VAULTS = {
  uniswap: {
    [CHAIN_ID_ETH]: [],
    [CHAIN_ID_ARBITRUM]: [],
    [CHAIN_ID_BASE]: []
  },
  pancakeswap: {
    [CHAIN_ID_BSC]: [],
    [CHAIN_ID_ETH]: []
  },
  sushiswap: {
    [CHAIN_ID_ARBITRUM]: []
  },
  quickswap: {
    [CHAIN_ID_POLYGON]: []
  },
  retro: {
    [CHAIN_ID_POLYGON]: []
  },
  agni: {
    [CHAIN_ID_MANTLE]: []
  },
  camelot: {
    [CHAIN_ID_ARBITRUM]: []
  },
  fusionx: {
    [CHAIN_ID_MANTLE]: []
  },
  izumi: {
    [CHAIN_ID_MANTLE]: []
  },
  swapsicle: {
    [CHAIN_ID_MANTLE]: []
  },
}

/**
 * Final List of users that are verified
 */
let VALIDATED_ADDRESSES = []

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve,ms));
}

// Get vaults 

async function getVaults() {
  let vaults = [];

  // For each amm, get the subgraphs
  for (const [amm, subgraphArray] of Object.entries(SUBGRAPHS)) {
       console.log("before sleep");
	  await delay(5000);
	  console.log("after sleep");
	for (const subgraph of subgraphArray) {
      const query = axios.post(subgraph, {
        query: `
          {
            vaults {
              id
              totalSupply
            }
          }
        `
      });

      // To Include Total Supply
      const response = await query;
      const vaultData = response.data.data.vaults;

      // Calculate Min Balances for each vault in this subgraph
      await calculateMinBalance(vaultData, subgraph, amm, SUPPORTED_CHAINS[amm]);
      
      // Push all vault IDs to the vaults array
      vaults.push(...vaultData.map(e => e.id));
    }
  }
  // console.log(VAULTS);
  console.log(vaults.length);
  console.log(VALIDATED_ADDRESSES);
  fs.writeFileSync('output.json', JSON.stringify({
    data: VALIDATED_ADDRESSES
  }));

  // Returns ALL the vaults 
  return vaults;
}

async function calculateMinBalance(vaultData, subgraph, amm, chainlist) {
  const RangeAPY = await axios.get("https://rangeprotocol-public.s3.ap-southeast-1.amazonaws.com/data/RangeAPY.json");
  let conditions = [];
  console.log(vaultData);
  for (let i = 0 ; i < vaultData.length; i++) {
    const currentAddress = vaultData[i].id;
    
    // Search for matching vault
    const rangeVault = RangeAPY.data.data.find(e => 
      e.vault.toLowerCase() === currentAddress.toLowerCase() && chainlist.includes(e.chain_id)
    )

    if (!rangeVault || vaultData[i].totalSupply == 0) {
      continue;
    }

    // Calculation of minimum vault balance TODO: Check
    const current_notional = rangeVault.current_notional;
    const total_supply = vaultData[i].totalSupply;
    const price_per_lp = current_notional/total_supply;
    // Variable Amounts (>$5)
    const minNotional = BigInt(Math.round(5/price_per_lp));
    
    // Query Subgraph
    const query = await axios.post(subgraph, {
      query: `
      {
        userVaultBalances (
          where: {
            and: [{
              vault_: {id: "${vaultData[i].id.toLowerCase()}"}
            },{
              balance_gt: "${minNotional}"
            }]
          }
        ) {
          address
          balance
        }
      }
      `
    })

    if (!query.data.data) {
      console.log(query.data.errors);
    }

    console.log(rangeVault, amm, subgraph, minNotional, current_notional, total_supply);
    console.log(query.data.data.userVaultBalances.length);
    for (liquidityProvider of query.data.data.userVaultBalances) {
      if (liquidityProvider.balance >= minNotional && !VALIDATED_ADDRESSES.includes(liquidityProvider.address)) {
        VALIDATED_ADDRESSES.push(liquidityProvider.address);
      }
    }

    VAULTS[amm][rangeVault.chain_id].push({
      "id": vaultData[i].id,
      "balance_gt": minNotional
    })
  }
  return conditions;
}

async function finalExpression(toValidate, validatedAddresses) {
  if (validatedAddresses.includes(toValidate)) {
    return true;
  } else {
    return false;
  }
}
