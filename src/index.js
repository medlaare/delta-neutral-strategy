/* Crypto Alog Trading Bot v3 */
/* global prices */

const credentials = require('./credentials.js');
const ftx = require('./ftx.js');
const utils = require('./utils.js');
const s1 = require('./strategies/s1.js');
const s2 = require('./strategies/s2.js');
const s3 = require('./strategies/s3.js');
const s4 = require('./strategies/s4.js');
const s5 = require('./strategies/s5.js');

global.prices = {};

const markets = [{
	market: 'BTC/USD',
	longShort: 'LONG',
	batchSize: 0.0005,
	sizeIncrement: 0.0005,
	priceIncrement: 1,
},{
	market: 'BTC-1231',
	longShort: 'SHORT',
	batchSize: 0.0005,
	sizeIncrement: 0.0005,
	priceIncrement: 1,
}];

const init = async () => {
	const results = {}
	await new Promise(r => setTimeout(r, 5000)); // wait for price feed
	for (let batch = 1; batch <= 40; batch++) {
		const startTime = new Date().getTime();
		console.log(`### Starting Order Execution Test - Batch ${batch} ###`);
		const promise1 = s1.initiateTrade(markets);
		await new Promise(r => setTimeout(r, 200)); // avoid order rate limits
		const promise2 = s2.initiateTrade(markets);
		await new Promise(r => setTimeout(r, 200));
		const promise3 = s3.initiateTrade(markets);
		await new Promise(r => setTimeout(r, 200));
		const promise4 = s4.initiateTrade(markets);
		await new Promise(r => setTimeout(r, 200));
		const promise5 = s5.initiateTrade(markets);
		const finishedTimestamps = await Promise.all([promise1,promise2,promise3,promise4,promise5]);
		finishedTimestamps.forEach((finishedTime,i) => {
			const strategy = `S${i+1}`;
			const completionTime = finishedTime - startTime;
			if (!results[strategy]) results[strategy] = { executionTimes: [] };
			results[strategy].executionTimes.push(completionTime);
			console.log(`Completion Time: ${strategy} ${(completionTime/1000).toFixed(1)}sec`);
		});
		console.log(`### Batch ${batch} Finished ###`);
		await new Promise(r => setTimeout(r, 60000)); // Wait 1 mins between batches
	}
	calcResults(results);
	console.log(`### Execution Test Finished ###`);
}

const calcResults = (results) => {
	console.log(`### Order Execution Results ###`);
	Object.keys(results).forEach(async (strategy) => {
		const averageBatchTime = utils.round(results[strategy].executionTimes.reduce((a, b) => a + b, 0) / (results[strategy].executionTimes.length * 1000));
		const wallet = await ftx.wallet(credentials[strategy]);
		let accountValue = 0;
		wallet.forEach((a) => {
			accountValue += a.usdValue;
		});
		console.log(`${strategy}  -  Account Value: $${accountValue.toFixed(2)}  -  Average Batch Time: ${averageBatchTime.toFixed(1)} secs`);
	});
}

const updateHandler = (update) => {
	if (update.channel && update.channel === 'ticker') {
		prices[update.market].askPrice = update.data.ask;
		prices[update.market].bidPrice = update.data.bid;
		prices[update.market].askSize = update.data.askSize;
		prices[update.market].bidSize = update.data.bidSize;
		prices[update.market].midPrice = (prices[update.market].askPrice + prices[update.market].bidPrice) / 2;
		s1.priceUpdate();
		s2.priceUpdate();
		s3.priceUpdate();
		s4.priceUpdate();
		s5.priceUpdate();
	}
};

const marketsArray = [];
markets.forEach((marketData) => {
	marketsArray.push(marketData.market);
	prices[marketData.market] = {};
});

ftx.connectSockets(updateHandler, marketsArray);

process.on('uncaughtException', function(err) {
	console.log('Uncaught Exception 101: ' + err);
	console.error(err.stack);
});

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection 102: ' + p);
	console.log(reason);
});

init();
