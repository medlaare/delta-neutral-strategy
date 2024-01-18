const fetch = require('node-fetch');
const utils = require('./utils.js');

const markets = [{
		market: 'BTC/USD',
		longShort: 'LONG',
		batchSize: 0.0001,
		sizeIncrement: 0.0001,
		priceIncrement: 1,
	},{
		market: 'BTC-1231',
		longShort: 'SHORT',
		batchSize: 0.0001,
		sizeIncrement: 0.0001,
		priceIncrement: 1,
	}];

const findPremiumSMA = async () => {
	const res1Promise = fetch(`https://ftx.com/api/markets/BTC/USD/candles?resolution=15&limit=20`).catch(err => utils.errorLog(err));
	const res2Promise = fetch(`https://ftx.com/api/markets/BTC-1231/candles?resolution=15&limit=20`).catch(err => utils.errorLog(err));
	const res1 = await res1Promise;
	const res2 = await res2Promise;
	const spotCandles = await res1.json().catch(err => utils.errorLog(err));
	const futureCandles = await res2.json().catch(err => utils.errorLog(err));
	const premiumArray = [];
	console.log(spotCandles.result);
	for (let i = 0; i < 10; i++) {
		const spotPrice = parseFloat(spotCandles.result[i].close);
		const futurePrice = parseFloat(futureCandles.result[i].close);
		const premium = futurePrice - spotPrice;
		premiumArray.push(premium);
	}
	const premiumSMA = utils.calculateSMA(premiumArray);
	console.log(premiumArray,premiumSMA);
	return premiumSMA;
}

(async () => {
	const premiumSMA = await findPremiumSMA();
	console.log(`Premeium SMA: $${premiumSMA}`);
})();