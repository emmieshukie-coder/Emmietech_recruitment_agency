const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1); // Required for Render HTTPS

// ---------- DATABASE ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ---------- CONSTANTS ----------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@emmietech.com';
const CV_PRICE_USD = 3000; // $30.00 in cents
const CV_PRICE_UGX = 114000; // UGX 114,000
const YOUR_WHATSAPP = process.env.YOUR_WHATSAPP || '+256700000000';
const ADSENSE_PUB_ID = process.env.ADSENSE_PUB_ID || 'pub-1637256996790764';

// ---------- MIDDLEWARE ----------
// Stripe webhook needs raw body
app.use('/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'emmietech-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'lax'
  }
}));

// ---------- ADSENSE ADS.TXT ----------
app.get('/ads.txt', (req, res) => {
  res.type('text/plain');
  res.send(`google.com, ${ADSENSE_PUB_ID}, DIRECT, f08c47fec0942fa0`);
});

// ---------- PWA MANIFEST ----------
app.get('/manifest.json', (req, res) => {
  res.json({
    "name": "EmmieTech Global Recruitment",
    "short_name": "EmmieTech",
    "description": "High-paying jobs worldwide with visa sponsorship",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#1a73e8",
    "orientation": "portrait-primary",
    "icons": [
      {
        "src": "https://i.imgur.com/8QfQxXj.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "https://i.imgur.com/8QfQxXj.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  });
});

// ---------- SERVICE WORKER ----------
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`
    const CACHE_NAME = 'emmietech-v1.2';
    const urlsToCache = ['/', '/jobs', '/public-jobs', '/about', '/privacy'];

    self.addEventListener('install', event => {
      self.skipWaiting();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
    });

    self.addEventListener('activate', event => {
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          }));
        })
      );
      return self.clients.claim();
    });

    self.addEventListener('fetch', event => {
      if (event.request.method !== 'GET') return;
      event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
    });
  `);
});

// ---------- HELPERS ----------
const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/');
  next();
};

const sendEmail = async (to, subject, html) => {
  // TODO: Add SendGrid/Mailgun here
  console.log(`\n--- EMAIL ---\nTo: ${to}\nSubject: ${subject}\n${html}\n------------\n`);
};

const getUserCountry = async (req) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Uganda';
    const response = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    return response.data.country || 'Uganda';
  } catch {
    return 'Uganda';
  }
};

// ---------- DATABASE SETUP ----------
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        skills TEXT,
        country_interest TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agency_jobs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        country TEXT NOT NULL,
        salary_range TEXT,
        description TEXT,
        visa_sponsorship BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cv_orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES candidates(id),
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_phone TEXT NOT NULL,
        job_title TEXT NOT NULL,
        stripe_session_id TEXT,
        flutterwave_tx_ref TEXT,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
};
initDB();

// ---------- PUBLIC PAGES ----------
app.get('/public-jobs', async (req, res) => {
  try {
    const jobs = await pool.query(`SELECT * FROM agency_jobs WHERE status = 'active' ORDER BY created_at DESC LIMIT 20`);
    res.send(`
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EmmieTech Global - Jobs with Visa Sponsorship</title>
<meta name="description" content="Find high-paying jobs worldwide with visa sponsorship. Canada, UK, UAE, USA, Germany. Professional CV writing service.">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1a73e8">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;color:#202124}.header{background:#1a73e8;color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}.header h1{margin:0;font-size:20px}.container{max-width:1200px;margin:0 auto;padding:24px}.job-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-top:24px}.job-card{background:white;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}.job-title{font-size:18px;font-weight:600;margin:0 0 8px 0;color:#1a73e8}.job-company{color:#5f6368;margin:0 0 12px 0}.job-meta{display:flex;gap:12px;margin:0 0 12px 0;font-size:14px}.badge{background:#e8f0fe;color:#1967d2;padding:4px 12px;border-radius:16px;font-size:12px;font-weight:600}.btn{display:inline-block;background:#1a73e8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}.footer{text-align:center;padding:40px 24px;color:#5f6368;font-size:14px}</style>
</head><body>
<div class="header"><h1>EmmieTech Global Recruitment</h1><a href="/" style="color:white;text-decoration:none;">Login</a></div>
<div class="container">
<h2>Latest Jobs with Visa Sponsorship</h2>
<p>Join thousands getting hired abroad. Create a free account to apply.</p>
<div class="job-grid">
${jobs.rows.map(j => `<div class="job-card"><div class="job-title">${j.title}</div><div class="job-company">${j.company}</div><div class="job-meta"><span>📍 ${j.country}</span>${j.visa_sponsorship? '<span class="badge">Visa Sponsorship</span>' : ''}</div><p>${j.description?.substring(0,120) || 'Exciting opportunity abroad...'}...</p><a href="/" class="btn">Login to Apply</a></div>`).join('')}
</div>
</div>
<div class="footer"><p>© 2026 EmmieTech Global. <a href="/privacy">Privacy</a> | <a href="/about">About</a> | <a href="/">Login</a></p></div>
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}</script>
</body></html>
    `);
  } catch (err) {
    res.status(500).send('Error loading jobs');
  }
});

