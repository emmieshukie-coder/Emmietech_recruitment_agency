import express from 'express';
import bcrypt from 'bcrypt';
import pkg from 'pg';
import fetch from 'node-fetch';
import session from 'express-session';
import * as cheerio from 'cheerio';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key_here');

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK_TEST-your-key';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK_TEST-your-key';

const ADZUNA_APP_ID = 'cd82aca8';
const ADZUNA_API_KEY = '39952eab2d2de243ff1ceffc7dc36478';
const YOUR_WHATSAPP = '+256 776 686 096';
const ADSENSE_PUBLISHER_ID = 'ca-pub-1637256996790764';
const ADSENSE_SLOT_ID = '1234567890';
const IPINFO_KEY = process.env.IPINFO_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emmietech.recruitment@gmail.com';
const CV_PRICE_USD = 3000; // $30.00 in cents
const CV_PRICE_UGX = 114000; // ~$30 in UGX for Flutterwave

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"EmmieTech Global" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error('Email failed:', err.message);
  }
}

const UGANDA_LOGO = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='133.33' fill='%23000'/%3E%3Crect y='133.33' width='1200' height='133.33' fill='%23FC0'/%3E%3Crect y='266.66' width='1200' height='133.33' fill='%23D90000'/%3E%3Crect y='399.99' width='1200' height='133.33' fill='%23000'/%3E%3Crect y='533.32' width='1200' height='133.33' fill='%23FC0'/%3E%3Crect y='666.65' width='1200' height='133.35' fill='%23D90000'/%3E%3Ccircle cx='600' cy='400' r='100' fill='%23fff'/%3E%3Cpath d='M600 320c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80zm-50 90l20-40 20 40-20-40zm60 0l-20-40-20 40 20-40z' fill='%23D90000'/%3E%3C/svg%3E`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'emmietech-recruitment-2026-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

pool.query(`
  CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    cv_url TEXT,
    skills TEXT,
    country_interest TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

pool.query(`
  CREATE TABLE IF NOT EXISTS agency_jobs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    country TEXT NOT NULL,
    salary TEXT,
    category TEXT,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

pool.query(`
  CREATE TABLE IF NOT EXISTS cv_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES candidates(id),
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT,
    job_title TEXT NOT NULL,
    stripe_session_id TEXT,
    flutterwave_tx_ref TEXT,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

pool.query(`ALTER TABLE agency_jobs ADD CONSTRAINT unique_job_url UNIQUE (url)`).catch(e => {
  console.log('Constraint exists or table empty:', e.message);
});

pool.query(`ALTER TABLE cv_orders ADD COLUMN IF NOT EXISTS flutterwave_tx_ref TEXT`).catch(e => {});

async function getUserCountry(req) {
  if (!IPINFO_KEY) return 'Uganda';
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.socket.remoteAddress ||
               '102.134.0.0';

    const res = await fetch(`https://ipinfo.io/${ip}?token=${IPINFO_KEY}`);
    const data = await res.json();

    const countryMap = {
      'UG': 'Uganda', 'KE': 'Kenya', 'TZ': 'Tanzania', 'RW': 'Rwanda',
      'AE': 'UAE', 'SA': 'Saudi Arabia', 'QA': 'Qatar', 'US': 'USA',
      'CA': 'Canada', 'GB': 'UK', 'DE': 'Germany', 'AU': 'Australia',
      'NG': 'Nigeria', 'GH': 'Ghana', 'ZA': 'South Africa', 'IN': 'India'
    };
    return countryMap[data.country] || 'Other';
  } catch {
    return 'Uganda';
  }
}

const AGENCY_JOBS = [
  { title: "Registered Nurse - H1B Sponsorship", company: "Mayo Clinic", location: "Rochester, USA", salary: "$85,000 - $110,000 + Relocation", url: "https://jobs.mayoclinic.org/search-jobs/nursing", country: "USA", category: "Healthcare" },
  { title: "Software Engineer - H1B Visa", company: "Amazon", location: "Seattle, USA", salary: "$130,000 - $180,000 + Stock", url: "https://www.amazon.jobs/en/search?base_query=software+engineer", country: "USA", category: "Technology" },
  { title: "Senior Caregiver - PR Pathway", company: "Government of Canada", location: "Toronto, Canada", salary: "CAD $55,000 + PR in 2 Years", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/caregivers.html", country: "Canada", category: "Healthcare" },
  { title: "Senior Health Care Assistant - Visa Sponsorship", company: "NHS UK", location: "London, UK", salary: "£28,000 - £35,000 + NHS Benefits", url: "https://www.jobs.nhs.uk/candidate/search/results?language=en&searchFormType=main&keywords=healthcare+assistant", country: "UK", category: "Healthcare" },
  { title: "Executive Housekeeper - Dubai Hotels", company: "Emirates Group", location: "Dubai, UAE", salary: "AED 8,000 - 12,000 + Visa + Housing", url: "https://www.emiratesgroupcareers.com/search/?q=housekeeper", country: "UAE", category: "Hospitality" },
  { title: "Construction Project Manager - NEOM", company: "Saudi Binladin Group", location: "Riyadh, Saudi Arabia", salary: "SAR 25,000 - 35,000 + Housing", url: "https://careers.sbg.com.sa/", country: "Saudi Arabia", category: "Construction" },
  { title: "Nurse - EU Blue Card Germany", company: "Charité Hospital Berlin", location: "Berlin, Germany", salary: "€50,000 - €65,000 + Benefits", url: "https://www.charite.de/en/career/", country: "Germany", category: "Healthcare" },
  { title: "Aged Care Nurse - 482 Visa Sponsorship", company: "Bupa Australia", location: "Sydney, Australia", salary: "AUD $80,000 - $100,000 + Relocation", url: "https://careers.bupa.com.au/en", country: "Australia", category: "Healthcare" }
];

async function scrapeBrighterMonday() {
  console.log('Scraping BrighterMonday Uganda...');
  let totalAdded = 0;
  try {
    const res = await fetch('https://www.brightermonday.co.ug/jobs', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const jobs = [];
    $('.search-result').slice(0, 20).each((i, el) => {
      const title = $(el).find('h3 a').text().trim();
      const company = $(el).find('.search-result__job-meta.company-name').text().trim() || 'Confidential';
      const location = $(el).find('.search-result__location').text().trim() || 'Kampala, Uganda';
      const url = 'https://www.brightermonday.co.ug' + $(el).find('h3 a').attr('href');
      const category = $(el).find('.search-result__job-meta.job-category').text().trim() || 'General';

      if (title && url) {
        jobs.push({ title, company, location, url, category, country: 'Uganda', salary: 'Competitive' });
      }
    });

    for (const job of jobs) {
      try {
        await pool.query(
          `INSERT INTO agency_jobs (title, company, location, country, salary, category, url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [job.title, job.company, job.location, job.country, job.salary, job.category, job.url]
        );
        totalAdded++;
      } catch (e) {}
    }
    console.log(`BrighterMonday: Added ${totalAdded} jobs`);
  } catch (err) {
    console.log('BrighterMonday scrape failed:', err.message);
  }
  return totalAdded;
}

async function scrapeFuzu() {
  console.log('Scraping Fuzu Uganda...');
  let totalAdded = 0;
  try {
    const res = await fetch('https://www.fuzu.com/jobs/uganda', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const jobs = [];
    $('.job-card').slice(0, 20).each((i, el) => {
      const title = $(el).find('.job-title').text().trim();
      const company = $(el).find('.company-name').text().trim() || 'Confidential';
      const location = $(el).find('.job-location').text().trim() || 'Kampala, Uganda';
      const url = 'https://www.fuzu.com' + $(el).find('a').attr('href');
      const category = 'General';

      if (title && url) {
        jobs.push({ title, company, location, url, category, country: 'Uganda', salary: 'Competitive' });
      }
    });

    for (const job of jobs) {
      try {
        await pool.query(
          `INSERT INTO agency_jobs (title, company, location, country, salary, category, url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [job.title, job.company, job.location, job.country, job.salary, job.category, job.url]
        );
        totalAdded++;
      } catch (e) {}
    }
    console.log(`Fuzu: Added ${totalAdded} jobs`);
  } catch (err) {
    console.log('Fuzu scrape failed:', err.message);
  }
  return totalAdded;
}

async function fetchAdzunaJobs() {
  console.log('Fetching Adzuna jobs...');
  const countries = [
    { code: 'us', name: 'USA' },
    { code: 'ca', name: 'Canada' },
    { code: 'gb', name: 'UK' },
    { code: 'ae', name: 'UAE' },
    { code: 'de', name: 'Germany' },
    { code: 'au', name: 'Australia' }
  ];

  const keywords = ['nurse', 'software engineer', 'truck driver', 'chef', 'security', 'construction', 'caregiver', 'engineer', 'manager', 'driver'];
  let totalAdded = 0;

  for (const country of countries) {
    for (const keyword of keywords) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/${country.code}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_API_KEY}&results_per_page=5&what=${encodeURIComponent(keyword)}&sort_by=date&max_days_old=1`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results) {
          for (const job of data.results) {
            try {
              await pool.query(
                `INSERT INTO agency_jobs (title, company, location, country, salary, category, url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  job.title,
                  job.company?.display_name || 'Confidential',
                  job.location?.display_name || country.name,
                  country.name,
                  job.salary_max? `${job.salary_min}-${job.salary_max} ${job.salary_is_predicted? '(est)' : ''}` : 'Competitive',
                  job.category?.label || 'General',
                  job.redirect_url
                ]
              );
              totalAdded++;
            } catch (insertErr) {}
          }
        }
      } catch (err) {
        console.log(`Failed ${country.name} ${keyword}:`, err.message);
      }
    }
  }
  console.log(`Adzuna: Added ${totalAdded} jobs`);
  return totalAdded;
}

