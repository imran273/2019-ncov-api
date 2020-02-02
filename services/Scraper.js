const axios = require('axios');
const cheerio = require('cheerio');
const dotenv = require('dotenv');
const NodeGeocoder = require('node-geocoder');
const geocoder = NodeGeocoder({
	provider: 'openstreetmap'
});
dotenv.config();

const stringToNumber = str => +str.replace(/,/g, '');

class Scraper {
	async getHTML(url) {
		const res = await axios(url);
		return cheerio.load(res.data);
	}
	
	async getTimeline() {
		const url = 'https://bnonews.com/index.php/2020/01/timeline-coronavirus-epidemic/';
		const $ = await this.getHTML(url);
		const timelineDiv = $('#mvp-content-main');
		
		return timelineDiv
		.find('h4')
		.toArray()
		.map((h4, h4Idx) => ({
			date: $(h4).text().trim(),
			time: timelineDiv
			.find('ul')
			.eq(h4Idx)
			.children('li')
			.toArray()
			.map((li) => ({
				time_and_description: $(li).text().trim().replace(' (Source)', ''),
				source: $(li).find('a').attr('href')
			}))
		}));
	}
	
	async getConfirmedCases() {
		const url = 'https://www.worldometers.info/coronavirus/';
		const $ = await this.getHTML(url);
		const data = [];
		$('#table3 tbody tr').each((idx, el) => {
			const td = $(el).children('td');
			const deathIdx = td.length === 5 ? 3 : 2;
			const regionIdx = td.length === 5 ? 4 : 3;
			const obj = {
				country: td.eq(0).text().trim(),
				cases: +td.eq(1).text().trim().replace(/,/g, ''),
				deaths: +td.eq(deathIdx).text().trim().replace(/,/g, ''),
				region: td.eq(regionIdx).text().trim(),
			}
			data.push(obj);
		});
		
		return Promise.all(data.map((item) => {
			return this.geocode(item.country)
			.then(({ lat, lon }) => {
				return {
					...item,
					coordinates: { lat, lon }
				}
			})
		}));
	}
	
	async getMainlandChinaDailyReport() {
		const url = 'https://en.wikipedia.org/wiki/2019%E2%80%9320_Wuhan_coronavirus_outbreak';
		const $ = await this.getHTML(url);
		const data = [];
		$('.barbox table tbody tr').each((idx, el) => {
			if (idx === 0 || idx === 1) return;
			const td = $(el).children('td');
			data.push({
				date: td.eq(0).text().trim(),
				count: td.eq(2).text().trim()
			});
		});
		return data;
	}
	
	async getDailyDeaths() {
		const url = 'https://www.worldometers.info/coronavirus/coronavirus-death-toll/';
		const $ = await this.getHTML(url);
		const data = [];
		$('h3:contains("Daily Deaths of Novel Coronavirus (2019-nCoV)")')
		.next()
		.find('tbody tr')
		.each((_, el) => {
			const td = $(el).children('td');
			data.push({
				date: td.eq(0).text().trim(),
				count: +td.eq(1).text().trim().replace(/,/g, '')
			});
		});
		return data.reverse();
	}
	
	async geocode(address) {
		const results = await geocoder.geocode(address);
		return {
			lat: results[0].latitude,
			lon: results[0].longitude,
		};
	}
}

module.exports = Scraper;