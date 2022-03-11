import {
  Chain,
  Clarinet,
  Account,
  Tx,
  types,
} from 'https://deno.land/x/clarinet@v0.27.0/index.ts'

const { uint } = types

type CVColor = {
  id: string
  score: string
  value: string
}

type CVElected = {
  id: string
  score: string
}

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
  name: '`get-color` - returns the right color',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'get-color', [uint(1)], address),
    ])

    // `as CVColor` is not the cleanest way to do it but it's good enough
    const color = receipts[0].result.expectOk().expectTuple() as CVColor
    color.id.expectUint(1)
    color.score.expectUint(0)
    color.value.expectAscii('D1C0A8')
  },
})

Clarinet.test({
  name: '`get-color` - returns 404 for invalid id',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'get-color', [uint(10)], address),
    ])

    receipts[0].result.expectErr().expectUint(404)
  },
})

Clarinet.test({
  name: '`get-colors` - returns the array of colors',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'get-colors', [], address),
    ])

    const colors = receipts[0].result.expectList()

    const expectedColors = ['F97316', 'D1C0A8', '2563EB', '65A30D']
    colors.forEach((colorTuple, i) => {
      const color = colorTuple.expectOk().expectTuple() as CVColor
      color.id.expectUint(i)
      color.value.expectAscii(expectedColors[i])
    })
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
  name: '`vote` - sets the vote values',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [5, 4, 3, 2].map(uint), address),
      Tx.contractCall('color-vote', 'get-color', [uint(0)], address),
    ])

    receipts[0].result.expectOk()
    const color = receipts[1].result.expectOk().expectTuple() as CVColor
    color.score.expectUint(5)
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

Clarinet.test({
  name: '`get-elected` - returns elected',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [0, 4, 0, 0].map(uint), address),
      Tx.contractCall('color-vote', 'get-elected', [], address),
    ])

    receipts[0].result.expectOk().expectBool(true)

    const elected = receipts[1].result.expectSome().expectTuple() as CVElected
    elected.id.expectUint(1)
    elected.score.expectUint(4)
  },
})