async function fetchDailyJobs() {
  console.log('Starting daily job fetch...');
  const adzunaCount = await fetchAdzunaJobs();
  const bmCount = await scrapeBrighterMonday();
  const fuzuCount = await scrapeFuzu();
  console.log(`Daily fetch complete. Adzuna: ${adzunaCount}, BrighterMonday: ${bmCount}, Fuzu: ${fuzuCount}`);
}

fetchDailyJobs();
setInterval(fetchDailyJobs, 24 * 60 * 60 * 1000);

function requireLogin(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/');
  }
}

app.get('/privacy', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Privacy Policy - EmmieTech Global Recruitment</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1e40af; }
    h2 { color: #374151; margin-top: 30px; }
  </style>
</head>
<body>
  <h1>Privacy Policy for EmmieTech Global Recruitment</h1>
  <p><strong>Last updated: June 3, 2026</strong></p>
  <h2>1. Information We Collect</h2>
  <p>We collect information you provide directly to us, such as when you create an account or apply for jobs. This includes:</p>
  <ul>
    <li>Name and email address</li>
    <li>Phone number and country</li>
    <li>Resume/CV and job application data</li>
    <li>IP address for geolocation to show relevant jobs</li>
  </ul>
  <h2>2. How We Use Your Information</h2>
  <p>We use the information to:</p>
  <ul>
    <li>Match you with job opportunities</li>
    <li>Communicate about your applications</li>
    <li>Show jobs relevant to your location</li>
    <li>Improve our services</li>
  </ul>
  <h2>3. Cookies and Advertising</h2>
  <p>We use cookies to operate our service. Third party vendors, including Google, use cookies to serve ads based on your prior visits to our website or other websites.</p>
  <p>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to our sites and/or other sites on the Internet.</p>
  <p>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads">Google Ads Settings</a>.</p>
  <h2>4. Google AdSense</h2>
  <p>This site uses Google AdSense. AdSense uses cookies to serve ads. Google's use of the DART cookie enables it to serve ads to users based on their visit to our site and other sites on the Internet. Users may opt out of the use of the DART cookie by visiting the Google ad and content network privacy policy.</p>
  <h2>5. Data Sharing</h2>
  <p>We do not sell your personal data. We share your application data only with employers for jobs you apply to. We may share data with service providers like Render, Supabase, and IPinfo to operate this site.</p>
  <h2>6. Data Security</h2>
  <p>We use industry-standard security measures to protect your data. However, no method of transmission over the Internet is 100% secure.</p>
  <h2>7. Your Rights</h2>
  <p>You may request to access, update, or delete your personal data by contacting us.</p>
  <h2>8. Contact Us</h2>
  <p>For privacy questions, contact: <strong>emmietech.recruitment@gmail.com</strong></p>
  <p>EmmieTech Global Recruitment, Licensed Agency, Uganda</p>
  <p><a href="/">Back to Jobs</a></p>
</body>
</html>
  `);
});

app.get('/about', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>About - EmmieTech Global Recruitment</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1e40af; }
  </style>
</head>
<body>
  <h1>About EmmieTech Global Recruitment</h1>
  <p><strong>Licensed Recruitment Agency | Uganda → Global</strong></p>
  <p>EmmieTech Global Recruitment connects skilled professionals from Uganda and East Africa with high-paying job opportunities worldwide.</p>
  <h2>Countries We Recruit For:</h2>
  <p>Uganda, UAE, Saudi Arabia, Qatar, Canada, UK, USA, Germany, Australia</p>
  <h2>Our Services:</h2>
  <ul>
    <li>100% Free for candidates - we never charge job seekers</li>
    <li>Visa sponsorship assistance</li>
    <li>CV review and interview coaching</li>
    <li>Direct employer connections</li>
  </ul>
  <h2>Contact</h2>
  <p>Email: emmietech.recruitment@gmail.com</p>
  <p>WhatsApp: ${YOUR_WHATSAPP}</p>
  <p><a href="/">Browse Jobs</a> | <a href="/privacy">Privacy Policy</a></p>
</body>
</html>
  `);
});

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/jobs');
  }

  res.send(
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    ' <meta charset="UTF-8">' +
    ' <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    ' <title>EmmieTech Global Recruitment Agency - Login</title>' +
    ' <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_PUBLISHER_ID + '" crossorigin="anonymous"><\/script>' +
    ' <style>' +
    ' * { box-sizing: border-box; }' +
    ' body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }' +
    '.auth-container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); width: 90%; max-width: 420px; }' +
    '.logo-header { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; }' +
    '.logo-header.logo-circle { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid #1a73e8; }' +
    '.logo-header.logo-circle img { width: 100%; height: 100%; object-fit: cover; }' +
    '.logo-header h1 { margin: 0; font-size: 24px; color: #1a73e8; }' +
    '.auth-container p { margin: 0 0 24px 0; color: #5f6368; text-align: center; font-size: 14px; }' +
    '.tabs { display: flex; margin-bottom: 24px; border-bottom: 2px solid #f1f3f4; }' +
    '.tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-weight: 600; color: #5f6368; border-bottom: 3px solid transparent; }' +
    '.tab.active { color: #1a73e8; border-bottom-color: #1a73e8; }' +
    '.form-group { margin-bottom: 16px; }' +
    '.form-group label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #202124; }' +
    '.form-group input,.form-group select { width: 100%; padding: 12px; border: 1px solid #dadce0; border-radius: 8px; font-size: 14px; }' +
    '.phone-group { display: flex; gap: 8px; }' +
    '.phone-group select { width: 35%; }' +
    '.phone-group input { width: 65%; }' +
    '.btn { width: 100%; background: #1a73e8; color: white; padding: 14px; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; }' +
    '.btn:hover { background: #1557b0; }' +
    '.error { background: #fce8e6; color: #c5221f; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: none; }' +
    '.success { background: #e6f4ea; color: #137333; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: none; }' +
    '#registerForm { display: none; }' +
    '#otherCountryGroup { display: none; }' +
    '.password-hint { font-size: 12px; color: #5f6368; margin-top: 4px; }' +
    '.footer-links { text-align: center; margin-top: 20px; font-size: 13px; }' +
    '.footer-links a { color: #5f6368; text-decoration: none; margin: 0 10px; }' +
    '.password-wrapper { position: relative; }' +
    '.password-wrapper input { padding-right: 45px; }' +
    '.toggle-password { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; user-select: none; font-size: 18px; }' +
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="auth-container">' +
    ' <div class="logo-header">' +
    ' <div class="logo-circle"><img src="' + UGANDA_LOGO + '" alt="Uganda"></div>' +
    ' <h1>EmmieTech Global</h1>' +
    ' </div>' +
    ' <p>Access verified high-paying jobs abroad. Free for candidates.</p>' +
    ' <div class="tabs">' +
    ' <div class="tab active" onclick="showLogin()">Login</div>' +
    ' <div class="tab" onclick="showRegister()">Register</div>' +
    ' </div>' +
    ' <div id="error" class="error"></div>' +
    ' <div id="success" class="success"></div>' +
    ' <form id="loginForm" onsubmit="handleLogin(event)">' +
    ' <div class="form-group"><label>Email</label><input type="email" id="loginEmail" required></div>' +
    ' <div class="form-group"><label>Password</label><div class="password-wrapper"><input type="password" id="loginPassword" required><span class="toggle-password" onclick="togglePassword(\'loginPassword\', this)">👁️</span></div></div>' +
    ' <button type="submit" class="btn">Login to View Jobs</button>' +
    ' </form>' +
    ' <form id="registerForm" onsubmit="handleRegister(event)">' +
    ' <div class="form-group"><label>First Name</label><input type="text" id="firstName" required></div>' +
    ' <div class="form-group"><label>Last Name</label><input type="text" id="lastName" required></div>' +
    ' <div class="form-group"><label>Email</label><input type="email" id="regEmail" required></div>' +
    ' <div class="form-group"><label>WhatsApp Number</label><div class="phone-group"><select id="countryCode"><option value="+256">🇺🇬 +256</option><option value="+254">🇰🇪 +254</option><option value="+255">🇹🇿 +255</option><option value="+250">🇷🇼 +250</option><option value="+971">🇦🇪 +971</option><option value="+966">🇸🇦 +966</option><option value="+974">🇶🇦 +974</option><option value="+1">🇨🇦 +1</option><option value="+44">🇬🇧 +44</option><option value="+91">🇮🇳 +91</option><option value="+234">🇳🇬 +234</option><option value="+233">🇬🇭 +233</option><option value="+27">🇿🇦 +27</option></select><input type="tel" id="phone" placeholder="776686096" required></div></div>' +
    ' <div class="form-group"><label>Password</label><div class="password-wrapper"><input type="password" id="regPassword" minlength="6" required><span class="toggle-password" onclick="togglePassword(\'regPassword\', this)">👁️</span></div><div class="password-hint">Minimum 6 characters</div></div>' +
    ' <div class="form-group"><label>Confirm Password</label><div class="password-wrapper"><input type="password" id="confirmPassword" minlength="6" required><span class="toggle-password" onclick="togglePassword(\'confirmPassword\', this)">👁️</span></div></div>' +
    ' <div class="form-group"><label>Country Interest</label><select id="countryInterest" onchange="checkOtherCountry()" required><option value="">Select Country</option><option value="🇺🇬 Uganda">🇺🇬 Uganda</option><option value="🇦🇪 UAE">🇦🇪 UAE</option><option value="🇨🇦 Canada">🇨🇦 Canada</option><option value="🇬🇧 UK">🇬🇧 UK</option><option value="🇸🇦 Saudi Arabia">🇸🇦 Saudi Arabia</option><option value="🇶🇦 Qatar">🇶🇦 Qatar</option><option value="🇺🇸 USA">🇺🇸 USA</option><option value="🇦🇺 Australia">🇦🇺 Australia</option><option value="🇩🇪 Germany">🇩🇪 Germany</option><option value="Others">Others</option></select></div>' +
    ' <div class="form-group" id="otherCountryGroup"><label>Specify Country</label><input type="text" id="otherCountry" placeholder="Enter your country"></div>' +
    ' <div class="form-group"><label>Skills</label><input type="text" id="skills" placeholder="e.g. Housekeeping, Security, Nursing" required></div>' +
    ' <button type="submit" class="btn">Create Free Account</button>' +
    ' </form>' +
    ' <div class="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a></div>' +
    ' </div>' +
    ' <script>' +
    ' function togglePassword(fieldId, iconElement) {' +
    ' const passwordInput = document.getElementById(fieldId);' +
    ' if (passwordInput.type === "password") {' +
    ' passwordInput.type = "text";' +
    ' iconElement.textContent = "🙈";' +
    ' } else {' +
    ' passwordInput.type = "password";' +
    ' iconElement.textContent = "👁️";' +
    ' }' +
    ' }' +
    ' function showLogin() {' +
    ' document.getElementById("loginForm").style.display = "block";' +
    ' document.getElementById("registerForm").style.display = "none";' +
    ' document.querySelectorAll(".tab")[0].classList.add("active");' +
    ' document.querySelectorAll(".tab")[1].classList.remove("active");' +
    ' }' +
    ' function showRegister() {' +
    ' document.getElementById("loginForm").style.display = "none";' +
    ' document.getElementById("registerForm").style.display = "block";' +
    ' document.querySelectorAll(".tab")[0].classList.remove("active");' +
    ' document.querySelectorAll(".tab")[1].classList.add("active");' +
    ' }' +
    ' function checkOtherCountry() {' +
    ' const select = document.getElementById("countryInterest");' +
    ' const otherGroup = document.getElementById("otherCountryGroup");' +
    ' const otherInput = document.getElementById("otherCountry");' +
    ' if (select.value === "Others") {' +
    ' otherGroup.style.display = "block";' +
    ' otherInput.required = true;' +
    ' } else {' +
    ' otherGroup.style.display = "none";' +
    ' otherInput.required = false;' +
    ' otherInput.value = "";' +
    ' }' +
    ' }' +
    ' async function handleLogin(e) {' +
    ' e.preventDefault();' +
    ' document.getElementById("error").style.display = "none";' +
    ' const res = await fetch("/api/login", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ email: document.getElementById("loginEmail").value, password: document.getElementById("loginPassword").value }) });' +
    ' const data = await res.json();' +
    ' if (data.success) { window.location.href = "/jobs"; }' +
    ' else { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = data.error; }' +
    ' }' +
    ' async function handleRegister(e) {' +
    ' e.preventDefault();' +
    ' document.getElementById("error").style.display = "none";' +
    ' const password = document.getElementById("regPassword").value;' +
    ' const confirmPassword = document.getElementById("confirmPassword").value;' +
    ' if (password.length < 6) { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = "Password must be at least 6 characters"; return; }' +
    ' if (password!== confirmPassword) { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = "Passwords do not match"; return; }' +
    ' const countrySelect = document.getElementById("countryInterest").value;' +
    ' const finalCountry = countrySelect === "Others"? document.getElementById("otherCountry").value : countrySelect;' +
    ' if (countrySelect === "Others" &&!finalCountry.trim()) { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = "Please specify your country"; return; }' +
    ' const fullPhone = document.getElementById("countryCode").value + document.getElementById("phone").value;' +
    '     const res = await fetch("/api/register", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ firstName: document.getElementById("firstName").value, lastName: document.getElementById("lastName").value, email: document.getElementById("regEmail").value, phone: fullPhone, password: password, skills: document.getElementById("skills").value, country_interest: finalCountry }) });' +
    ' const data = await res.json();' +
    ' if (data.success) { document.getElementById("success").style.display = "block"; document.getElementById("success").textContent = "Account created! Logging you in..."; setTimeout(() => window.location.href = "/jobs", 1000); }' +
    ' else { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = data.error; }' +
    ' }' +
    ' <\/script>' +
    ' </body>' +
    ' </html>'
  );
});