app.get('/about', (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title>About EmmieTech Global</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="manifest" href="/manifest.json"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#202124}h1{color:#1a73e8}</style></head><body><h1>About EmmieTech Global</h1><p>EmmieTech Global Recruitment connects skilled professionals from Uganda, Kenya, and East Africa with high-paying employers in Canada, UK, UAE, USA, Australia, and Germany.</p><p>Founded in 2024, we specialize in visa-sponsored roles and provide professional CV writing services to help you stand out.</p><p><a href="/">Back to Login</a> | <a href="/public-jobs">View Jobs</a></p></body></html>
  `);
});

app.get('/privacy', (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title>Privacy Policy - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="manifest" href="/manifest.json"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#202124}h1{color:#1a73e8}</style></head><body><h1>Privacy Policy</h1><p>EmmieTech Global respects your privacy. We collect your name, email, phone, and skills to match you with employers.</p><p>We use cookies for login sessions. We never sell your data. Payment data is handled by Stripe and Flutterwave.</p><p>We show Google ads. Google may use cookies to personalize ads. <a href="https://policies.google.com/technologies/ads">Learn more</a>.</p><p>Contact: ${ADMIN_EMAIL}</p><p><a href="/">Back to Login</a> | <a href="/public-jobs">View Jobs</a></p></body></html>
  `);
});

// ---------- AUTH PAGES ----------
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/jobs');
  res.send(`
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EmmieTech Global - Login</title>
<meta name="description" content="Login to EmmieTech Global to find high-paying jobs abroad with visa sponsorship">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1a73e8">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:400px;width:90%}h1{color:#1a73e8;margin:0 0 8px 0;font-size:24px}p{color:#5f6368;margin:0 0 24px 0}input{width:100%;padding:12px;border:1px solid #dadce0;border-radius:8px;margin:0 0 16px 0;font-size:16px;box-sizing:border-box}button{width:100%;background:#1a73e8;color:white;padding:12px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}button:hover{background:#1557b0}.toggle{color:#1a73e8;text-decoration:none;font-weight:600}.error{color:#d93025;margin:0 0 16px 0;font-size:14px}.footer{margin-top:24px;text-align:center;font-size:14px;color:#5f6368}.footer a{color:#1a73e8;text-decoration:none;margin:0 8px}</style>
</head><body><div class="card">
<h1>EmmieTech Global</h1><p>High-paying jobs abroad with visa sponsorship</p>
<div id="error" class="error"></div>
<form id="authForm">
<input type="text" id="firstName" placeholder="First Name" style="display:none">
<input type="text" id="lastName" placeholder="Last Name" style="display:none">
<input type="email" id="email" placeholder="Email" required>
<input type="tel" id="phone" placeholder="WhatsApp Number" style="display:none">
<input type="password" id="password" placeholder="Password" required>
<input type="text" id="skills" placeholder="Your Skills (e.g. Nurse, Driver)" style="display:none">
<input type="text" id="country" placeholder="Countries you want (e.g. Canada, UK)" style="display:none">
<button type="submit" id="submitBtn">Login</button>
</form>
<p style="margin-top:16px;">New here? <a href="#" class="toggle" id="toggleMode">Create free account</a></p>
<div class="footer"><a href="/public-jobs">Browse Jobs</a> | <a href="/about">About</a> | <a href="/privacy">Privacy</a></div>
</div>
<script>
let isLogin = true;
const form = document.getElementById('authForm');
const toggle = document.getElementById('toggleMode');
const submitBtn = document.getElementById('submitBtn');
const error = document.getElementById('error');
const fields = ['firstName','lastName','phone','skills','country'];

toggle.onclick = (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  submitBtn.textContent = isLogin ? 'Login' : 'Create Account';
  toggle.textContent = isLogin ? 'Create free account' : 'Back to login';
  fields.forEach(id => document.getElementById(id).style.display = isLogin ? 'none' : 'block');
  error.textContent = '';
};

form.onsubmit = async (e) => {
  e.preventDefault();
  error.textContent = '';
  const data = {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value
  };
  if (!isLogin) {
    data.firstName = document.getElementById('firstName').value;
    data.lastName = document.getElementById('lastName').value;
    data.phone = document.getElementById('phone').value;
    data.skills = document.getElementById('skills').value;
    data.country_interest = document.getElementById('country').value;
  }
  const url = isLogin ? '/api/login' : '/api/register';
  try {
    const res = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result = await res.json();
    if(result.success) window.location.href = '/jobs';
    else error.textContent = result.error;
  } catch(err) {
    error.textContent = 'Connection error. Please try again.';
  }
};

if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}
</script></body></html>
  `);
});

