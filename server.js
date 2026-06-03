import express from 'express';
import bcrypt from 'bcrypt';
import pkg from 'pg';
import fetch from 'node-fetch';
import session from 'express-session';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

const ADZUNA_APP_ID = 'cd82aca8';
const ADZUNA_API_KEY = '39952eab2d2de243ff1ceffc7dc36478';
const RAPIDAPI_KEY = '96a9c08353msh17930481ae22721p150e24jsn49eed442acdc';
const YOUR_WHATSAPP = '+256 776 686 096';
const ADSENSE_PUBLISHER_ID = 'ca-pub-1637256996790764';
const ADSENSE_SLOT_ID = '1234567890';
const IPINFO_KEY = process.env.IPINFO_KEY || '';

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

pool.query(`ALTER TABLE agency_jobs ADD CONSTRAINT unique_job_url UNIQUE (url)`).catch(e => {
  console.log('Constraint exists or table empty:', e.message);
});

// GET USER COUNTRY FROM IP
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

// VERIFIED HIGH-PAYING JOBS - FALLBACK IF API FAILS
const AGENCY_JOBS = [
  { title: "Registered Nurse - H1B Sponsorship", company: "Mayo Clinic", location: "Rochester, USA", salary: "$85,000 - $110,000 + Relocation", url: "https://jobs.mayoclinic.org/search-jobs/nursing", country: "USA", category: "Healthcare" },
  { title: "Software Engineer - H1B Visa", company: "Amazon", location: "Seattle, USA", salary: "$130,000 - $180,000 + Stock", url: "https://www.amazon.jobs/en/search?base_query=software+engineer", country: "USA", category: "Technology" },
  { title: "Truck Driver - CDL Sponsorship", company: "Swift Transportation", location: "Texas, USA", salary: "$70,000 - $95,000 + Benefits", url: "https://www.swifttrans.com/careers", country: "USA", category: "Transport" },
  { title: "Senior Caregiver - PR Pathway", company: "Government of Canada", location: "Toronto, Canada", salary: "CAD $55,000 + PR in 2 Years", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/caregivers.html", country: "Canada", category: "Healthcare" },
  { title: "Heavy Equipment Operator - LMIA", company: "Suncor Energy", location: "Alberta, Canada", salary: "CAD $95,000 + Housing", url: "https://www.suncor.com/en-ca/careers", country: "Canada", category: "Construction" },
  { title: "IT Project Manager - Express Entry", company: "RBC Bank", location: "Toronto, Canada", salary: "CAD $100,000 - $140,000", url: "https://jobs.rbc.com/ca/en/search-results", country: "Canada", category: "Technology" },
  { title: "Senior Health Care Assistant - Visa Sponsorship", company: "NHS UK", location: "London, UK", salary: "£28,000 - £35,000 + NHS Benefits", url: "https://www.jobs.nhs.uk/candidate/search/results?language=en&searchFormType=main&keywords=healthcare+assistant", country: "UK", category: "Healthcare" },
  { title: "Senior Chef - Skilled Worker Visa", company: "Marriott Hotels UK", location: "Manchester, UK", salary: "£32,000 - £45,000 + Accommodation", url: "https://careers.marriott.com/en", country: "UK", category: "Hospitality" },
  { title: "Executive Housekeeper - Dubai Hotels", company: "Emirates Group", location: "Dubai, UAE", salary: "AED 8,000 - 12,000 + Visa + Housing", url: "https://www.emiratesgroupcareers.com/search/?q=housekeeper", country: "UAE", category: "Hospitality" },
  { title: "Security Manager - SIRA License", company: "G4S UAE", location: "Abu Dhabi, UAE", salary: "AED 10,000 - 15,000 + Benefits", url: "https://careers.g4s.com/en/search-results?keywords=manager", country: "UAE", category: "Security" },
  { title: "Construction Project Manager - NEOM", company: "Saudi Binladin Group", location: "Riyadh, Saudi Arabia", salary: "SAR 25,000 - 35,000 + Housing", url: "https://careers.sbg.com.sa/", country: "Saudi Arabia", category: "Construction" },
  { title: "Nurse - EU Blue Card Germany", company: "Charité Hospital Berlin", location: "Berlin, Germany", salary: "€50,000 - €65,000 + Benefits", url: "https://www.charite.de/en/career/", country: "Germany", category: "Healthcare" },
  { title: "Mechanical Engineer - Blue Card", company: "BMW Group", location: "Munich, Germany", salary: "€70,000 - €95,000", url: "https://www.bmwgroup.jobs/de/en.html", country: "Germany", category: "Engineering" },
  { title: "Aged Care Nurse - 482 Visa Sponsorship", company: "Bupa Australia", location: "Sydney, Australia", salary: "AUD $80,000 - $100,000 + Relocation", url: "https://careers.bupa.com.au/en", country: "Australia", category: "Healthcare" },
  { title: "Mining Supervisor - 186 Visa", company: "Rio Tinto", location: "Perth, Australia", salary: "AUD $150,000 - $180,000 + FIFO", url: "https://www.riotinto.com/careers", country: "Australia", category: "Mining" },
  { title: "Housekeeping Staff - Dubai Hotels", company: "Emirates Group", location: "Dubai, UAE", salary: "2000 AED + Visa + Accommodation", url: "https://www.emiratesgroupcareers.com/search/?q=housekeeping", country: "UAE", category: "Hospitality" },
  { title: "Security Guard - SIRA License Provided", company: "G4S UAE", location: "Dubai, UAE", salary: "2500 AED + Benefits", url: "https://careers.g4s.com/en/search-results?keywords=guard", country: "UAE", category: "Security" },
  { title: "Farm Worker - LMIA Approved", company: "Job Bank Canada", location: "Ontario, Canada", salary: "CAD 15/hr + Accommodation", url: "https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=farm+worker", country: "Canada", category: "Agriculture" }
];

// AUTO-FETCH NEW JOBS DAILY FROM ADZUNA
async function fetchDailyJobs() {
  console.log('Starting daily job fetch...');
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
            } catch (insertErr) {
              // Ignore duplicates
            }
          }
        }
      } catch (err) {
        console.log(`Failed ${country.name} ${keyword}:`, err.message);
      }
    }
  }
  console.log(`Daily job fetch complete. Added ${totalAdded} new jobs.`);
}

