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

const AGENCY_JOBS = [
  { title: "Housekeeping Staff - Dubai Hotels", company: "Emirates Group", location: "Dubai, UAE", salary: "2000 AED + Visa + Accommodation", url: "https://www.emiratesgroupcareers.com/search/?searchby=location&createNewAlert=false&q=&locationsearch=dubai", country: "UAE", category: "Hospitality", date_posted: new Date().toISOString() },
  { title: "Security Guard - SIRA License Provided", company: "G4S UAE", location: "Dubai, UAE", salary: "2500 AED + Benefits", url: "https://careers.g4s.com/en/search-results?keywords=&location=Dubai", country: "UAE", category: "Security", date_posted: new Date().toISOString() },
  { title: "Caregiver - Live-in Program Canada", company: "Government of Canada", location: "Toronto, Canada", salary: "CAD 16/hr + PR Pathway", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/caregivers.html", country: "Canada", category: "Healthcare", date_posted: new Date().toISOString() },
  { title: "Farm Worker - LMIA Approved", company: "Job Bank Canada", location: "Ontario, Canada", salary: "CAD 15/hr + Accommodation", url: "https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=farm+worker&locationstring=Canada", country: "Canada", category: "Agriculture", date_posted: new Date().toISOString() },
  { title: "Health Care Assistant", company: "NHS UK", location: "London, UK", salary: "£22,000 + Visa Sponsorship", url: "https://www.jobs.nhs.uk/candidate/search/results", country: "UK", category: "Healthcare", date_posted: new Date().toISOString() },
  { title: "Construction Worker - NEOM", company: "Saudi Binladin Group", location: "Riyadh, Saudi Arabia", salary: "3000 SAR + Housing", url: "https://careers.sbg.com.sa/", country: "Saudi Arabia", category: "Construction", date_posted: new Date().toISOString() }
];

function requireLogin(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/');
  }
}

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
    '.auth-container h1 { margin: 0 0 8px 0; font-size: 24px; color: #1a73e8; text-align: center; }' +
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
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="auth-container">' +
    ' <h1>EmmieTech Global</h1>' +
    ' <p>Access verified jobs abroad. Free for candidates.</p>' +
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
    ' <div class="form-group"><label>Password</label><input type="password" id="regPassword" minlength="6" required></div>' +
    ' <div class="form-group"><label>Country Interest</label><select id="countryInterest" onchange="checkOtherCountry()" required><option value="">Select Country</option><option value="🇦🇪 UAE">🇦🇪 UAE</option><option value="🇨🇦 Canada">🇨🇦 Canada</option><option value="🇬🇧 UK">🇬🇧 UK</option><option value="🇸🇦 Saudi Arabia">🇸🇦 Saudi Arabia</option><option value="🇶🇦 Qatar">🇶🇦 Qatar</option><option value="🇺🇸 USA">🇺🇸 USA</option><option value="🇦🇺 Australia">🇦🇺 Australia</option><option value="🇩🇪 Germany">🇩🇪 Germany</option><option value="🇶🇦 Others">Others</option></select></div>' +
    ' <div class="form-group" id="otherCountryGroup"><label>Specify Country</label><input type="text" id="otherCountry" placeholder="Enter your country"></div>' +
    ' <div class="form-group"><label>Skills</label><input type="text" id="skills" placeholder="e.g. Housekeeping, Security" required></div>' +
    ' <button type="submit" class="btn">Create Free Account</button>' +
    ' </form>' +
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
    ' if (select.value === "🇶🇦 Others") {' +
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
    ' const res = await fetch("/api/login", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ email: document.getElementById("loginEmail").value, password: document.getElementById("loginPassword").value }) });' +
    ' const data = await res.json();' +
    ' if (data.success) { window.location.href = "/jobs"; }' +
    ' else { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = data.error; }' +
    ' }' +
    ' async function handleRegister(e) {' +
    ' e.preventDefault();' +
    ' const countrySelect = document.getElementById("countryInterest").value;' +
    ' const finalCountry = countrySelect === "🇶🇦 Others"? document.getElementById("otherCountry").value : countrySelect;' +
    ' if (countrySelect === "🇶🇦 Others" &&!finalCountry.trim()) { document.getElementById("error").style.display = "block"; document.getElementById("error").textContent = "Please specify your country"; return; }' +
    ' const fullPhone = document.getElementById("countryCode").value + document.getElementById("phone").value;' +
    ' const res = await fetch("/api/register", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ firstName: document.getElementById("firstName").value, lastName: document.getElementById("lastName").value, email: document.getElementById("regEmail").value, phone: fullPhone, password: document.getElementById("regPassword").value, skills: document.getElementById("skills").value, country_interest: finalCountry }) });' +
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
    '.header { background: #fff; border-bottom: 1px solid #dadce0; padding: 16px 24px; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; }' +
    '.header h1 { margin: 0; font-size: 22px; color: #1a73e8; }' +
    '.header p { margin: 4px 0 0; font-size: 13px; color: #5f6368; }' +
    '.user-info { display: flex; align-items: center; gap: 12px; }' +
    '.logout-btn { background: #f1f3f4; color: #5f6368; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }' +
    '.hero { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 40px 20px; text-align: center; }' +
    '.hero h2 { font-size: 28px; margin: 0 0 12px 0; font-weight: 700; }' +
    '.hero p { font-size: 16px; opacity: 0.95; margin: 0; }' +
    '.container { max-width: 1200px; margin: 32px auto; padding: 0 20px; }' +
    '.filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }' +
    '.filters select,.filters input { padding: 10px 14px; border-radius: 8px; border: 1px solid #dadce0; font-size: 14px; }' +
    '.job-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }' +
    '.job-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s; }' +
    '.job-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }' +
    '.job-card h3 { margin: 0 0 8px 0; color: #1a73e8; font-size: 18px; }' +
    '.job-meta { margin: 0 0 12px 0; color: #5f6368; font-size: 14px; }' +
    '.job-salary { color: #34a853; font-weight: 600; margin: 0 0 16px 0; }' +
    '.country-badge { display: inline-block; background: #e8f0fe; color: #1967d2; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }' +
    '.apply-btn { display: block; background: #1a73e8; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; margin-bottom: 8px; }' +
    '.apply-btn:hover { background: #1557b0; }' +
    '.whatsapp-btn { background: #25d366; }' +
    '.whatsapp-btn:hover { background: #1da851; }' +
    '.footer { background: #202124; color: #e8eaed; padding: 40px 20px; margin-top: 60px; text-align: center; }' +
    '.ad-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; min-height: 280px; }' +
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="header">' +
    ' <div><h1>EmmieTech Global Recruitment</h1><p>Licensed Agency | Uganda → UAE, Saudi, Qatar, Canada, UK</p></div>' +
    ' <div class="user-info"><span>Hi, ' + userName + '</span><a href="/logout" class="logout-btn">Logout</a></div>' +
    ' </div>' +
    ' <div class="hero">' +
    ' <h2>Welcome Back, ' + userName + '</h2>' +
    ' <p>Browse verified jobs. Apply directly to employers. 100% Free.</p>' +
    ' </div>' +
    ' <div class="container">' +
    ' <h2 id="jobs" style="margin: 0 0 20px 0;">Active Job Openings</h2>' +
    ' <div class="filters">' +
    ' <select id="countryFilter"><option value="">All Countries</option><option value="UAE">UAE</option><option value="Canada">Canada</option><option value="UK">UK</option><option value="Saudi Arabia">Saudi Arabia</option><option value="Qatar">Qatar</option><option value="USA">USA</option><option value="Australia">Australia</option><option value="Germany">Germany</option></select>' +
    ' <select id="categoryFilter"><option value="">All Categories</option><option value="Hospitality">Hospitality</option><option value="Healthcare">Healthcare</option><option value="Security">Security</option><option value="Construction">Construction</option><option value="Agriculture">Agriculture</option></select>' +
    ' <input type="text" id="searchInput" placeholder="Search job title..." />' +
    ' </div>' +
    ' <div id="jobGrid" class="job-grid"></div>' +
    ' </div>' +
    ' <div class="footer">' +
    ' <p><b>EmmieTech Global Recruitment Agency</b></p>' +
    ' <p>Kampala, Uganda | WhatsApp: ' + YOUR_WHATSAPP + '</p>' +
    ' <p>Licensed by Ministry of Gender, Labour & Social Development</p>' +
    ' </div>' +
    ' <script>' +
    ' const WHATSAPP = "' + YOUR_WHATSAPP + '";' +
    ' const ADSENSE_CLIENT = "' + ADSENSE_PUBLISHER_ID + '";' +
    ' const ADSENSE_SLOT = "' + ADSENSE_SLOT_ID + '";' +
    ' let allJobs = ' + JSON.stringify(AGENCY_JOBS) + ';' +
    ' async function loadJobs() {' +
    ' const res = await fetch("/api/jobs");' +
    ' const dbJobs = await res.json();' +
    ' allJobs = [...allJobs,...dbJobs];' +
    ' renderJobs(allJobs);' +
    ' }' +
    ' function renderJobs(jobs) {' +
    ' document.getElementById("jobGrid").innerHTML = jobs.map((j, index) => {' +
    ' const adCode = index === 2 && ADSENSE_SLOT!== "1234567890"? `' +
    ' <div class="ad-container">' +
    ' <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
    ' <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>' +
    ' </div>` : "";' +
    ' return `' +
    ' <div class="job-card">' +
    ' <span class="country-badge">${j.country}</span>' +
    ' <h3>${j.title}</h3>' +
    ' <p class="job-meta">${j.company} • ${j.location}</p>' +
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
    const result = await pool.query(`SELECT * FROM agency_jobs WHERE status = 'active' ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, skills, country_interest } = req.body;
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