// ---------- JOBS DASHBOARD ----------
app.get('/jobs', requireLogin, async (req, res) => {
  try {
    const user = await pool.query('SELECT first_name, last_name FROM candidates WHERE id = $1', [req.session.userId]);
    res.send(`
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Jobs - EmmieTech Global</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1a73e8">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;color:#202124}.header{background:#1a73e8;color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}.header h1{margin:0;font-size:20px}.header-right{display:flex;align-items:center;gap:16px}.avatar{width:32px;height:32px;border-radius:50%;background:#34a853;display:flex;align-items:center;justify-content:center;color:white;font-weight:600}.container{max-width:1200px;margin:0 auto;padding:24px}.filters{display:flex;gap:12px;margin:0 0 24px 0;flex-wrap:wrap}.filter-btn{padding:8px 16px;border:1px solid #dadce0;background:white;border-radius:20px;cursor:pointer;font-size:14px}.filter-btn.active{background:#e8f0fe;border-color:#1a73e8;color:#1967d2;font-weight:600}.job-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}.job-card{background:white;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1);position:relative}.job-title{font-size:18px;font-weight:600;margin:0 0 8px 0;color:#1a73e8}.job-company{color:#5f6368;margin:0 0 12px 0;font-size:14px}.job-meta{display:flex;gap:12px;margin:0 0 12px 0;font-size:14px;color:#5f6368}.badge{background:#e8f0fe;color:#1967d2;padding:4px 12px;border-radius:16px;font-size:12px;font-weight:600}.visa-badge{background:#e6f4ea;color:#137333}.salary{font-weight:600;color:#202124;margin:0 0 12px 0}.job-desc{color:#5f6368;font-size:14px;line-height:1.5;margin:0 0 16px 0}.btn-apply{width:100%;background:#1a73e8;color:white;padding:12px;border:none;border-radius:8px;font-weight:600;cursor:pointer;text-decoration:none;display:block;text-align:center}.btn-apply:hover{background:#1557b0}.cv-banner{background:linear-gradient(135deg,#1a73e8 0%,#1557b0 100%);color:white;padding:24px;border-radius:16px;margin:0 0 24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}.cv-banner h2{margin:0 0 8px 0;font-size:20px}.cv-banner p{margin:0;opacity:0.9}.cv-btn{background:white;color:#1a73e8;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;white-space:nowrap}.logout{color:white;text-decoration:none;font-size:14px}.empty{text-align:center;padding:60px 20px;color:#5f6368}.footer{text-align:center;padding:40px 24px;color:#5f6368;font-size:14px}.footer a{color:#1a73e8;text-decoration:none;margin:0 8px}</style>
</head><body>
<div class="header"><h1>EmmieTech Global</h1><div class="header-right"><span>Hi, ${user.rows[0].first_name}</span><div class="avatar">${user.rows[0].first_name[0]}</div><a href="/logout" class="logout">Logout</a></div></div>
<div class="container">
<div class="cv-banner"><div><h2>🚀 Get Hired 3x Faster</h2><p>Professional CV rewrite for any job. ATS-optimized. 48hr delivery.</p></div><a href="#" class="cv-btn" id="cvBtn">Get My CV - $30</a></div>
<div class="filters" id="filters"><button class="filter-btn active" data-country="all">All Countries</button><button class="filter-btn" data-country="Canada">Canada</button><button class="filter-btn" data-country="UK">UK</button><button class="filter-btn" data-country="UAE">UAE</button><button class="filter-btn" data-country="USA">USA</button><button class="filter-btn" data-country="Germany">Germany</button></div>
<div class="job-grid" id="jobGrid"><div class="empty">Loading jobs...</div></div>
</div>
<div class="footer"><a href="/public-jobs">Public Jobs</a> | <a href="/about">About</a> | <a href="/privacy">Privacy</a> | © 2026 EmmieTech Global</div>
<script>
let allJobs = [];
let currentFilter = 'all';

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    allJobs = data.jobs;
    renderJobs();
    if(data.userCountry && data.userCountry !== 'Uganda') {
      document.querySelector(\`[data-country="\${data.userCountry}"]\`)?.click();
    }
  } catch(e) {
    document.getElementById('jobGrid').innerHTML = '<div class="empty">Failed to load jobs. Please refresh.</div>';
  }
}

function renderJobs() {
  const grid = document.getElementById('jobGrid');
  const filtered = currentFilter === 'all' ? allJobs : allJobs.filter(j => j.country === currentFilter);
  if(filtered.length === 0) {
    grid.innerHTML = '<div class="empty">No jobs found for this country yet. Check back soon!</div>';
    return;
  }
  grid.innerHTML = filtered.map(job => \`
    <div class="job-card">
      <div class="job-title">\${job.title}</div>
      <div class="job-company">\${job.company}</div>
      <div class="job-meta">
        <span>📍 \${job.country}</span>
        \${job.visa_sponsorship ? '<span class="badge visa-badge">Visa Sponsorship</span>' : ''}
      </div>
      <div class="salary">\${job.salary_range || 'Competitive Salary'}</div>
      <div class="job-desc">\${job.description || 'Exciting opportunity abroad. Apply now!'}</div>
      <a href="/cv-service?job=\${encodeURIComponent(job.title)}" class="btn-apply">Apply + Get CV Help</a>
    </div>
  \`).join('');
}

document.getElementById('filters').onclick = (e) => {
  if(e.target.classList.contains('filter-btn')) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.country;
    renderJobs();
  }
};

document.getElementById('cvBtn').onclick = (e) => {
  e.preventDefault();
  window.location.href = '/cv-service?job=General%20Application';
};

loadJobs();
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}
</script></body></html>
    `);
  } catch (err) {
    res.status(500).send('Error loading dashboard');
  }
});