// RUN ONCE AT STARTUP + EVERY 24 HOURS
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
  <p>UAE, Saudi Arabia, Qatar, Canada, UK, USA, Germany, Australia</p>

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
    '.logo-header img { height: 40px; width: auto; }' +
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
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="auth-container">' +
    ' <div class="logo-header">' +
    ' <img src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Coat_of_arms_of_Uganda.svg" alt="Uganda Coat of Arms">' +
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
    ' <div class="form-group"><label>Password</label><input type="password" id="loginPassword" required></div>' +
    ' <button type="submit" class="btn">Login to View Jobs</button>' +
    ' </form>' +
    ' <form id="registerForm" onsubmit="handleRegister(event)">' +
    ' <div class="form-group"><label>First Name</label><input type="text" id="firstName" required></div>' +
    ' <div class="form-group"><label>Last Name</label><input type="text" id="lastName" required></div>' +
    ' <div class="form-group"><label>Email</label><input type="email" id="regEmail" required></div>' +
    ' <div class="form-group"><label>WhatsApp Number</label><div class="phone-group"><select id="countryCode"><option value="+256">🇺🇬 +256</option><option value="+254">🇰🇪 +254</option><option value="+255">🇹🇿 +255</option><option value="+250">🇷🇼 +250</option><option value="+971">🇦🇪 +971</option><option value="+966">🇸🇦 +966</option><option value="+974">🇶🇦 +974</option><option value="+1">🇨🇦 +1</option><option value="+44">🇬🇧 +44</option><option value="+91">🇮🇳 +91</option><option value="+234">🇳🇬 +234</option><option value="+233">🇬🇭 +233</option><option value="+27">🇿🇦 +27</option></select><input type="tel" id="phone" placeholder="776686096" required></div></div>' +
    ' <div class="form-group"><label>Password</label><input type="password" id="regPassword" minlength="6" required><div class="password-hint">Minimum 6 characters</div></div>' +
    ' <div class="form-group"><label>Confirm Password</label><input type="password" id="confirmPassword" minlength="6" required></div>' +
    ' <div class="form-group"><label>Country Interest</label><select id="countryInterest" onchange="checkOtherCountry()" required><option value="">Select Country</option><option value="🇦🇪 UAE">🇦🇪 UAE</option><option value="🇨🇦 Canada">🇨🇦 Canada</option><option value="🇬🇧 UK">🇬🇧 UK</option><option value="🇸🇦 Saudi Arabia">🇸🇦 Saudi Arabia</option><option value="🇶🇦 Qatar">🇶🇦 Qatar</option><option value="🇺🇸 USA">🇺🇸 USA</option><option value="🇦🇺 Australia">🇦🇺 Australia</option><option value="🇩🇪 Germany">🇩🇪 Germany</option><option value="Others">Others</option></select></div>' +
    ' <div class="form-group" id="otherCountryGroup"><label>Specify Country</label><input type="text" id="otherCountry" placeholder="Enter your country"></div>' +
    ' <div class="form-group"><label>Skills</label><input type="text" id="skills" placeholder="e.g. Housekeeping, Security, Nursing" required></div>' +
    ' <button type="submit" class="btn">Create Free Account</button>' +
    ' </form>' +
    ' <div class="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a></div>' +
    ' </div>' +
    ' <script>' +
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
    ' const res = await fetch("/api/register", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ firstName: document.getElementById("firstName").value, lastName: document.getElementById("lastName").value, email: document.getElementById("regEmail").value, phone: fullPhone, password: password, skills: document.getElementById("skills").value, country_interest: finalCountry }) });' +
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
    '.header { background: #fff; border-bottom: 1px solid #dadce0; padding: 12px 16px; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }' +
    '.header-left { display: flex; align-items: center; gap: 12px; }' +
    '.header-left img { height: 48px; width: auto; }' +
    '.header h1 { margin: 0; font-size: 20px; color: #1a73e8; line-height: 1.2; }' +
    '.header p { margin: 4px 0 0; font-size: 12px; color: #5f6368; }' +
    '.user-info { display: flex; align-items: center; gap: 12px; }' +
    '.logout-btn { background: #f1f3f4; color: #5f6368; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }' +
    '.hero { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 40px 20px; text-align: center; }' +
    '.hero h2 { font-size: 28px; margin: 0 0 12px 0; font-weight: 700; }' +
    '.hero p { font-size: 16px; opacity: 0.95; margin: 0; }' +
    '.container { max-width: 1200px; margin: 32px auto; padding: 0 20px; }' +
    '.filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }' +
    '.filters select,.filters input { padding: 10px 14px; border-radius: 8px; border: 1px solid #dadce0; font-size: 14px; }' +
    '.job-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }' +
    '.job-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; position: relative; }' +
    '.job-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }' +
    '.job-card h3 { margin: 0 0 8px 0; color: #1a73e8; font-size: 18px; }' +
    '.job-meta { margin: 0 0 12px 0; color: #5f6368; font-size: 14px; }' +
    '.job-salary { color: #34a853; font-weight: 700; margin: 0 0 16px 0; font-size: 16px; }' +
    '.country-badge { display: inline-block; background: #e8f0fe; color: #1967d2; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }' +
    '.high-pay-badge { position: absolute; top: 16px; right: 16px; background: #fbbc04; color: #202124; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }' +
    '.apply-btn { display: block; background: #1a73e8; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; margin-bottom: 8px; }' +
    '.apply-btn:hover { background: #1557b0; }' +
    '.whatsapp-btn { background: #25d366; }' +
    '.whatsapp-btn:hover { background: #1da851; }' +
    '.footer { background: #202124; color: #e8eaed; padding: 40px 20px; margin-top: 60px; text-align: center; }' +
    '.ad-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0,0,0.1); text-align: center; min-height: 280px; }' +
    '.footer-links { margin-top: 20px; }' +
    '.footer-links a { color: #8ab4f8; text-decoration: none; margin: 0 10px; font-size: 14px; }' +
    '@media (max-width: 600px) {.header-left img { height: 40px; }.header h1 { font-size: 18px; }.header p { font-size: 11px; } }' +
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="header">' +
    ' <div class="header-left">' +
    ' <img src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Coat_of_arms_of_Uganda.svg" alt="Uganda Coat of Arms">' +
    ' <div><h1>EmmieTech Global Recruitment</h1><p>Licensed Agency | Uganda → UAE, Saudi, Qatar, Canada, UK, USA, Germany, Australia</p></div>' +
    ' </div>' +
    ' <div class="user-info"><span>Hi, ' + userName + '</span><a href="/logout" class="logout-btn">Logout</a></div>' +
    ' </div>' +
    ' <div class="hero">' +
    ' <h2 id="heroTitle">High-Paying Jobs Worldwide</h2>' +
    ' <p id="heroSubtitle">$70,000 - $180,000+ salaries. Visa sponsorship available. 100% Free for candidates.</p>' +
    ' </div>' +
    ' <div class="container">' +
    ' <h2 id="jobs" style="margin: 0 0 20px 0;">Active Job Openings</h2>' +
    ' <div class="filters">' +
    ' <select id="countryFilter"><option value="">All Countries</option><option value="UAE">UAE</option><option value="Canada">Canada</option><option value="UK">UK</option><option value="Saudi Arabia">Saudi Arabia</option><option value="Qatar">Qatar</option><option value="USA">USA</option><option value="Australia">Australia</option><option value="Germany">Germany</option></select>' +
    ' <select id="categoryFilter"><option value="">All Categories</option><option value="Healthcare">Healthcare</option><option value="Technology">Technology</option><option value="Engineering">Engineering</option><option value="Construction">Construction</option><option value="Hospitality">Hospitality</option><option value="Security">Security</option><option value="Transport">Transport</option><option value="Mining">Mining</option><option value="Agriculture">Agriculture</option></select>' +
    ' <input type="text" id="searchInput" placeholder="Search job title..." />' +
    ' </div>' +
    ' <div id="jobGrid" class="job-grid"></div>' +
    ' </div>' +
    ' <div class="footer">' +
    ' <p><b>EmmieTech Global Recruitment Agency</b></p>' +
    ' <p>Kampala, Uganda | WhatsApp: ' + YOUR_WHATSAPP + '</p>' +
    ' <p>Licensed by Ministry of Gender, Labour & Social Development</p>' +
    ' <div class="footer-links"><a href="/about">About Us</a><a href="/privacy">Privacy Policy</a></div>' +
    ' </div>' +
    ' <script>' +
    ' const WHATSAPP = "' + YOUR_WHATSAPP + '";' +
    ' const ADSENSE_CLIENT = "' + ADSENSE_PUBLISHER_ID + '";' +
    ' const ADSENSE_SLOT = "' + ADSENSE_SLOT_ID + '";' +
    ' let allJobs = ' + JSON.stringify(AGENCY_JOBS) + ';' +
    ' async function loadJobs() {' +
    ' const res = await fetch("/api/jobs");' +
    ' const data = await res.json();' +
    ' const dbJobs = data.jobs;' +
    ' const userCountry = data.userCountry;' +
    ' allJobs = [...dbJobs,...allJobs];' +
    ' if (userCountry && userCountry!== "Other") {' +
    ' document.getElementById("heroSubtitle").innerHTML = `Top jobs for ${userCountry} → UAE, Canada, UK, USA. 100% Free for candidates.`;' +
    ' }' +
    ' renderJobs(allJobs);' +
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
    ' document.getElementById("jobGrid").innerHTML = jobs.map((j, index) => {' +
    ' const isHighPay = j.salary.includes("$") || j.salary.includes("€") || j.salary.includes("AUD") || j.salary.includes("SAR 2") || j.salary.includes("AED 8") || j.salary.includes("AED 10");' +
    ' const highPayBadge = isHighPay? `<div class="high-pay-badge">💰 HIGH PAY</div>` : "";' +
    ' const adCode = index === 2 && ADSENSE_SLOT!== "1234567890"? `' +
    ' <div class="ad-container">' +
    ' <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
    ' <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>' +
    ' </div>` : "";' +
    ' return `' +
    ' <div class="job-card">' +
    ' ${highPayBadge}' +
    ' <span class="country-badge">${j.country}</span>' +
    ' <h3>${j.title}</h3>' +
    ' <p class="job-meta">${j.company} • ${j.location} • ${timeAgo(j.created_at)}</p>' +
    ' <p class="job-salary">${j.salary || "Competitive"}</p>' +
    ' <a href="${j.url}" target="_blank" class="apply-btn">Apply via Employer Site</a>' +
    ' <a href="https://wa.me/${WHATSAPP.replace(/[^0-9]/g,"")}?text=Hi, I want to apply for: ${encodeURIComponent(j.title)} at ${encodeURIComponent(j.company)}" target="_blank" class="apply-btn whatsapp-btn">Chat on WhatsApp</a>' +
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
    ' document.getElementById("countryFilter").addEventListener("change", filterJobs);' +
    ' document.getElementById("categoryFilter").addEventListener("change", filterJobs);' +
    ' document.getElementById("searchInput").addEventListener("input", filterJobs);' +
    ' loadJobs();' +
    ' <\/script>' +
    ' </body>' +
    ' </html>'
  );
});

app.get('/api/jobs', requireLogin, async (req, res) => {
  try {
    const userCountry = await getUserCountry(req);

    // Priority for East Africa: UAE, Saudi, Qatar, Canada, UK, USA
    const priorityCountries = ['UAE', 'Saudi Arabia', 'Qatar', 'Canada', 'UK', 'USA', 'Australia', 'Germany'];

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
