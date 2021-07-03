import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { Token } from '../typechain/Token'
import { LooneySwapPool } from '../typechain/LooneySwapPool'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

use(solidity)

describe("LooneySwapPool", function() {
  let token0: Token
  let token1: Token
  let pool: LooneySwapPool
  let accounts: SignerWithAddress[]

  beforeEach(async () => {
    accounts = await ethers.getSigners()

    const Token = await ethers.getContractFactory('Token')
    token0 = await Token.deploy('Bitcoin', 'BTC', 100000000000) as Token
    token1 = await Token.deploy('USDC', 'USDC', 1000000000000000) as Token
    await token0.deployed()
    await token1.deployed()

    const [, account1, account2, account3, account4] = accounts

    for (const account of [account1, account2, account3, account4]) {
      await (await token0.transfer(account.address, 200)).wait()
      await (await token1.transfer(account.address, 10000000)).wait()
    }

    const LooneySwapPool = await ethers.getContractFactory("LooneySwapPool")
    pool = await LooneySwapPool.deploy(token0.address, token1.address) as LooneySwapPool
    await pool.deployed()
  })

  it("Should return initialized pool", async function() {
    expect(await pool.token0()).to.equal(token0.address)
    expect(await pool.token1()).to.equal(token1.address)
    expect(await pool.reserve0()).to.equal(0)
    expect(await pool.reserve1()).to.equal(0)
  })

  it("Should add initial liquidity to reserves", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 1)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 50000)).wait()
    await (await pool.connect(accounts[1]).add(1, 50000)).wait()

    expect(await pool.reserve0()).to.equal(1)
    expect(await pool.reserve1()).to.equal(50000)
    expect(await pool.totalSupply()).to.equal(100000) // Initial Supply
    expect(await pool.balanceOf(accounts[1].address)).to.equal(100000)
  })

  it("Should mint correct amount", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 1)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 50000)).wait()
    await (await pool.connect(accounts[1]).add(1, 50000)).wait()

    await (await token0.connect(accounts[2]).approve(pool.address, 3)).wait()
    await (await token1.connect(accounts[2]).approve(pool.address, 150000)).wait()
    await (await pool.connect(accounts[2]).add(3, 150000)).wait()

    expect(await pool.reserve0()).to.equal(4)
    expect(await pool.reserve1()).to.equal(200000)
    expect(await pool.totalSupply()).to.equal(400000)

    expect(await pool.balanceOf(accounts[1].address)).to.equal(100000)
    expect(await pool.balanceOf(accounts[2].address)).to.equal(300000)
  })

  it("Should burn correct amount", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 1)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 50000)).wait()
    await (await pool.connect(accounts[1]).add(1, 50000)).wait()

    await (await token0.connect(accounts[2]).approve(pool.address, 3)).wait()
    await (await token1.connect(accounts[2]).approve(pool.address, 150000)).wait()
    await (await pool.connect(accounts[2]).add(3, 150000)).wait()

    const token0BalanceBefore = await token0.balanceOf(accounts[1].address)
    const token1BalanceBefore = await token1.balanceOf(accounts[1].address)

    const lpTokens = await pool.balanceOf(accounts[1].address)
    await (await pool.connect(accounts[1]).remove(lpTokens)).wait()

    expect(await token0.balanceOf(accounts[1].address)).to.equal(token0BalanceBefore.add(1))
    expect(await token1.balanceOf(accounts[1].address)).to.equal(token1BalanceBefore.add(50000))

    expect(await pool.reserve0()).to.equal(3)
    expect(await pool.reserve1()).to.equal(150000)
    expect(await pool.totalSupply()).to.equal(300000)
    expect(await pool.balanceOf(accounts[1].address)).to.equal(0)
  })

  it("Should return correct output amount for token1", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 5)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 250000)).wait()
    await (await pool.connect(accounts[1]).add(5, 250000)).wait()

    const [amountOut, reserve0, reserve1] = await pool.getAmountOut(1, token0.address)
    expect(amountOut).to.equal(41667)
    expect(reserve0).to.equal(6)
    expect(reserve1).to.equal(208333)
  })

  it("Should return correct output amount for token0", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 20)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 1000000)).wait()
    await (await pool.connect(accounts[1]).add(20, 1000000)).wait()

    const [amountOut, reserve0, reserve1] = await pool.getAmountOut(120000, token1.address)
    expect(amountOut).to.equal(3)
    expect(reserve0).to.equal(17)
    expect(reserve1).to.equal(1120000)
  })

  it("Should swap successfully with exact amountOut", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 5)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 250000)).wait()
    await (await pool.connect(accounts[1]).add(5, 250000)).wait()

    await (await token0.connect(accounts[2]).approve(pool.address, 20)).wait()
    await (await token1.connect(accounts[2]).approve(pool.address, 1000000)).wait()
    await (await pool.connect(accounts[2]).add(20, 1000000)).wait()

    const token0BalanceBefore = await token0.balanceOf(accounts[3].address)
    const token1BalanceBefore = await token1.balanceOf(accounts[3].address)

    const [amountOut] = await pool.getAmountOut(1, token0.address)
    await (await token0.connect(accounts[3]).approve(pool.address, amountOut)).wait
    await (await pool.connect(accounts[3]).swap(1, amountOut, token0.address, token1.address, accounts[3].address))

    expect(await token0.balanceOf(accounts[3].address)).to.equal(token0BalanceBefore.sub(1))
    expect(await token1.balanceOf(accounts[3].address)).to.equal(token1BalanceBefore.add(48077))
  })

  it("Should prevent slip when output slides", async function() {
    await (await token0.connect(accounts[1]).approve(pool.address, 20)).wait()
    await (await token1.connect(accounts[1]).approve(pool.address, 1000000)).wait()
    await (await pool.connect(accounts[1]).add(20, 1000000)).wait()

    const [amountOut] = await pool.getAmountOut(1, token0.address)
    await (await token0.connect(accounts[2]).approve(pool.address, amountOut)).wait
    await (await pool.connect(accounts[2]).swap(1, amountOut, token0.address, token1.address, accounts[2].address))

    await (await token0.connect(accounts[3]).approve(pool.address, amountOut)).wait
    await expect(pool.connect(accounts[3]).swap(1, amountOut, token0.address, token1.address, accounts[3].address)).to.be.revertedWith('Slipped... on a banana')
  })
})