// ---------- CV SERVICE PAGE ----------
app.get('/cv-service', requireLogin, async (req, res) => {
  try {
    const jobTitle = req.query.job || 'Your Dream Job';
    const user = await pool.query('SELECT email FROM candidates WHERE id = $1', [req.session.userId]);
    res.send(`
<!DOCTYPE html><html><head><title>Professional CV Service - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1a73e8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa}.header{background:#1a73e8;color:white;padding:16px 24px}.header h1{margin:0;font-size:20px}.container{max-width:600px;margin:40px auto;padding:0 20px}.card{background:white;padding:32px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1)}h2{color:#1a73e8;margin:0 0 8px 0}.subtitle{color:#5f6368;margin:0 0 24px 0}ul{padding-left:20px;color:#5f6368;line-height:1.8}li{margin:0 0 8px 0}.price{font-size:32px;font-weight:700;color:#202124;margin:24px 0 8px 0}.price-note{color:#5f6368;font-size:14px;margin:0 0 24px 0}.btn{width:100%;background:#1a73e8;color:white;padding:16px;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin:0 0 12px 0}.btn:hover{background:#1557b0}.btn-flutterwave{background:#f5a623}.btn-flutterwave:hover{background:#e0950f}.guarantee{text-align:center;color:#137333;font-size:14px;font-weight:600;margin:16px 0 0 0}.back{display:inline-block;margin:24px 0 0 0;color:#1a73e8;text-decoration:none}</style>
</head><body>
<div class="header"><h1>EmmieTech Global</h1></div>
<div class="container"><div class="card">
<h2>Professional CV Rewrite</h2>
<p class="subtitle">Tailored for: <b>${jobTitle}</b></p>
<ul>
<li>✓ ATS-optimized to pass robot filters</li>
<li>✓ Written by HR experts for ${jobTitle} roles</li>
<li>✓ 48-hour delivery to your email</li>
<li>✓ Unlimited revisions for 7 days</li>
<li>✓ LinkedIn profile optimization tips included</li>
</ul>
<div class="price">USD $30 <span style="font-size:16px;font-weight:400;color:#5f6368;">or UGX 114,000</span></div>
<p class="price-note">One-time payment. No subscriptions.</p>
<button class="btn" id="payStripe">Pay with Card - $30</button>
<button class="btn btn-flutterwave" id="payFlutterwave">Pay with Mobile Money/Card - UGX 114,000</button>
<p class="guarantee">✓ 100% Money-back guarantee if not satisfied</p>
<a href="/jobs" class="back">← Back to Jobs</a>
</div></div>
<script>
document.getElementById('payStripe').onclick = async () => {
  const btn = document.getElementById('payStripe');
  btn.disabled = true; btn.textContent = 'Processing...';
  try {
    const res = await fetch('/api/create-checkout-session', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobTitle:'${jobTitle}',userEmail:'${user.rows[0].email}'})});
    const data = await res.json();
    if(data.url) window.location.href = data.url; else throw new Error('Failed');
  } catch(err) { alert('Payment error. Please try again.'); btn.disabled = false; btn.textContent = 'Pay with Card - $30'; }
};

document.getElementById('payFlutterwave').onclick = async () => {
  const btn = document.getElementById('payFlutterwave');
  btn.disabled = true; btn.textContent = 'Processing...';
  try {
    const res = await fetch('/api/flutterwave-pay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobTitle:'${jobTitle}',userEmail:'${user.rows[0].email}'})});
    const data = await res.json();
    if(data.link){window.location.href=data.link}else{alert('Payment error. Please try again.');btn.disabled=false;btn.textContent='Pay with Mobile Money/Card - UGX 114,000'}
  }catch(err){alert('Error: '+err.message);btn.disabled=false;btn.textContent='Pay with Mobile Money/Card - UGX 114,000'}
}
</script></body></html>
    `);
  } catch (err) {
    res.status(500).send('Error loading page');
  }
});

