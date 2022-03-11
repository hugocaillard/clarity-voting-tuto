import {
  Chain,
  Clarinet,
  Account,
  Tx,
  types,
} from 'https://deno.land/x/clarinet@v0.27.0/index.ts'

const { uint } = types

Clarinet.test({
  name: '`get-nb-of-voters` - returns the right number of voters',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'get-nb-of-voters', [], address),
    ])

    receipts[0].result.expectUint(0)
  },
})

Clarinet.test({
  name: '`vote` - participant can vote only one time',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [5, 5, 5, 5].map(uint), address),
      Tx.contractCall('color-vote', 'vote', [5, 5, 5, 5].map(uint), address),
    ])

    receipts[0].result.expectOk().expectBool(true)
    receipts[1].result.expectErr().expectUint(403)
  },
})

Clarinet.test({
  name: '`vote` - vote increments the number of voters',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [5, 5, 5, 5].map(uint), address),
      Tx.contractCall('color-vote', 'get-nb-of-voters', [], address),
    ])

    receipts[0].result.expectOk().expectBool(true)
    receipts[1].result.expectUint(1)
  },
})

Clarinet.test({
  name: '`vote` - throw an error if the vote is not valid',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [6, 5, 5, 5].map(uint), address),
    ])

    receipts[0].result.expectErr().expectUint(400)
  },
})
