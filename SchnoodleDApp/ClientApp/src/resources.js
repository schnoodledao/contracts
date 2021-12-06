function multiplierExplain(insert) {
  return `The higher this is relative to other yield farmers as a weighted average combined with ${insert} blocks, the higher the multiplier (between 0 and 1) that is applied to your gross reward based on the Vestiplier sigmoid curve formula 1 ÷ (1 + e⁻ˣ). The resultant net reward is the reward you will receive.`;
}

function autovestiplierExplain(insert) {
  return `Because of the Gamified Dynamic Yield caused by the Autovestiplier, this ${insert} may change significantly depending on the future activity of current and new yield farmers as well as sellers who fund the farming fund. It is therefore advised that you consider your yield farming strategy carefully when choosing your vesting blocks and unbonding blocks settings. This is a gamified yield farming platform unlike any other. The yield may fluctuate right up until you withdraw.`;
}

export const resources = {
  BLOCK_NUMBER: {
    TITLE: 'Block Number',
    INFO: 'The number of the current block on the blockchain. This increases sequentially.'
  },
  SELL_QUOTA: {
    TITLE: 'Sell Quota',
    INFO: 'The net total of buys and sells within the current 24-hour capture period plus a margin of 1b. If this goes below zero, the operative fee rate will start to escalate.'
  },
  FARMING_FUND_BALANCE: {
    TITLE: 'Farming Fund Balance',
    INFO: 'The number of tokens available for distribution as rewards to yield farmers. This is automatically funded by way of a fee on each sell.'
  },
  OPERATIVE_FEE_RATE: {
    TITLE: 'Operative Fee Rate',
    INFO: 'The actual fee rate that will apply to any sell that takes place at this moment. If the sell quota is below zero, this will be higher than the regular base rate.'
  },
  ELEEMOSYNARY_DONATION_RATE: {
    TITLE: 'Eleemosynary Donation Rate',
    INFO: 'The tax that is applied to each sell that is automatically donated to the eleemosynary fund.'
  },
  FARMING_FUND_SOW_RATE: {
    TITLE: 'Farming Fund Sow Rate',
    INFO: 'The fee that is charged to each sell that is used to supply the farming fund.'
  },
  TOTAL_BALANCE: {
    TITLE: 'Total Balance',
    INFO: 'The total number of tokens you hold including locked tokens.'
  },
  LOCKED_BALANCE: {
    TITLE: 'Locked Balance',
    INFO: 'The number of tokens that are locked due to farming and unbonding. If any are unbonding, this will be indicated within the stat.'
  },
  AVAILABLE_AMOUNT: {
    TITLE: 'Available Amount',
    INFO: 'The number of tokens that are available to be deposited which is your total balance less your locked balance.'
  },
  DEPOSIT_AMOUNT: {
    TITLE: 'Deposit Amount',
    INFO: 'The number of tokens you wish to deposit.'
  },
  VESTING_BLOCKS: {
    TITLE: 'Vesting Blocks',
    INFO: 'The number of blocks your deposit will be locked for before you can withdraw your deposit and claim farming rewards. ' + multiplierExplain('unbonding')
  },
  UNBONDING_BLOCKS: {
    TITLE: 'Unbonding Blocks',
    INFO: 'The number of blocks your deposit will be locked for after you withdraw your deposit. ' + multiplierExplain('vesting')
  },
  VEST_FORECAST_REWARD: {
    TITLE: 'Vest Forecast Reward',
    INFO: 'The forecast reward you would receive if you withdrew your deposit upon vesting based on the entered values. ' + autovestiplierExplain('forecast')
  },
  ESTIMATED_APY: {
    TITLE: 'Estimated APY',
    INFO: 'The annual percentage yield that you can expect in rewards based on the entered values. ' + autovestiplierExplain('estimated APY')
  }
}
