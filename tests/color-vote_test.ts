import {
  Chain,
  Clarinet,
  Account,
  Tx,
  types,
} from 'https://deno.land/x/clarinet@v1.0.5/index.ts'
import { assertObjectMatch } from 'https://deno.land/std@0.160.0/testing/asserts.ts'

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

    assertObjectMatch(receipts[0].result.expectOk().expectTuple() as CVColor, {
      id: types.uint(1),
      score: types.uint(0),
      value: types.ascii('e8d2a2'),
    })
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

    const expectedColors = ['ff8a2b', 'e8d2a2', '2bcdff', '2fcc1a']
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

Clarinet.test({
  name: '`unvote`- can be called after `vote`',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'unvote', [], address),
    ])

    receipts[0].result.expectOk().expectBool(true)
    receipts[1].result.expectOk().expectBool(true)
  },
})

Clarinet.test({
  name: '`unvote`- throws a forbidden error if the person did not vote',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'unvote', [], address),
    ])

    receipts[0].result.expectErr().expectUint(403)
  },
})

Clarinet.test({
  name: '`unvote`- allows user to `vote` again',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [0, 4, 0, 0].map(uint), address),
      Tx.contractCall('color-vote', 'unvote', [], address),
      Tx.contractCall('color-vote', 'vote', [4, 0, 0, 0].map(uint), address),
      Tx.contractCall('color-vote', 'get-elected', [], address),
    ])

    receipts[2].result.expectOk()
    const winner = receipts[3].result.expectSome().expectTuple() as CVElected
    winner.id.expectUint(0)
  },
})

Clarinet.test({
  name: '`unvote` - decrements the nb-of-votes',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'unvote', [], address),
      Tx.contractCall('color-vote', 'get-nb-of-voters', [], address),
    ])

    receipts[2].result.expectUint(0)
  },
})

Clarinet.test({
  name: '`unvote`- substract the previous vote values from the total scores',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'unvote', [], address),
      Tx.contractCall('color-vote', 'get-colors', [], address),
    ])

    receipts[2].result.expectList().forEach((c) => {
      const { score } = c.expectOk().expectTuple() as CVColor
      score.expectUint(0)
    })
  },
})

Clarinet.test({
  name: '`revote`- can be called after `vote`',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'revote', [1, 1, 1, 1].map(uint), address),
    ])

    receipts[0].result.expectOk().expectBool(true)
    receipts[1].result.expectOk().expectBool(true)
  },
})

Clarinet.test({
  name: '`revote`- throws a forbidden error if the person did not vote',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'revote', [1, 1, 1, 1].map(uint), address),
    ])

    receipts[0].result.expectErr().expectUint(403)
  },
})

Clarinet.test({
  name: '`revote`- can be called multiple time',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [1, 1, 1, 1].map(uint), address),
      Tx.contractCall('color-vote', 'revote', [1, 1, 1, 1].map(uint), address),
      Tx.contractCall('color-vote', 'revote', [2, 2, 2, 2].map(uint), address),
    ])

    receipts[0].result.expectOk().expectBool(true)
    receipts[1].result.expectOk().expectBool(true)
  },
})

Clarinet.test({
  name: '`unvote`- update the total scores',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'revote', [3, 3, 3, 3].map(uint), address),
      Tx.contractCall('color-vote', 'get-colors', [], address),
    ])

    receipts[2].result.expectList().forEach((c) => {
      const { score } = c.expectOk().expectTuple() as CVColor
      score.expectUint(3)
    })
  },
})

Clarinet.test({
  name: '`get-sender-vote` - returns sender vote',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const { address } = accounts.get('wallet_1')!
    const { receipts } = chain.mineBlock([
      Tx.contractCall('color-vote', 'get-sender-vote', [], address),
      Tx.contractCall('color-vote', 'vote', [2, 3, 4, 5].map(uint), address),
      Tx.contractCall('color-vote', 'get-sender-vote', [], address),
      Tx.contractCall('color-vote', 'unvote', [], address),
      Tx.contractCall('color-vote', 'get-sender-vote', [], address),
    ])

    receipts[0].result.expectNone()
    receipts[1].result.expectOk()
    receipts[2].result.expectSome().expectList()
    receipts[3].result.expectOk()
    receipts[4].result.expectNone()
  },
})