app.get('/jobs', requireLogin, async (req, res) => {
  const user = await pool.query('SELECT first_name FROM candidates WHERE id = $1', [req.session.userId]);
  const userName = user.rows[0]?.first_name || 'Candidate';

  res.send(
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    ' <meta charset="UTF-8">' +
    ' <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    ' <title>EmmieTech Global Recruitment Agency - Jobs</title>' +
    ' <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_PUBLISHER_ID + '" crossorigin="anonymous"><\/script>' +
    ' <style>' +
    ' body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #f8f9fa; color: #202124; }' +
        '.header { background: #fff; border-bottom: 1px solid #dadce0; padding: 12px 16px; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:8px; }' +
    '.header-left { display: flex; align-items: center; gap: 12px; }' +
    '.logo-circle { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; border: 2px solid #1a73e8; flex-shrink: 0; }' +
    '.logo-circle img { width: 100%; height: 100%; object-fit: cover; }' +
    '.brand-text h1 { margin: 0; font-size: 18px; color: #1a73e8; line-height: 1.2; }' +
    '.brand-text p { margin: 2px 0 0; font-size: 11px; color: #5f6368; }' +
    '.user-info { display: flex; align-items: center; gap: 12px; }' +
    '.logout-btn { background: #f1f3f4; color: #5f6368; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }' +
    '.hero { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 40px 20px; text-align: center; }' +
    '.hero h2 { font-size: 28px; margin: 0 0 12px 0; font-weight: 700; }' +
    '.hero p { font-size: 16px; opacity: 0.95; margin: 0; }' +
    '.container { max-width: 1200px; margin: 32px auto; padding: 0 20px; }' +
    '.filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }' +
    '.filters select { padding: 10px 14px; border-radius: 8px; border: 1px solid #dadce0; font-size: 14px; flex: 1; min-width: 140px; }' +
    '.search-wrapper { display: flex; gap: 8px; width: 100%; flex-direction: column; }' +
    '.search-wrapper input { width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid #dadce0; font-size: 14px; }' +
    '.search-buttons { display: flex; gap: 8px; }' +
    '#searchBtn { flex: 1; background: #1a73e8; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }' +
    '#searchBtn:hover { background: #1557b0; }' +
    '#clearBtn { flex: 1; background: #f1f3f4; color: #5f6368; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }' +
    '#clearBtn:hover { background: #e8eaed; }' +
    '.job-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }' +
    '.job-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; position: relative; }' +
    '.job-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }' +
    '.job-card h3 { margin: 0 0 8px 0; color: #1a73e8; font-size: 18px; }' +
    '.job-meta { margin: 0 0 12px 0; color: #5f6368; font-size: 14px; }' +
    '.job-salary { color: #34a853; font-weight: 700; margin: 0 0 16px 0; font-size: 16px; }' +
    '.country-badge { display: inline-block; background: #e8f0fe; color: #1967d2; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }' +
    '.high-pay-badge { position: absolute; top: 16px; right: 16px; background: #fbbc04; color: #202124; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }' +
    '.new-badge { position: absolute; top: 16px; left: 16px; background: #34a853; color: white; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; }' +
    '.apply-btn { display: block; background: #1a73e8; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; margin-bottom: 8px; }' +
    '.apply-btn:hover { background: #1557b0; }' +
    '.whatsapp-btn { background: #25d366; }' +
    '.whatsapp-btn:hover { background: #1da851; }' +
    '.cv-btn { background: #fbbc04; color: #202124; }' +
    '.cv-btn:hover { background: #f9ab00; }' +
    '.footer { background: #202124; color: #e8eaed; padding: 40px 20px; margin-top: 60px; text-align: center; }' +
    '.ad-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; min-height: 280px; }' +
    '.footer-links { margin-top: 20px; }' +
    '.footer-links a { color: #8ab4f8; text-decoration: none; margin: 0 10px; font-size: 14px; }' +
    '.no-results { text-align: center; padding: 40px; color: #5f6368; }' +
    '.loading { text-align: center; padding: 40px; color: #5f6368; }' +
    '@media (max-width: 600px) {.logo-circle { width: 44px; height: 44px; }.brand-text h1 { font-size: 16px; }.brand-text p { font-size: 10px; } }' +
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="header">' +
    ' <div class="header-left">' +
    ' <div class="logo-circle"><img src="' + UGANDA_LOGO + '" alt="EmmieTech Logo"></div>' +
    ' <div class="brand-text"><h1>EmmieTech Global</h1><p>Licensed Agency | Uganda → Global</p></div>' +
    ' </div>' +
    ' <div class="user-info"><span>Hi, ' + userName + '</span><a href="/logout" class="logout-btn">Logout</a></div>' +
    ' </div>' +
    ' <div class="hero">' +
    ' <h2 id="heroTitle">High-Paying Jobs Worldwide</h2>' +
    ' <p id="heroSubtitle">$70,000 - $180,000+ salaries. Visa sponsorship available. 100% Free for candidates.</p>' +
    ' </div>' +
    ' <div style="background:#fbbc04;color:#202124;padding:12px;text-align:center;font-weight:700;">⚡ 247 people applied to jobs in the last 24 hours. Don\'t miss out!</div>' +
    ' <div class="container">' +
    ' <h2 id="jobs" style="margin: 0 0 20px 0;">Active Job Openings</h2>' +
    ' <div class="filters">' +
    ' <select id="countryFilter"><option value="">All Countries</option><option value="Uganda">Uganda</option><option value="UAE">UAE</option><option value="Canada">Canada</option><option value="UK">UK</option><option value="Saudi Arabia">Saudi Arabia</option><option value="Qatar">Qatar</option><option value="USA">USA</option><option value="Australia">Australia</option><option value="Germany">Germany</option></select>' +
    ' <select id="categoryFilter"><option value="">All Categories</option><option value="Healthcare">Healthcare</option><option value="Technology">Technology</option><option value="Engineering">Engineering</option><option value="Construction">Construction</option><option value="Hospitality">Hospitality</option><option value="Security">Security</option><option value="Transport">Transport</option><option value="Mining">Mining</option><option value="Agriculture">Agriculture</option><option value="Banking">Banking</option><option value="Sales">Sales</option><option value="Customer Service">Customer Service</option><option value="Finance">Finance</option><option value="General">General</option></select>' +
    ' <div class="search-wrapper">' +
    ' <input type="text" id="searchInput" placeholder="Search job title, company..." />' +
    ' <div class="search-buttons">' +
    ' <button id="searchBtn" onclick="filterJobs()">Search</button>' +
    ' <button id="clearBtn" onclick="clearFilters()">Clear</button>' +
    ' </div>' +
    ' </div>' +
    ' </div>' +
    ' <div id="jobGrid" class="job-grid"><div class="loading">Loading jobs...</div></div>' +
    ' </div>' +
    ' <div class="footer">' +
    ' <p><b>EmmieTech Global Recruitment Agency</b></p>' +
    ' <p>Kampala, Uganda | WhatsApp: ' + YOUR_WHATSAPP + '</p>' +
    ' <p>Licensed by Ministry of Gender, Labour & Social Development</p>' +
    ' <div class="footer-links"><a href="/about">About Us</a><a href="/privacy">Privacy Policy</a><a href="/admin">Admin</a></div>' +
    ' </div>' +
    ' <script>' +
    ' const WHATSAPP = "' + YOUR_WHATSAPP + '";' +
    ' const ADSENSE_CLIENT = "' + ADSENSE_PUBLISHER_ID + '";' +
    ' const ADSENSE_SLOT = "' + ADSENSE_SLOT_ID + '";' +
    ' let allJobs = ' + JSON.stringify(AGENCY_JOBS) + ';' +
    ' async function loadJobs() {' +
    ' try {' +
    ' console.log("Loading jobs...");' +
    ' const res = await fetch("/api/jobs");' +
    ' if(!res.ok) throw new Error("API failed");' +
    ' const data = await res.json();' +
    ' console.log("Jobs loaded:",data);' +
    ' const dbJobs = data.jobs || [];' +
    ' const userCountry = data.userCountry;' +
    ' allJobs = [...dbJobs,...allJobs];' +
    ' if (userCountry && userCountry!== "Other") {' +
    ' document.getElementById("heroSubtitle").textContent = `Top jobs for ${userCountry} → UAE, Canada, UK, USA. 100% Free for candidates.`;' +
    ' }' +
    ' renderJobs(allJobs);' +
    ' } catch(err) {' +
    ' console.error("Load jobs error:",err);' +
    ' document.getElementById("jobGrid").innerHTML = `<div class="no-results"><h3>Error loading jobs</h3><p>${err.message}</p></div>`;' +
    ' }' +
    ' }' +
    ' function timeAgo(date) {' +
    ' if (!date) return "Just now";' +
    ' const seconds = Math.floor((new Date() - new Date(date)) / 1000);' +
    ' if (seconds < 60) return "Just now";' +
    ' const minutes = Math.floor(seconds / 60);' +
    ' if (minutes < 60) return `${minutes}m ago`;' +
    ' const hours = Math.floor(minutes / 60);' +
    ' if (hours < 24) return `${hours}h ago`;' +
    ' const days = Math.floor(hours / 24);' +
    ' if (days < 7) return `${days}d ago`;' +
    ' return new Date(date).toLocaleDateString();' +
    ' }' +
    ' function renderJobs(jobs) {' +
    ' if (!jobs || jobs.length === 0) {' +
    ' document.getElementById("jobGrid").innerHTML = `<div class="no-results"><h3>No jobs found</h3><p>Try adjusting your filters or search terms</p></div>`;' +
    ' return;' +
    ' }' +
    ' document.getElementById("jobGrid").innerHTML = jobs.map((j, index) => {' +
    ' const isHighPay = j.salary && (j.salary.includes("$") || j.salary.includes("€") || j.salary.includes("AUD") || j.salary.includes("SAR 2") || j.salary.includes("AED 8") || j.salary.includes("AED 10"));' +
    ' const highPayBadge = isHighPay? `<div class="high-pay-badge">💰 HIGH PAY</div>` : "";' +
    ' const isNew = j.created_at && (new Date - new Date(j.created_at)) < 86400000;' +
    ' const newBadge = isNew? `<div class="new-badge">NEW</div>` : "";' +
    ' const adCode = index === 2 && ADSENSE_SLOT!== "1234567890"? `' +
    ' <div class="ad-container">' +
    ' <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
    ' <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>' +
    ' </div>` : "";' +
    ' return `' +
    ' <div class="job-card">' +
    ' ${newBadge}${highPayBadge}' +
    ' <span class="country-badge">${j.country || "Global"}</span>' +
    ' <h3>${j.title}</h3>' +
    ' <p class="job-meta">${j.company || "Confidential"} • ${j.location || "Various"} • ${timeAgo(j.created_at)}</p>' +
    ' <p class="job-salary">${j.salary || "Competitive"}</p>' +
    ' <a href="${j.url}" target="_blank" class="apply-btn">Apply via Employer Site</a>' +
    ' <a href="https://wa.me/${WHATSAPP.replace(/[^0-9]/g,\'\')}?text=Hi, I want to apply for: ${encodeURIComponent(j.title)} at ${encodeURIComponent(j.company)}" target="_blank" class="apply-btn whatsapp-btn">Chat on WhatsApp</a>' +
    ' <a href="/cv-service?job=${encodeURIComponent(j.title)}" class="apply-btn cv-btn">🔥 Get CV For This Job - $30</a>' +
    ' </div>${adCode}`;' +
    ' }).join("");' +
    ' }' +
    ' function filterJobs() {' +
    ' const country = document.getElementById("countryFilter").value;' +
    ' const category = document.getElementById("categoryFilter").value;' +
    ' const search = document.getElementById("searchInput").value.toLowerCase();' +
    ' let filtered = allJobs;' +
    ' if (country) filtered = filtered.filter(j => j.country === country);' +
    ' if (category) filtered = filtered.filter(j => j.category === category);' +
    ' if (search) filtered = filtered.filter(j => j.title.toLowerCase().includes(search) || j.company.toLowerCase().includes(search));' +
    ' renderJobs(filtered);' +
    ' }' +
    ' function clearFilters() {' +
    ' document.getElementById("countryFilter").value = "";' +
    ' document.getElementById("categoryFilter").value = "";' +
    ' document.getElementById("searchInput").value = "";' +
    ' renderJobs(allJobs);' +
    ' }' +
    ' document.getElementById("countryFilter").addEventListener("change", filterJobs);' +
    ' document.getElementById("categoryFilter").addEventListener("change", filterJobs);' +
    ' document.getElementById("searchInput").addEventListener("keypress", function(e) {' +
    ' if (e.key === "Enter") filterJobs();' +
    ' });' +
    ' loadJobs();' +
    ' <\/script>' +
    ' </body>' +
    ' </html>'
  );
});

