import express from 'express';
import bcrypt from 'bcrypt';
import pkg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

const ADZUNA_APP_ID = 'cd82aca8';
const ADZUNA_API_KEY = '39952eab2d2de243ff1ceffc7dc36478';
const RAPIDAPI_KEY = '96a9c08353msh17930481ae22721p150e24jsn49eed442acdc';
const YOUR_WHATSAPP = '+256 776 686 096';
const ADSENSE_PUBLISHER_ID = 'ca-pub-1637256996790764';
const ADSENSE_SLOT_ID = '1234567890'; // REPLACE AFTER YOU CREATE AD UNIT

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
  { 
    title: "Housekeeping Staff - Dubai Hotels", 
    company: "Emirates Group", 
    location: "Dubai, UAE", 
    salary: "2000 AED + Visa + Accommodation",
    url: "https://www.emiratesgroupcareers.com/search/?searchby=location&createNewAlert=false&q=&locationsearch=dubai", 
    country: "UAE", 
    category: "Hospitality",
    date_posted: new Date().toISOString() 
  },
  { 
    title: "Security Guard - SIRA License Provided", 
    company: "G4S UAE", 
    location: "Dubai, UAE", 
    salary: "2500 AED + Benefits",
    url: "https://careers.g4s.com/en/search-results?keywords=&location=Dubai", 
    country: "UAE", 
    category: "Security",
    date_posted: new Date().toISOString() 
  },
  { 
    title: "Caregiver - Live-in Program Canada", 
    company: "Government of Canada", 
    location: "Toronto, Canada", 
    salary: "CAD 16/hr + PR Pathway",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/caregivers.html", 
    country: "Canada", 
    category: "Healthcare",
    date_posted: new Date().toISOString() 
  },
  { 
    title: "Farm Worker - LMIA Approved", 
    company: "Job Bank Canada", 
    location: "Ontario, Canada", 
    salary: "CAD 15/hr + Accommodation",
    url: "https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=farm+worker&locationstring=Canada", 
    country: "Canada", 
    category: "Agriculture",
    date_posted: new Date().toISOString() 
  },
  { 
    title: "Health Care Assistant", 
    company: "NHS UK", 
    location: "London, UK", 
    salary: "£22,000 + Visa Sponsorship",
    url: "https://www.jobs.nhs.uk/candidate/search/results", 
    country: "UK", 
    category: "Healthcare",
    date_posted: new Date().toISOString() 
  },
  { 
    title: "Construction Worker - NEOM", 
    company: "Saudi Binladin Group", 
    location: "Riyadh, Saudi Arabia", 
    salary: "3000 SAR + Housing",
    url: "https://careers.sbg.com.sa/", 
    country: "Saudi Arabia", 
    category: "Construction",
    date_posted: new Date().toISOString() 
  }
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    ' <meta charset="UTF-8">' +
    ' <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    ' <title>EmmieTech Global Recruitment Agency - Uganda to UAE, Canada, UK</title>' +
    ' <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_PUBLISHER_ID + '" crossorigin="anonymous"><\/script>' +
    ' <style>' +
    ' body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #f8f9fa; color: #202124; }' +
    '.header { background: #fff; border-bottom: 1px solid #dadce0; padding: 16px 24px; position: sticky; top: 0; z-index: 100; }' +
    '.header h1 { margin: 0; font-size: 22px; color: #1a73e8; }' +
    '.header p { margin: 4px 0 0; font-size: 13px; color: #5f6368; }' +
    '.hero { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 60px 20px; text-align: center; }' +
    '.hero h2 { font-size: 36px; margin: 0 0 12px 0; font-weight: 700; }' +
    '.hero p { font-size: 18px; opacity: 0.95; margin: 0 0 24px 0; }' +
    '.cta-btn { background: #fff; color: #1a73e8; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; }' +
    '.container { max-width: 1200px; margin: 32px auto; padding: 0 20px; }' +
    '.filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }' +
    '.filters select, .filters input { padding: 10px 14px; border-radius: 8px; border: 1px solid #dadce0; font-size: 14px; }' +
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
    '.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 40px 0; }' +
    '.stat-card { background: white; padding: 24px; border-radius: 12px; text-align: center; }' +
    '.stat-card h4 { margin: 0 0 8px 0; font-size: 32px; color: #1a73e8; }' +
    '.stat-card p { margin: 0; color: #5f6368; }' +
    '.footer { background: #202124; color: #e8eaed; padding: 40px 20px; margin-top: 60px; text-align: center; }' +
    '.ad-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; min-height: 280px; }' +
    ' </style>' +
    '</head>' +
    '<body>' +
    ' <div class="header">' +
    ' <h1>EmmieTech Global Recruitment</h1>' +
    ' <p>Licensed Agency | Uganda → UAE, Saudi, Qatar, Canada, UK</p>' +
    ' </div>' +
    ' <div class="hero">' +
    ' <h2>Get Hired Abroad Legally</h2>' +
    ' <p>We connect Ugandan professionals to verified employers. Free for candidates. No upfront fees.</p>' +
    ' <a href="#jobs" class="cta-btn">Browse Jobs</a>' +
    ' </div>' +
    ' <div class="container">' +
    ' <div class="stats">' +
    ' <div class="stat-card"><h4>500+</h4><p>Workers Placed</p></div>' +
    ' <div class="stat-card"><h4>5</h4><p>Countries</p></div>' +
    ' <div class="stat-card"><h4>100%</h4><p>Legal Contracts</p></div>' +
    ' <div class="stat-card"><h4>0 KES</h4><p>Candidate Fees</p></div>' +
    ' </div>' +
    ' <h2 id="jobs" style="margin: 0 0 20px 0;">Active Job Openings</h2>' +
    ' <div class="filters">' +
    ' <select id="countryFilter"><option value="">All Countries</option><option value="UAE">UAE</option><option value="Canada">Canada</option><option value="UK">UK</option><option value="Saudi Arabia">Saudi Arabia</option></select>' +
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
    '   const res = await fetch("/api/jobs");' +
    '   const dbJobs = await res.json();' +
    '   allJobs = [...allJobs, ...dbJobs];' +
    '   renderJobs(allJobs);' +
    ' }' +
    ' function renderJobs(jobs) {' +
    ' document.getElementById("jobGrid").innerHTML = jobs.map((j, index) => {' +
    '   const adCode = index === 2 && ADSENSE_SLOT !== "1234567890" ? `' +
    '   <div class="ad-container">' +
    '     <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT}" data-ad-slot="${ADSENSE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
    '     <script>(adsbygoogle = window.adsbygoogle || []).push({});<\\/script>' +
    '   </div>` : "";' +
    '   return `' +
    '   <div class="job-card">' +
    '   <span class="country-badge">${j.country}</span>' +
    '   <h3>${j.title}</h3>' +
    '   <p class="job-meta">${j.company} • ${j.location}</p>' +
    '   <p class="job-salary">${j.salary || "Competitive"}</p>' +
    '   <a href="${j.url}" target="_blank" class="apply-btn">Apply via Employer Site</a>' +
    '   <a href="https://wa.me/${WHATSAPP.replace(/[^0-9]/g,"")}?text=Hi, I want to apply for: ${encodeURIComponent(j.title)} at ${encodeURIComponent(j.company)}" target="_blank" class="apply-btn whatsapp-btn">Chat on WhatsApp</a>' +
    '   </div>${adCode}`;' +
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

app.get('/api/jobs', async (req, res) => {
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
    await pool.query(
      `INSERT INTO candidates (first_name, last_name, email, phone, password_hash, skills, country_interest) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [firstName, lastName, email, phone, hash, skills, country_interest]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.listen(PORT, () => {
  console.log('EmmieTech Recruitment Agency running on port ' + PORT);
});
