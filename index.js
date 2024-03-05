require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { URL } = require('url');

puppeteer.use(StealthPlugin());

const loginUrl = 'https://wellfound.com/login';
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
        { id: 'job1_position', title: 'Job-1 Position' },
        { id: 'job1_department', title: 'Job-1 Department' },
        { id: 'job1_description', title: 'Job-1 Description' },
        { id: 'job1_location', title: 'Job-1 Location' },
        { id: 'job1_salary', title: 'Job-1 Salary' },
        { id: 'job2_position', title: 'Job-2 Position' },
        { id: 'job2_department', title: 'Job-2 Department' },
        { id: 'job2_description', title: 'Job-2 Description' },
        { id: 'job2_location', title: 'Job-2 Location' },
        { id: 'job2_salary', title: 'Job-2 Salary' },
    ],
});

async function scrapeJobOpenings() {
    const browser = await puppeteer.launch(launchOptions);
    console.log("Browser", browser);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    try {
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        // const emailField = await page.$('input[type="email"]');
        await page.waitForSelector('input[type="email"]');
        const emailField = await page.$('input[type="email"]');
        await page.waitForSelector('input[type="password"]');
        const passwordField = await page.$('input[type="password"]');
        await page.waitForSelector('input[type="submit"]');
        const loginField = await page.$('input[type="submit"]');

        if (emailField && passwordField && loginField) {
            // Type some text into the email field
            await emailField.type(process.env.EMAIL);
            await passwordField.type(process.env.PASSWORD);
            await loginField.click();

            await page.waitForNavigation();

            // Perform other interactions as needed
            await page.goto(url, { waitUntil: 'domcontentloaded' });  // Increase the timeout as needed
            await page.waitForSelector("a[href^='/company/']");
            const limitedLists = await page.$$("a[href^='/company/']");
            console.log(limitedLists.length);
            const companyLists = new Array();

            for (let company of limitedLists) {
                companyLists.push(await company.evaluate(element => element.getAttribute('href')));
            }

            let i = 0;
            for (const href of companyLists) {
                try {
                    console.log('href:', href);

                    const match = href.match(/\/company\/(.*)/);
                    const completeUrl = new URL(`${href}/jobs?location=bangalore-urban`, url).href;
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

                    const jobPosition1 = await job[0].evaluate(element => element ? element.querySelector('h4').textContent : null);
                    const jobPosition2 = await job[1].evaluate(element => element ? element.querySelector('h4').textContent : null);

                    const jobDepartment1 = await job[0].evaluate(element => element ? element.querySelector('h6').textContent : null);
                    const jobDepartment2 = await job[1].evaluate(element => element ? element.querySelector('h6').textContent : null);

                    const jobLocation1 = await job[0].evaluate(element => element ? element.querySelector('.line-clamp-2').textContent : null);
                    const jobLocation2 = await job[1].evaluate(element => element ? element.querySelector('.line-clamp-2').textContent : null);

                    const jobDescription1 = await job[0].evaluate(element => element ? element.querySelector('.styles_descriptionSnippet__j1vlH').textContent : null);
                    const jobDescription2 = await job[1].evaluate(element => element ? element.querySelector('.styles_descriptionSnippet__j1vlH').textContent : null);

                    const jobSalary1 = await job[0].evaluate(element => element ? element.querySelector('.styles_compensation__DUzmb').textContent : null);
                    const jobSalary2 = await job[1].evaluate(element => element ? element.querySelector('.styles_compensation__DUzmb').textContent : null);
                    
                    const data = [{
                        name: companyName,
                        about: companyDescription,
                        size: companySize,
                        fund: companyFunding,
                        location: Array.from(companyLocations).join(', '),
                        market: Array.from(companyMarkets).join(', '),
                        job1_position: jobPosition1,
                        job1_department: jobDepartment1,
                        job1_description: jobDescription1,
                        job1_location: jobLocation1,
                        job1_salary: jobSalary1,
                        job2_position: jobPosition2,
                        job2_department: jobDepartment2,
                        job2_description: jobDescription2,
                        job2_location: jobLocation2,
                        job2_salary: jobSalary2
                    }];

                    await csvWriter.writeRecords(data);
                    i++;
                    if (i === 10) break;
                }
                catch (error) {
                    continue;
                }
            }
        }



    } catch (error) {
        console.error('error:', error);
    } finally {
        await browser.close();
    }
}

scrapeJobOpenings();
