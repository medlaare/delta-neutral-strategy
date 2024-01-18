/* Utility Functions */
/* global prices */
const fs = require('fs');

const utils = {
	log: async (msg, msg2=false, msg3=false) => {
		console.log(msg);
		if (msg2) console.log(msg2);
		if (msg3) console.log(msg3);
		const yymmdd = new Date().toISOString().slice(2,10).replace(/-/g,'');
		/*
		fs.appendFile(`./data/${yymmdd}-log.txt`, msg+"\n", (err) => {
			if (err) console.error(err)
		});
		*/
	},

	/* Calculate Price Point Between A Diagonal Time/Price Line */
	calculateDiagonal: (startPrice,endPrice,startTime,endTime,now) => {
		const timeDifference = endTime - startTime;
		const nowDifference = now - startTime;
		const timePercentage = (nowDifference / timeDifference) * 100;
		
		const priceDifference = endPrice - startPrice;
		const priceAddition = (timePercentage / 100) * priceDifference;
		return startPrice + priceAddition;
	},

	/* Relative Strength Indicator */
	calculateRSI: (priceArray) => {
		let sumGain = 0;
		let sumLoss = 0;
		for (let i = 1; i < priceArray.length; i++) {
			const difference = priceArray[i] - priceArray[i-1];
				if (difference >= 0) {
					sumGain += difference;
				} else {
					sumLoss -= difference;
				}
		}
		if (sumGain === 0) return 0;
		if (sumLoss === 0) return 100;
		const relativeStrength = sumGain / sumLoss;
		return 100.0 - (100.0 / (1 + relativeStrength));
	},

	/* Simple Moving Average - returns the mean average of an array */
	calculateSMA: (arr, range=false) => {
		if (!range) range = arr.length;
		let sum = 0;
		if (range > arr.length) range = arr.length;
		for (let ii = arr.length - range; ii < arr.length; ii++){
			sum += arr[ii];
		}
		return sum / range;
	},

	/* Exponential Moving Average - returns the EMA of an array */
	calculateEMA: (arr,range=false) => {
		if (!range) range = arr.length;
		const yma = arr.reduce((p,n,i) => i ? p.concat(2*n/(range+1) + p[p.length-1]*(range-1)/(range+1)) : p, [arr[0]]);
		return yma[yma.length-1];
	},

	/* Weighted Moving Average - returns our version of a WMA of an array */
	calculateWMA: (arr,range=false) => {
		if (!range) range = arr.length;
		const recentRange = Math.round(range / 4);
		const sma1 = utils.calculateSMA(arr,range);
		const sma2 = utils.calculateSMA(arr,recentRange);
		const ema = (sma1 + sma1 + sma2) / 3;
		return ema;
	},

	/* Calulate Median - returns the median average of an array */
	calculateMedian: (arr) => {
		const mid = Math.floor(arr.length / 2);
		const nums = [...arr].sort((a, b) => a - b);
		return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
	},

	/* Generate a api safe string for qty and price */
	numberString:  (num,decimals=8) => {
		return Number(num).toFixed(decimals).replace(/\.?0+$/,"");
	},

	round: (num,decimals=8,down=false) => {
		if (typeof num !== 'number') num = parseFloat(num);
		const multiplier = 10 ** decimals;
		let roundedNumber = Math.round(num * multiplier) / multiplier;
		if (down) roundedNumber = Math.floor(num * multiplier) / multiplier;
		return Number(roundedNumber);
	},

	countDecimals: (value) => { 
    if ((value % 1) != 0) 
			return value.toString().split(".")[1].length;  
    return 0;
	},

	errorLog: async (err) => {
		let errMsg;
		if (err.error) {
			errMsg = err.error;
		} else {
			errMsg = JSON.stringify(err);
		}
		console.error(`${new Date().toLocaleTimeString()} ERROR: ${errMsg}`);
	},

}

module.exports = utils;