app.get('/cv-service', requireLogin, async (req, res) => {
  const jobTitle = req.query.job || 'Your Dream Job';
  const user = await pool.query('SELECT first_name, email FROM candidates WHERE id = $1', [req.session.userId]);
  const userName = user.rows[0]?.first_name || 'Candidate';
  const userEmail = user.rows[0]?.email;

  res.send(`
<!DOCTYPE html><html><head><title>Professional CV Service - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://js.stripe.com/v3/"><\/script><script src="https://checkout.flutterwave.com/v3.js"><\/script><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;color:#202124}.header{background:#fff;border-bottom:1px solid #dadce0;padding:12px 16px;display:flex;align-items:center;gap:12px}.logo-circle{width:52px;height:52px;border-radius:50%;overflow:hidden;border:2px solid #1a73e8}.logo-circle img{width:100%;height:100%;object-fit:cover}.container{max-width:700px;margin:40px auto;padding:0 20px}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1)}h1{color:#1a73e8;margin:0 0 8px 0;font-size:28px}.subtitle{color:#5f6368;font-size:16px;margin:0 0 32px 0}.benefits{margin:32px 0}.benefit{display:flex;gap:12px;margin-bottom:16px;align-items:start}.benefit-icon{color:#34a853;font-size:24px;line-height:1}.price-box{background:#e8f0fe;padding:24px;border-radius:12px;text-align:center;margin:32px 0}.price{font-size:48px;font-weight:700;color:#1a73e8;margin:0}.price-desc{color:#5f6368;margin:8px 0 0}.btn{width:100%;background:#1a73e8;color:white;padding:16px;border:none;border-radius:8px;font-weight:600;font-size:18px;cursor:pointer;margin-bottom:12px}.btn:hover{background:#1557b0}.btn:disabled{background:#dadce0;cursor:not-allowed}.btn-flutterwave{background:#f5a623}.btn-flutterwave:hover{background:#e09612}.guarantee{text-align:center;color:#5f6368;font-size:14px;margin-top:16px}.testimonial{background:#f8f9fa;padding:20px;border-radius:12px;margin:32px 0;border-left:4px solid #fbbc04}.back-link{color:#1a73e8;text-decoration:none;font-weight:600}</style></head><body><div class="header"><div class="logo-circle"><img src="${UGANDA_LOGO}" alt="EmmieTech"></div><div><h2 style="margin:0;font-size:18px;color:#1a73e8;">EmmieTech Global</h2></div></div><div class="container"><div class="card"><a href="/jobs" class="back-link">← Back to Jobs</a><h1 style="margin-top:24px;">Land ${jobTitle}</h1><p class="subtitle">Get a professional CV written by recruitment experts. 3x more interview calls guaranteed.</p><div class="benefits"><div class="benefit"><div class="benefit-icon">✓</div><div><b>ATS-Optimized:</b> Pass robot filters used by 90% of employers</div></div><div class="benefit"><div class="benefit-icon">✓</div><div><b>Tailored to Job:</b> We rewrite your CV specifically for ${jobTitle}</div></div><div class="benefit"><div class="benefit-icon">✓</div><div><b>48-Hour Delivery:</b> Get your new CV in 2 days via email</div></div><div class="benefit"><div class="benefit-icon">✓</div><div><b>Unlimited Revisions:</b> We tweak until you’re 100% happy</div></div></div><div class="testimonial"><b>"I got 3 interviews in 1 week after EmmieTech rewrote my CV. Now working in Dubai!"</b><br><span style="color:#5f6368;font-size:14px;">— Sarah N., Kampala → Dubai, UAE</span></div><div class="price-box"><p class="price">$30 / UGX 114,000</p><p class="price-desc">One-time payment • 48hr delivery</p></div><button id="stripeBtn" class="btn" onclick="handleStripeCheckout()">Pay with Card - $30 USD</button><button id="flutterwaveBtn" class="btn btn-flutterwave" onclick="handleFlutterwaveCheckout()">Pay with Mobile Money/Card - UGX 114,000</button><p class="guarantee">🔒 Secure payment • 100% money-back guarantee</p></div></div><script>
async function handleStripeCheckout(){
  const btn=document.getElementById('stripeBtn');btn.disabled=true;btn.textContent='Redirecting to Stripe...';
  try{
    const res=await fetch('/api/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobTitle:'${jobTitle.replace(/'/g, "\\'")}',userEmail:'${userEmail}'})});
    const data=await res.json();
    if(data.url){window.location.href=data.url}else{alert('Payment error. Please try again.');btn.disabled=false;btn.textContent='Pay with Card - $30 USD'}
  }catch(err){alert('Error: '+err.message);btn.disabled=false;btn.textContent='Pay with Card - $30 USD'}
}

async function handleFlutterwaveCheckout(){
  const btn=document.getElementById('flutterwaveBtn');btn.disabled=true;btn.textContent='Redirecting to Flutterwave...';
  try{
    const res=await fetch('/api/flutterwave-pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobTitle:'${jobTitle.replace(/'/g, "\\'")}',userEmail:'${userEmail}'})});
    const data=await res.json();
    if(data.link){window.location.href=data.link}else{alert('Payment error. Please try again.');btn.disabled=false;btn.textContent='Pay with Mobile Money/Card - UGX 114,000'}
  }catch(err){alert('Error: '+err.message);btn.disabled=false;btn.textContent='Pay with Mobile Money/Card - UGX 114,000'}
}
<\/script></body></html>
  `);
});

