/* strategy Module */
/* global prices */

// https://jamesbachini.com/order-execution-strategy/#Cross-Market-Moving-Average

const fetch = require('node-fetch');
const utils = require('./../utils.js');
const credentials = require('./../credentials.js');
const ftx = require('./../ftx.js');

const subAccount = 'S5';
const batchState = {};

setInterval(async () => {
  if (!batchState.spot || !batchState.future) return false;
	const res1Promise = fetch(`https://ftx.com/api/markets/${batchState.spot}/candles?resolution=15&limit=20`).catch(err => utils.errorLog(err));
	const res2Promise = fetch(`https://ftx.com/api/markets/${batchState.future}/candles?resolution=15&limit=20`).catch(err => utils.errorLog(err));
	const res1 = await res1Promise;
	const res2 = await res2Promise;
	const spotCandles = await res1.json().catch(err => utils.errorLog(err));
	const futureCandles = await res2.json().catch(err => utils.errorLog(err));
	const premiumArray = [];
	for (let i = 0; i < 10; i++) {
		const spotPrice = parseFloat(spotCandles.result[i].close);
		const futurePrice = parseFloat(futureCandles.result[i].close);
		const premium = futurePrice - spotPrice;
		premiumArray.push(premium);
	}
	const premiumSMA = utils.calculateSMA(premiumArray);
  const premiumNow = prices[batchState.future].askPrice - prices[batchState.spot].bidPrice;
  console.log('S5. Premium', premiumSMA, premiumNow);
  batchState.trades.forEach(async (trade) => {
    if (trade.targetMarket === batchState.future &&  trade.longShort === 'SHORT' || trade.targetMarket === batchState.spot &&  trade.longShort === 'LONG' ) {
      // Assumes we want a higher premium when selling future
      if (premiumNow > premiumSMA) {
        trade.paused = false;
      } else {
        trade.paused = true;
      }
    } else {
      if (premiumNow < premiumSMA) {
        trade.paused = false;
      } else {
        trade.paused = true;
      }
    }
  });
}, 15000);

const strategy = {

	calcPrice: (trade) => {
		let price = 0;
		if (trade.longShort === 'LONG') {
			price = prices[trade.targetMarket].bidPrice;
		}
		if (trade.longShort === 'SHORT') {
			price = prices[trade.targetMarket].askPrice;
		}
		return price;
	},

	initiateTrade: async (markets) => {
		return new Promise((resolve, reject) => {
			batchState.tradeCountDown = markets.length;
			markets.forEach(async (mkt) => {
				const trade = {};
				trade.longShort = mkt.longShort;
				trade.subAccount = subAccount;
				trade.targetMarket = mkt.market;
        trade.paused = true; // Pause Markets
        if (trade.targetMarket.includes('-')) batchState.future = trade.targetMarket;
        if (trade.targetMarket.includes('/')) batchState.spot = trade.targetMarket;
				const asset = trade.targetMarket.split(/(-|\/)/g)[0];
				trade.size = mkt.batchSize;
				trade.sizeIncrement = mkt.sizeIncrement;
				trade.priceIncrement = mkt.priceIncrement;
        trade.priceDecimals = utils.countDecimals(mkt.priceIncrement);
				trade.ts = new Date().getTime();
				trade.placeOnly = true;
				trade.promiseResolve = resolve;
				trade.promiseReject = reject;
				if (!batchState.trades) batchState.trades = [];
				batchState.trades.push(trade);
				strategy.executeTrade(trade);
			});
		});
	},

	executeTrade: async (trade,remaining=false) => {
    if (trade.paused === true) {
      setTimeout(() => {
        strategy.executeTrade(trade,remaining);
      }, 1000);
      return false;
    }
		const ts = new Date().getTime();
		const price = strategy.calcPrice(trade);
		trade.currentPrice = price;
		if (remaining) {
			trade.targetSize = remaining;
		} else {
			trade.targetSize = trade.size;
		}
		if (trade.targetSize < trade.sizeIncrement) {
			utils.log(`${trade.subAccount} ${new Date().toLocaleTimeString()} MIN SIZE ERROR ${trade.targetSize} ${trade.size}`);
			strategy.finishTrade(trade);
			return false;
		}
		trade.side = false;
		if (trade.longShort === 'LONG') trade.side = 'BUY';
		if (trade.longShort === 'SHORT') trade.side = 'SELL';
		if (typeof trade.placeOnly === 'undefined') trade.placeOnly = true;
		if (typeof trade.reduceOnly === 'undefined') trade.reduceOnly = false;
		utils.log(`${trade.subAccount} ${new Date().toLocaleTimeString()} OPENING ${trade.targetMarket} ${trade.longShort} ${trade.currentPrice} ${trade.targetSize}`);
		trade.openID = await ftx.order(trade.side, trade.targetMarket, utils.numberString(trade.targetSize), utils.numberString(trade.currentPrice), credentials[trade.subAccount],false,trade.placeOnly).catch((err) => utils.log(err));
		trade.inTrade = true;
		trade.inExecution = false;
	},

	finishTrade: async (trade) => {
		trade.inTrade = false;
		trade.inExecution = false;
		utils.log(`${trade.subAccount} ${new Date().toLocaleTimeString()} EXECUTED ${trade.targetMarket} ${trade.longShort} ${trade.currentPrice} ${trade.executedQty}`);
		batchState.tradeCountDown -= 1;
    batchState.trades.forEach(async (trade) => { // unpause spot trade on futures completion
      trade.paused = false;
    });
    const ts = new Date().getTime();
		if (batchState.tradeCountDown === 0)	trade.promiseResolve(ts);
	},

	priceUpdate: async () => {
		if (!batchState.trades) return false;
		batchState.trades.forEach(async (trade) => {
			if (!trade.inTrade || trade.inExecution) return false;
			const price = strategy.calcPrice(trade);
			if (trade.currentPrice !== price) {
				trade.inExecution = true;
				const res1 = await ftx.cancel(trade.targetMarket, trade.openID, credentials[trade.subAccount]).catch((err) => utils.log(err));
				if (res1 && utils.round(res1.executedQty) >= trade.targetSize * 0.995) { // allow for fees
					trade.executedQty = utils.round(res1.executedQty);
					trade.executedPrice = utils.round(res1.price);
					strategy.finishTrade(trade);
				} else if (res1 && utils.round(res1.executedQty) > 0) {
					trade.executedQty = utils.round(res1.executedQty);
					const remaining = utils.round(trade.targetSize - trade.executedQty); // partial fill
					strategy.executeTrade(trade,remaining);
				} else {
					strategy.executeTrade(trade,trade.targetSize); // Get it done
				}
			}
		});
	},

}

module.exports = strategy;