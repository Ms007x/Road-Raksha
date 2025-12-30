const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const axios = require('axios');
const UserAgent = require('user-agents');

// Mock Proxy List (In production, use a paid proxy service)
const proxyList = [
    // 'http://username:password@proxy1.com:8080',
    // 'http://username:password@proxy2.com:8080',
    null // Use direct connection as fallback
];

/**
 * Get a random proxy from the list
 */
const getRandomProxy = () => {
    return proxyList[Math.floor(Math.random() * proxyList.length)];
};

/**
 * Get a random user agent
 */
const getRandomUserAgent = () => {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });
    return userAgent.toString();
};

/**
 * Delay function for realistic behavior
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reverse Geocode to get City Name
 * Uses OpenStreetMap Nominatim API
 */
const getCityFromCoordinates = async (lat, lng) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Road-Raksha/1.0' }
        });

        const address = response.data.address;
        return address.city || address.town || address.village || address.county || "Delhi";
    } catch (error) {
        console.error("Reverse geocoding failed:", error.message);
        return "Delhi"; // Fallback
    }
};

/**
 * Normalize text helper
 */
const normalizeText = (text) => text ? text.trim().replace(/\s+/g, ' ') : '';

/**
 * Scrape JustDial for Ambulances in a specific city
 */
const scrapeJustDial = async (lat, lng) => {
    let city = await getCityFromCoordinates(lat, lng);
    city = city.replace(/\s+/g, '-'); // Replace spaces with hyphens for URL
    console.log(`📍 Detected City: ${city}`);

    const url = `https://www.justdial.com/${city}/Ambulance-Services`;
    console.log(`🌐 Scraping URL: ${url}`);

    const proxy = getRandomProxy();
    const headers = { 'User-Agent': getRandomUserAgent() };

    // Launch Options
    const launchOptions = {
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
        ]
    };

    if (proxy) {
        launchOptions.args.push(`--proxy-server=${proxy}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    try {
        await page.setUserAgent(headers['User-Agent']);
        await page.setViewport({ width: 1920, height: 1080 });

        // Go to URL
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Debug Title
        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // Wait for list to load - Try multiple common selectors
        try {
            await page.waitForSelector('.resultbox, .store-details, .cntanr', { timeout: 10000 });
        } catch (e) {
            console.log("Timeout waiting for common selectors. Page might be blocked or empty.");
        }

        // Auto-scroll
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight || totalHeight > 3000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await delay(2000);

        // Extract Data
        const ambulances = await page.evaluate(() => {
            // JustDial has varying layouts. We try to find cards.
            // Option A: Classic .resultbox
            let items = Array.from(document.querySelectorAll('.resultbox'));

            // Option B: New Layout .cntanr .jsx-... (hard to predict classes, search for business names)
            if (items.length === 0) {
                items = Array.from(document.querySelectorAll('.store-details'));
            }
            if (items.length === 0) {
                // Fallback: Check for generic list items
                items = Array.from(document.querySelectorAll('li[data-href]'));
            }

            const data = [];

            items.forEach(item => {
                try {
                    // Try Data Attributes first (sometimes JD puts them there)
                    let name = item.getAttribute('data-name');
                    let phone = item.getAttribute('data-tel');

                    // Fallback to selectors
                    if (!name) name = item.querySelector('.resultbox_title_anchor, .store-name, .lng_cont_name')?.innerText;
                    if (!name) return; // Critical

                    let address = item.querySelector('.contact-info, .address-info, .cont_sw_addr')?.innerText || "Address not available";
                    // Clean address
                    address = address ? address.replace(/\n/g, ', ').trim() : "Address not available";

                    // Phone Logic (Icons or Text)
                    if (!phone) {
                        const callBtn = item.querySelector('.callcontent, .contact-info');
                        if (callBtn) phone = callBtn.innerText.replace(/[^\d+]/g, '');
                    }
                    if (!phone) phone = "Not Available";

                    data.push({
                        service_name: name.trim(),
                        driver_name: "Not Listed",
                        contact_number: phone,
                        address: address,
                        rating: item.querySelector('.resultbox_totalrate, .rating')?.innerText || "N/A"
                    });
                } catch (e) {
                    // Skip
                }
            });
            return data;
        });

        console.log(`✅ Extracted ${ambulances.length} ambulances from JustDial.`);

        // If 0, dump some body text for debug
        if (ambulances.length === 0) {
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log("Debug Body Start:", bodyText);
        }

        return { city, ambulances };

    } catch (error) {
        console.error("❌ Scraping failed:", error);
        return { city, ambulances: [] };
    } finally {
        await browser.close();
    }
};

module.exports = { scrapeJustDial };