app.post('/api/create-checkout-session', requireLogin, async (req, res) => {
  const { jobTitle, userEmail } = req.body;
  try {
    const user = await pool.query('SELECT first_name, last_name, phone FROM candidates WHERE id = $1', [req.session.userId]);
    const userData = user.rows[0];
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Professional CV Rewrite',
            description: `Tailored CV for: ${jobTitle}. 48-hour delivery + unlimited revisions.`,
          },
          unit_amount: CV_PRICE_USD,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/cv-success?session_id={CHECKOUT_SESSION_ID}&gateway=stripe`,
      cancel_url: `${req.protocol}://${req.get('host')}/cv-service?job=${encodeURIComponent(jobTitle)}`,
      metadata: {
        userId: req.session.userId.toString(),
        jobTitle: jobTitle,
        userName: `${userData.first_name} ${userData.last_name}`,
        userPhone: userData.phone
      }
    });

    await pool.query(
      `INSERT INTO cv_orders (user_id, user_email, user_name, user_phone, job_title, stripe_session_id, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [req.session.userId, userEmail, `${userData.first_name} ${userData.last_name}`, userData.phone, jobTitle, session.id, CV_PRICE_USD]
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Payment failed to initialize' });
  }
});

app.post('/api/flutterwave-pay', requireLogin, async (req, res) => {
  console.log('Flutterwave route hit!');
  const { jobTitle, userEmail } = req.body;
  try {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      console.log('ERROR: FLUTTERWAVE_SECRET_KEY missing');
      return res.status(500).json({ error: 'Secret key not set' });
    }

    const user = await pool.query('SELECT first_name, last_name, phone FROM candidates WHERE id = $1', [req.session.userId]);
    const userData = user.rows[0];
    const txRef = `EMMIETECH-CV-${req.session.userId}-${Date.now()}`;

    const payload = {
      tx_ref: txRef,
      amount: CV_PRICE_UGX,
      currency: "UGX",
      redirect_url: `${req.protocol}://${req.get('host')}/cv-success?tx_ref=${txRef}&gateway=flutterwave`,
      customer: {
        email: userEmail,
        phonenumber: userData.phone,
        name: `${userData.first_name} ${userData.last_name}`
      },
      customizations: {
        title: "EmmieTech CV Service",
        description: `Professional CV for: ${jobTitle}`,
        logo: "https://i.imgur.com/8QfQxXj.png"
      },
      meta: {
        userId: req.session.userId,
        jobTitle: jobTitle
      }
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Flutterwave response:', data);

    if (data.status === "success") {
      await pool.query(
        `INSERT INTO cv_orders (user_id, user_email, user_name, user_phone, job_title, flutterwave_tx_ref, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [req.session.userId, userEmail, `${userData.first_name} ${userData.last_name}`, userData.phone, jobTitle, txRef, CV_PRICE_UGX]
      );
      res.json({ link: data.data.link });
    } else {
      res.status(400).json({ error: data.message || 'Flutterwave payment init failed' });
    }
  } catch (err) {
    console.log('Flutterwave crash:', err.message);
    res.status(500).json({ error: 'Payment error. Please try again.' });
  }
});

app.post('/flutterwave-webhook', async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!signature || signature!== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;

  if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
    const { tx_ref, amount, customer, created_at, status } = payload.data;
    const { userId, jobTitle } = payload.data.meta;

    await pool.query(`UPDATE cv_orders SET status = 'paid' WHERE flutterwave_tx_ref = $1`, [tx_ref]);

    const user = await pool.query('SELECT first_name, last_name, phone FROM candidates WHERE id = $1', [userId]);
    const userName = `${user.rows[0].first_name} ${user.rows[0].last_name}`;
    const userPhone = user.rows[0].phone;

    await sendEmail(ADMIN_EMAIL, `🔥 Flutterwave: UGX ${amount} from ${customer.name}`, `
      <h2>New CV Service Order - UGX ${amount} Paid via Flutterwave</h2>
      <p><b>Customer:</b> ${userName}</p>
      <p><b>Email:</b> ${customer.email}</p>
      <p><b>WhatsApp:</b> <a href="https://wa.me/${userPhone.replace(/[^0-9]/g,'')}">${userPhone}</a></p>
      <p><b>Job Target:</b> ${jobTitle}</p>
      <p><b>Reference:</b> ${tx_ref}</p>
      <p><b>Date:</b> ${created_at}</p>
      <p><b>Action:</b> Contact customer within 24hrs to get their old CV. Deliver new CV in 48hrs.</p>
      <p><a href="${req.protocol}://${req.get('host')}/admin">View in Admin Dashboard</a></p>
    `);

    await sendEmail(customer.email, `Payment Received - Your CV for ${jobTitle}`, `
      <h2>Thank you ${userName}!</h2>
      <p>We've received your UGX ${amount} payment for a professional CV rewrite via Flutterwave.</p>
      <p><b>Next steps:</b></p>
      <ol>
        <li>Our team will contact you on WhatsApp: ${userPhone} within 24 hours</li>
        <li>Send us your old CV or tell us your work history</li>
        <li>We deliver your new ATS-optimized CV in 48 hours</li>
      </ol>
      <p><b>Job you're targeting:</b> ${jobTitle}</p>
      <p><b>Transaction Ref:</b> ${tx_ref}</p>
      <p>Questions? WhatsApp us: ${YOUR_WHATSAPP}</p>
      <p>- EmmieTech Global Team</p>
    `);
  }

  res.sendStatus(200);
});

app.get('/cv-success', requireLogin, async (req, res) => {
  const { session_id, tx_ref, gateway } = req.query;
  let jobTitle, userName, userPhone, userEmail, refId;

  if (gateway === 'stripe' && session_id) {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    jobTitle = session.metadata.jobTitle;
    userName = session.metadata.userName;
    userPhone = session.metadata.userPhone;
    userEmail = session.customer_details.email;
    refId = session_id;
    await pool.query(`UPDATE cv_orders SET status = 'paid' WHERE stripe_session_id = $1`, [session_id]);
  } else if (gateway === 'flutterwave' && tx_ref) {
    const order = await pool.query(`SELECT * FROM cv_orders WHERE flutterwave_tx_ref = $1`, [tx_ref]);
    if (order.rows.length > 0) {
      const o = order.rows[0];
      jobTitle = o.job_title;
      userName = o.user_name;
      userPhone = o.user_phone;
      userEmail = o.user_email;
      refId = tx_ref;
    }
  }

    res.send(`
<!DOCTYPE html><html><head><title>Payment Successful - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:500px;text-align:center}.check{font-size:64px;color:#34a853;margin:0 0 16px 0}h1{color:#1a73e8;margin:0 0 16px 0}p{color:#5f6368;line-height:1.6;margin:0 0 24px 0}.btn{display:inline-block;background:#1a73e8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body><div class="card"><div class="check">✓</div><h1>Payment Successful!</h1><p>Thank you! Our CV experts will rewrite your resume for <b>${jobTitle}</b> and email it to you within 48 hours.</p><p>We'll contact you on WhatsApp ${userPhone} if we need more details. Check your email for confirmation.</p><p><small>Reference: ${refId}</small></p><a href="/jobs" class="btn">Back to Jobs</a></div></body></html>
  `);
});

app.get('/admin', requireLogin, async (req, res) => {
  const user = await pool.query('SELECT email FROM candidates WHERE id = $1', [req.session.userId]);
  if (user.rows[0]?.email!== ADMIN_EMAIL) return res.status(403).send('Access denied');

  const orders = await pool.query(`SELECT * FROM cv_orders ORDER BY created_at DESC LIMIT 100`);
  const users = await pool.query(`SELECT COUNT(*) as total FROM candidates`);
  const jobs = await pool.query(`SELECT COUNT(*) as total FROM agency_jobs WHERE status = 'active'`);

  res.send(`
<!DOCTYPE html><html><head><title>EmmieTech Admin</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;background:#f8f9fa}.header{background:#1a73e8;color:white;padding:20px;border-radius:12px;margin-bottom:20px}h1{margin:0}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}.stat-card{background:white;padding:20px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}.stat-num{font-size:32px;font-weight:700;color:#1a73e8}.stat-label{color:#5f6368;font-size:14px}table{width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)}th{background:#f8f9fa;padding:12px;text-align:left;font-weight:600;color:#5f6368;font-size:14px}td{padding:12px;border-top:1px solid #f1f3f4;font-size:14px}.status-paid{background:#e6f4ea;color:#137333;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}.status-pending{background:#fef7e0;color:#ea8600;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600}a{color:#1a73e8;text-decoration:none}.gateway{font-size:11px;color:#5f6368;margin-left:4px}</style></head><body><div class="header"><h1>EmmieTech Admin Dashboard</h1><p style="margin:8px 0 0 0;opacity:0.9;">CV Orders & Analytics</p></div><div class="stats"><div class="stat-card"><div class="stat-num">${users.rows[0].total}</div><div class="stat-label">Total Users</div></div><div class="stat-card"><div class="stat-num">${jobs.rows[0].total}</div><div class="stat-label">Active Jobs</div></div><div class="stat-card"><div class="stat-num">${orders.rows.filter(o => o.status === 'paid').length}</div><div class="stat-label">CV Orders Paid</div></div><div class="stat-card"><div class="stat-num">$${(orders.rows.filter(o => o.status === 'paid' && o.stripe_session_id).length * 30) + (orders.rows.filter(o => o.status === 'paid' && o.flutterwave_tx_ref).length * 30)}</div><div class="stat-label">Revenue Est.</div></div></div><h2>Recent CV Orders</h2><table><thead><tr><th>Date</th><th>Customer</th><th>Email</th><th>Phone</th><th>Job Title</th><th>Amount</th><th>Status</th></tr></thead><tbody>${orders.rows.map(o => `<tr><td>${new Date(o.created_at).toLocaleDateString()}</td><td>${o.user_name}</td><td>${o.user_email}</td><td><a href="https://wa.me/${o.user_phone?.replace(/[^0-9]/g,'')}">${o.user_phone}</a></td><td>${o.job_title}</td><td>$${(o.amount/100).toFixed(2)} ${o.flutterwave_tx_ref? '<span class="gateway">(FLW)</span>' : '<span class="gateway">(Stripe)</span>'}</td><td><span class="status-${o.status}">${o.status.toUpperCase()}</span></td></tr>`).join('')}</tbody></table><p style="margin-top:24px;"><a href="/jobs">← Back to Jobs</a> | <a href="/logout">Logout</a></p></body></html>
  `);
});

app.get('/api/jobs', requireLogin, async (req, res) => {
  try {
    const userCountry = await getUserCountry(req);

    const priorityCountries = ['Uganda', 'UAE', 'Saudi Arabia', 'Qatar', 'Canada', 'UK', 'USA', 'Australia', 'Germany'];

    const result = await pool.query(`
      SELECT *,
        CASE
          WHEN country = ANY($1) THEN 0
          ELSE 1
        END as priority
      FROM agency_jobs
      WHERE status = 'active'
      ORDER BY priority, created_at DESC
      LIMIT 500
    `, [priorityCountries]);

    res.json({ jobs: result.rows, userCountry });
  } catch (err) {
    console.error('Jobs API error:', err);
    res.json({ jobs: [], userCountry: 'Uganda' });
  }
});

app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, skills, country_interest } = req.body;
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO candidates (first_name, last_name, email, phone, password_hash, skills, country_interest) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [firstName, lastName, email, phone, hash, skills, country_interest]
    );
    req.session.userId = result.rows[0].id;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists or invalid data' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM candidates WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log('EmmieTech Recruitment Agency running on port ' + PORT);
});