// ---------- PAYMENT APIs ----------
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
  const { jobTitle, userEmail } = req.body;
  try {
    if (!process.env.FLUTTERWAVE_SECRET_KEY) {
      return res.status(500).json({ error: 'Flutterwave not configured' });
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

    const response = await axios.post("https://api.flutterwave.com/v3/payments", payload, {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (response.data.status === "success") {
      await pool.query(
        `INSERT INTO cv_orders (user_id, user_email, user_name, user_phone, job_title, flutterwave_tx_ref, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [req.session.userId, userEmail, `${userData.first_name} ${userData.last_name}`, userData.phone, jobTitle, txRef, CV_PRICE_UGX]
      );
      res.json({ link: response.data.data.link });
    } else {
      res.status(400).json({ error: response.data.message || 'Flutterwave payment init failed' });
    }
  } catch (err) {
    console.error('Flutterwave error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Payment error. Please try again.' });
  }
});

// ---------- STRIPE WEBHOOK - AUTO CONFIRM PAYMENT ----------
app.post('/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, jobTitle, userName, userPhone } = session.metadata;

    await pool.query(`UPDATE cv_orders SET status = 'paid' WHERE stripe_session_id = $1`, [session.id]);

    await sendEmail(ADMIN_EMAIL, `🔥 Stripe: $30 from ${userName}`, `
      <h2>New CV Service Order - $30 Paid via Stripe</h2>
      <p><b>Customer:</b> ${userName}</p>
      <p><b>Email:</b> ${session.customer_email}</p>
      <p><b>WhatsApp:</b> <a href="https://wa.me/${userPhone.replace(/[^0-9]/g,'')}">${userPhone}</a></p>
      <p><b>Job Target:</b> ${jobTitle}</p>
      <p><b>Session:</b> ${session.id}</p>
      <p><b>Action:</b> Contact customer within 24hrs to get their old CV. Deliver new CV in 48hrs.</p>
    `);

    await sendEmail(session.customer_email, `Payment Received - EmmieTech CV Service`, `
      <h2>Thank you for your order!</h2>
      <p>Hi ${userName},</p>
      <p>We've received your payment of $30 for the Professional CV Service.</p>
      <p><b>Job Target:</b> ${jobTitle}</p>
      <p><b>What happens next:</b></p>
      <ol>
        <li>Our HR expert will WhatsApp you within 24 hours on ${userPhone}</li>
        <li>Send us your current CV or work history</li>
        <li>We deliver your ATS-optimized CV in 48 hours</li>
        <li>Unlimited revisions for 7 days</li>
      </ol>
      <p>Questions? Reply to this email or WhatsApp us at ${YOUR_WHATSAPP}</p>
      <p>Best,<br>EmmieTech Global Team</p>
    `);
  }

  res.json({ received: true });
});

// ---------- FLUTTERWAVE WEBHOOK ----------
app.post('/flutterwave-webhook', async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!signature || signature!== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;

  if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
    const { tx_ref, amount, customer } = payload.data;
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
      <p><b>Action:</b> Contact customer within 24hrs to get their old CV. Deliver new CV in 48hrs.</p>
    `);

    await sendEmail(customer.email, `Payment Received - EmmieTech CV Service`, `
      <h2>Thank you for your order!</h2>
      <p>Hi ${userName},</p>
      <p>We've received your payment of UGX ${amount} for the Professional CV Service.</p>
      <p><b>Job Target:</b> ${jobTitle}</p>
      <p><b>What happens next:</b></p>
      <ol>
        <li>Our HR expert will WhatsApp you within 24 hours on ${userPhone}</li>
        <li>Send us your current CV or work history</li>
        <li>We deliver your ATS-optimized CV in 48 hours</li>
        <li>Unlimited revisions for 7 days</li>
      </ol>
      <p>Questions? Reply to this email or WhatsApp us at ${YOUR_WHATSAPP}</p>
      <p>Best,<br>EmmieTech Global Team</p>
    `);

    res.status(200).send('Webhook received');
  } else {
    res.status(200).send('Event not handled');
  }
});

// ---------- CV SUCCESS PAGE ----------
app.get('/cv-success', requireLogin, async (req, res) => {
  const { session_id, tx_ref, gateway } = req.query;
  let order;

  try {
    if (gateway === 'stripe' && session_id) {
      order = await pool.query(`SELECT * FROM cv_orders WHERE stripe_session_id = $1`, [session_id]);
    } else if (gateway === 'flutterwave' && tx_ref) {
      order = await pool.query(`SELECT * FROM cv_orders WHERE flutterwave_tx_ref = $1`, [tx_ref]);
    }

    res.send(`
<!DOCTYPE html><html><head><title>Payment Successful - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1a73e8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:0;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:500px;width:90%;text-align:center}.success-icon{width:64px;height:64px;background:#34a853;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px auto;color:white;font-size:32px}h1{color:#202124;margin:0 0 16px 0}p{color:#5f6368;line-height:1.6;margin:0 0 16px 0}.btn{background:#1a73e8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-top:16px}</style>
</head><body><div class="card">
<div class="success-icon">✓</div>
<h1>Payment Successful!</h1>
<p>Thank you for ordering our Professional CV Service.</p>
<p><b>Next steps:</b><br>1. Check your email for confirmation<br>2. We'll WhatsApp you within 24 hours<br>3. Get your new CV in 48 hours</p>
<p>Job Target: <b>${order?.rows[0]?.job_title || 'General Application'}</b></p>
<a href="/jobs" class="btn">Back to Jobs</a>
</div></body></html>
    `);
  } catch (err) {
    console.error('Success page error:', err);
    res.redirect('/jobs');
  }
});

// ---------- API ROUTES ----------
app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, skills, country_interest } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO candidates (first_name, last_name, email, phone, password_hash, skills, country_interest) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [firstName, lastName, email, phone, hash, skills, country_interest]
    );
    req.session.userId = result.rows[0].id;
    await sendEmail(ADMIN_EMAIL, `New Candidate: ${firstName} ${lastName}`, `New signup: ${email}, ${phone}, Skills: ${skills}, Wants: ${country_interest}`);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') res.json({ error: 'Email already registered' });
    else {
      console.error('Register error:', err);
      res.json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT id, password_hash FROM candidates WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.json({ error: 'Invalid email or password' });
    req.session.userId = result.rows[0].id;
    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.json({ error: 'Login failed' });
  }
});

