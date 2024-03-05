const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { URL } = require('url');

puppeteer.use(StealthPlugin());

const url = 'https://wellfound.com/discover/startups?location=bangalore-urban';

const launchOptions = {
    product: 'firefox',
    executablePath: '/Applications/Firefox.app/Contents/MacOS/firefox',
    headless: false,
    slowMo: 100
}

//csv file configuration
const csvWriter = createCsvWriter({
    path: 'output.csv',
    header: [
        { id: 'name', title: 'Company Name' },
        { id: 'about', title: 'About' },
        { id: 'size', title: 'Company Size' },
        { id: 'fund', title: 'Company Funding' },
        { id: 'location', title: 'Locations' },
        { id: 'market', title: 'Markets' },
        { id: 'job', title: 'Job Openings' },
    ],
});

async function scrapeJobOpenings() {
    const browser = await puppeteer.launch(launchOptions);
    console.log("Browser", browser);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });  // Increase the timeout as needed
        const limitedLists = await page.$$("a[href^='/company/']");
        console.log(limitedLists.length);
        const companyLists = new Array();
        let i = 0;

        for (const company of limitedLists) {
            companyLists.push(await company.evaluate(element => element.getAttribute('href')));
            i++;
            if(i === 10) break;
        }

        for (const href of companyLists) {
            try {
                console.log('href:', href);

                const match = href.match(/\/company\/(.*)/);
                const completeUrl = new URL(`${href}/jobs`, url).href;
                await page.goto(completeUrl, { waitUntil: 'domcontentloaded' });
                console.log('Navigated to:', completeUrl);

                const h2 = await page.$('h2');
                const dts = await page.$$('dt');
                const locationhrefs = await page.$$("a[href^='/startups/location/']");
                const marketrefs = await page.$$("a[href^='/startups/industry/']");
                const job = await page.$$('.styles_component__2UhSH');

                const companyName = match[1];
                console.log("companyName", companyName);

                const companyDescription = await h2.evaluate(element => element.textContent);
                console.log("companyDescription", companyDescription);

                const companySize = await dts[2].evaluate(element => element.textContent);
                console.log("companySize", companySize);

                const companyFunding = await dts[3].evaluate(element => element.textContent);
                console.log("companyFunding", companyFunding);

                const companyLocations = new Set();
                for (let locationhref of locationhrefs) {
                    companyLocations.add(await locationhref.evaluate(element => element.textContent));
                }
                console.log("companyLocations", companyLocations);

                const companyMarkets = new Set();
                for (let marketref of marketrefs) {
                    companyMarkets.add(await marketref.evaluate(element => element.textContent));
                }
                console.log("companyMarkets", companyMarkets);

                const postions = new Set();
                const departments = new Set();
                const jobDescriptions = new Set();
                const jobLocations = new Set();
                const jobSalaries = new Set();
                const jobInfo = new Array();

                for (let i = 0; i < 2; i++) {
                    const position = await job[i].evaluate(element => element ? element.querySelector('h4').textContent : null);
                    // if(position === null) {
                    //     position = "Not Available";
                    // }
                    postions.add(position);
                    console.log("position", position);

                    const department = await job[i].evaluate(element => element ? element.querySelector('h6').textContent : null);
                    // if(department === null) {
                    //     position = "Not Available";
                    // }
                    departments.add(department);
                    console.log("department", department);

                    const jobDescription = await job[i].evaluate(element => element ? element.querySelector('.styles_descriptionSnippet__j1vlH').textContent : null);
                    // if(department === null) {
                    //     position = "Not Available";
                    // }
                    jobDescriptions.add(jobDescription);
                    console.log("jobDescription", jobDescription);

                    const jobLocation = await job[i].evaluate(element => element ? element.querySelector('.line-clamp-2').textContent : null);
                    // if(jobLocation === null) {
                    //     position = "Not Available";
                    // }
                    jobLocations.add(jobLocation);
                    console.log("jobLocation", jobLocation);

                    const jobSalary = await job[i].evaluate(element => element ? element.querySelector('.styles_compensation__DUzmb').textContent : null);
                    // if(jobSalary === null) {
                    //     position = "Not Available";
                    // }
                    jobSalaries.add(jobSalary);
                    console.log("jobSalary", jobSalary);

                    jobInfo.push({
                        position,
                        department,
                        jobDescription,
                        jobLocation,
                        jobSalary
                    });
                }

                const data = [{
                    name: companyName,
                    about: companyDescription,
                    size: companySize,
                    fund: companyFunding,
                    location: Array.from(companyLocations).join(', '),
                    market: Array.from(companyMarkets).join(', '),
                    job: JSON.stringify(jobInfo)
                }];

                csvWriter
                    .writeRecords(data)    // returns a promise
                    .then(() => {
                        console.log('...Done');
                    })
                    .catch((err) => {
                        console.log(err);
                    });
            }
            catch (error) {
                continue;
            }
        }

    } catch (error) {
        if (error.message.includes('Protocol error (Runtime.callFunctionOn): Could not find object with given id')) {
            console.error('Caught a Protocol error, retrying...');
            // Retry or handle accordingly

        } else {
            throw error; // Re-throw other errors
        }
    } finally {
        await browser.close();
    }
}

scrapeJobOpenings();