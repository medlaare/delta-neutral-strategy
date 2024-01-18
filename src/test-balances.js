const credentials = require('./credentials.js');
const ftx = require('./ftx.js');
const utils = require('./utils.js');

(async () => {
	['S1','S2','S3','S4','S5'].forEach(async (strategy) => {
		const wallet = await ftx.wallet(credentials[strategy]);
		let accountValue = 0;
		wallet.forEach(async (a) => {
			accountValue += a.usdValue;
		});
		console.log(`${strategy}  -  Account Value: $${accountValue.toFixed(2)} `);
	});
})();