app.get('/api/jobs', requireLogin, async (req, res) => {
  try {
    const jobs = await pool.query(`SELECT * FROM agency_jobs WHERE status = 'active' ORDER BY created_at DESC`);
    const country = await getUserCountry(req);
    res.json({ jobs: jobs.rows, userCountry: country });
  } catch (err) {
    console.error('Jobs API error:', err);
    res.json({ jobs: [], userCountry: 'Uganda' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- ADMIN DASHBOARD ----------
app.get('/admin', async (req, res) => {
  try {
    // Add real auth here later - check if admin
    const orders = await pool.query(`SELECT * FROM cv_orders ORDER BY created_at DESC LIMIT 50`);
    const jobs = await pool.query(`SELECT * FROM agency_jobs ORDER BY created_at DESC`);
    const candidates = await pool.query(`SELECT COUNT(*) FROM candidates`);

    res.send(`
<!DOCTYPE html><html><head><title>Admin - EmmieTech</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;margin:0;padding:20px;background:#f8f9fa}h1{color:#1a73e8}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:0 0 32px 0}.stat{background:white;padding:20px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}.stat h3{margin:0 0 8px 0;color:#5f6368;font-size:14px}.stat p{margin:0;font-size:24px;font-weight:700;color:#202124}table{width:100%;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border-collapse:collapse;margin:0 0 32px 0}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #f1f3f4}th{background:#f8f9fa;font-weight:600;color:#5f6368;font-size:12px}td{font-size:14px}.status-paid{color:#137333;font-weight:600}.status-pending{color:#ea8600;font-weight:600}input,textarea,select{width:100%;padding:8px;border:1px solid #dadce0;border-radius:6px;margin:4px 0 12px 0;box-sizing:border-box}button{background:#1a73e8;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-weight:600}button:hover{background:#1557b0}</style>
</head><body>
<h1>EmmieTech Admin</h1>
<div class="stats">
  <div class="stat"><h3>Total Candidates</h3><p>${candidates.rows[0].count}</p></div>
  <div class="stat"><h3>Active Jobs</h3><p>${jobs.rows.filter(j=>j.status==='active').length}</p></div>
  <div class="stat"><h3>CV Orders</h3><p>${orders.rows.length}</p></div>
  <div class="stat"><h3>Revenue</h3><p>$${(orders.rows.filter(o=>o.status==='paid' && o.amount===3000).length * 30) + (orders.rows.filter(o=>o.status==='paid' && o.amount===114000).length * 30)}</p></div>
</div>

<h2>CV Orders</h2>
<table><tr><th>Date</th><th>Customer</th><th>Email</th><th>Phone</th><th>Job</th><th>Amount</th><th>Status</th></tr>
${orders.rows.map(o=>`<tr><td>${new Date(o.created_at).toLocaleDateString()}</td><td>${o.user_name}</td><td>${o.user_email}</td><td><a href="https://wa.me/${o.user_phone?.replace(/[^0-9]/g,'')}">${o.user_phone}</a></td><td>${o.job_title}</td><td>${o.amount===3000?'$30':'UGX 114,000'}</td><td class="status-${o.status}">${o.status.toUpperCase()}</td></tr>`).join('')}
</table>

<h2>Add New Job</h2>
<form method="POST" action="/admin/add-job" style="background:white;padding:24px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px">
<input name="title" placeholder="Job Title" required>
<input name="company" placeholder="Company Name" required>
<select name="country" required><option value="">Select Country</option><option>Canada</option><option>UK</option><option>UAE</option><option>USA</option><option>Germany</option><option>Australia</option></select>
<input name="salary_range" placeholder="Salary Range (e.g. $50,000 - $70,000)">
<label><input type="checkbox" name="visa_sponsorship" value="true"> Visa Sponsorship Available</label>
<textarea name="description" placeholder="Job Description" rows="4"></textarea>
<button type="submit">Post Job</button>
</form>
</body></html>
    `);
  } catch (err) {
    res.status(500).send('Admin error');
  }
});

app.post('/admin/add-job', async (req, res) => {
  try {
    const { title, company, country, salary_range, description, visa_sponsorship } = req.body;
    await pool.query(
      `INSERT INTO agency_jobs (title, company, country, salary_range, description, visa_sponsorship) VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, company, country, salary_range, description, visa_sponsorship === 'true']
    );
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Failed to add job');
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`EmmieTech running on port ${PORT}`);
});
