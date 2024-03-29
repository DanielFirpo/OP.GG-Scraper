const express = require('express')
const app = express()
const port = 4546
const dotenv = require("dotenv");
const puppeteer = require("puppeteer")
const fs = require("fs");
var https = require('https');

dotenv.config();

let streamerData = [];

async function scrapeData() {

    let newStreamerData = []

    let rawdata = fs.readFileSync('streamers.json');
    streamers = JSON.parse(rawdata).streamers;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

    for (let streamer of streamers) {

        const page = await browser.newPage();

        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36");

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
                req.abort();
            }
            else {
                req.continue();
            }
        });

        let streamerStats = null;

        try {

            await page.goto('https://www.op.gg/summoners/kr/' + encodeURIComponent(streamer.accountName));

            streamerStats = await page.evaluate(async () => {
                return await new Promise(resolve => {
                    let winsAndLosses = document.querySelector(".win-lose div").textContent;

                    let wins = "";
                    let losses = "";
                    let doneParsingWins = false;
                    for (let character of winsAndLosses) {
                        if (!doneParsingWins) {
                            if (character.toLocaleLowerCase() == "w") {
                                doneParsingWins = true
                            }
                            else {
                                if (character != undefined)
                                    wins += character;
                            }
                        }
                        else {
                            if (character.toLocaleLowerCase() != "l") {
                                losses += character;
                            }
                            else {
                                break;
                            }
                        }
                    }
                    wins = parseInt(wins);
                    losses = parseInt(losses);

                    let lp = document.querySelector(".lp").textContent;
                    lp = lp.replace(/LP/g, '');
                    lp = lp.replace(/,/g, '');
                    lp = parseInt(lp);

                    let ladderRank = document.querySelector(".ranking").textContent;
                    ladderRank = ladderRank.replace(/,/g, '');
                    ladderRank = parseInt(ladderRank);

                    resolve({ lp: lp, rankName: document.querySelector(".tier").textContent, ladderRank: ladderRank, totalWins: wins, totalLosses: losses });
                })
            });

            await page.close();
        } catch {
            console.log("error getting opgg data for ", streamer.streamerName, "has the account name (previously", streamer.accountName, ") been changed?")
        }

        if (streamerStats) {
            console.log("got streamer stats:", streamerStats)

            streamerStats.streamerName = streamer.streamerName;
            streamerStats.accountName = streamer.accountName;

            newStreamerData.push(streamerStats);
        }
    };

    streamerData = newStreamerData;

    await browser.close();

    setTimeout(() => { scrapeData() }, 600000);

}

scrapeData();

app.get('/streamerData', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(streamerData);
})

//production:
// console.log("starting https server with key", fs.readFileSync(process.env.SSL_KEY_PATH, "utf8"), "and cert", fs.readFileSync(process.env.SSL_CERT_PATH, "utf8"), "which paths are", process.env.SSL_KEY_PATH, process.env.SSL_CERT_PATH)
var httpsServer = https.createServer({ key: fs.readFileSync(process.env.SSL_KEY_PATH, "utf8"), cert: fs.readFileSync(process.env.SSL_CERT_PATH, "utf8") }, app);

httpsServer.listen(port);

//local:
// app.listen(port);