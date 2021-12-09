const multiplierInfo = 'The multiplier is a value between 0 and 1 calculated by the Vestiplier that is applied to the gross reward calculated by the Autoregulator. The resultant net reward is the reward you will receive. The multiplier depends on the vesting blocks and unbonding blocks you set when you added the deposit, and is locked in at that point (it will never decrease). The gross reward depends on the general farming population and the farming fund balance. The larger your deposit and the longer you have deposited (this is your cumulative amount) compared to other farmers, the larger your gross reward.';

function vestiplierInfo(insert) {
  return `The higher this is relative to other yield farmers as a weighted average combined with ${insert} blocks, the higher the multiplier. ${multiplierInfo}`;
}

function assInfo(insert) {
  return `Because of the algorithms of the Automated Superyield System subcomponents, this ${insert} may change significantly depending on the future activity of current and new yield farmers as well as sellers who fund the farming fund. It is therefore advised that you consider your yield farming strategy carefully when choosing your vesting blocks and unbonding blocks settings. This is a gamified yield farming platform unlike any other. The yield may fluctuate right up until you withdraw.`;
}

export const resources = {
  LOADING: 'Loading',
  MOON_FARMING: 'Moon Farming',
  START_FARMING: 'Start Farming',
  ADD_DEPOSIT: 'Add Deposit',
  BLOCK_NUMBER: {
    TITLE: 'Block Number',
    INFO: 'The number of the current block on the blockchain. This increases sequentially.'
  },
  SELL_QUOTA: {
    TITLE: 'Sell Quota',
    INFO: 'The net total of buys and sells within the current 24-hour capture period plus a margin of 1 billion.',
    DETAILS: 'If this goes below zero, the operative fee rate will start to escalate.'
  },
  FARMING_FUND_BALANCE: {
    TITLE: 'Farming Fund Balance',
    INFO: 'The number of tokens available for distribution as rewards to yield farmers.',
    DETAILS: 'This is automatically funded by way of a fee on each sell.'
  },
  OPERATIVE_FEE_RATE: {
    TITLE: 'Operative Fee Rate',
    INFO: 'The actual fee rate that will apply to any sell that takes place at this moment.',
    DETAILS: 'If the sell quota is below zero, this will be higher than the regular base rate.'
  },
  ELEEMOSYNARY_DONATION_RATE: {
    TITLE: 'Eleemosynary Donation Rate',
    INFO: 'The fee that is applied to each sell that is automatically donated to the eleemosynary fund.'
  },
  FARMING_FUND_SOW_RATE: {
    TITLE: 'Farming Fund Sow Rate',
    INFO: 'The fee that is applied to each sell that is used to supply the farming fund.'
  },
  TOTAL_BALANCE: {
    TITLE: 'Total Balance',
    INFO: 'The total number of tokens you hold including locked tokens.'
  },
  LOCKED_BALANCE: {
    TITLE: 'Locked Balance',
    INFO: 'The number of tokens that are locked due to farming and unbonding.',
    DETAILS: 'If any are unbonding, this will be indicated separately within this stat.'
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
    INFO: 'The number of blocks your deposit will be locked for before you can withdraw your deposit and claim farming rewards.',
    DETAILS: vestiplierInfo('unbonding')
  },
  UNBONDING_BLOCKS: {
    TITLE: 'Unbonding Blocks',
    INFO: 'The number of blocks your deposit will be locked for after you withdraw your deposit.',
    DETAILS: vestiplierInfo('vesting')
  },
  VEST_FORECAST_REWARD: {
    TITLE: 'Vest Forecast Reward',
    INFO: 'The forecast reward you would receive if you withdrew your deposit upon vesting based on the entered values.',
    DETAILS: assInfo('forecast')
  },
  VEST_ESTIMATED_APY: {
    TITLE: 'Vest Estimated APY',
    INFO: 'The estimated annual percentage yield that you can expect in rewards up to the point of vesting based on the entered values.',
    DETAILS: assInfo('estimation')
  },
  FARMING_SUMMARY: {
    TITLE: 'Farming Summary',
    BLOCK_NUMBER: {
      TITLE: 'Block Number',
      INFO: 'The block number when this deposit was added.'
    },
    DEPOSIT_AMOUNT: {
      TITLE: 'Deposit Amount',
      INFO: 'The number of tokens that are deposited.'
    },
    PENDING_BLOCKS: {
      TITLE: 'Pending Blocks',
      INFO: 'The number of blocks remaining before you can withdraw your deposit, after which they will start to unbond.'
    },
    UNBONDING_BLOCKS: {
      TITLE: 'Unbonding Blocks',
      INFO: 'The number of blocks your deposit will be locked for after you withdraw your deposit.'
    },
    ESTIMATED_APY: {
      TITLE: 'Estimated APY',
      INFO: 'The annual percentage yield that you can expect in rewards up to the point of vesting or the current block, whichever is the latest.'
    },
    MULTIPLIER: {
      TITLE: 'Multiplier',
      INFO: multiplierInfo
    },
    CURRENT_REWARD: {
      TITLE: 'Current Reward',
      INFO: 'The reward that you have earned up to now which may only be claimed once your deposit vests.',
      DETAILS: 'Remember, this may go up or down up until the moment you withdraw depending on the general farming population and the farming fund which is seeded by sell activity.This is the gamified nature of this farming platform.'
    },
    WITHDRAW: {
      TITLE: 'Withdraw',
      INFO: 'The amount of the deposit that you wish to withdraw. This will be withdrawn when you press the Withdraw button, and your tokens will start to unbond.'
    }
  },
  UNBONDING_SUMMARY: {
    TITLE: 'Unbonding Summary',
    AMOUNT: {
      TITLE: 'Amount',
      INFO: 'The number of tokens that are unbonding.',
    },
    PENDING_BLOCKS: {
      TITLE: 'Pending Blocks',
      INFO: 'The number of blocks remaining before your deposit will be fully unlocked.',
    },
    TIME_REMAINING: {
      TITLE: 'Time Remaining',
      INFO: 'The time remaining before your deposit will be fully unlocked.'
    }
  }
}
