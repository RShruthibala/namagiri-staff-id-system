const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const session = require('express-session');

const app = express();
app.use(session({
    secret: process.env.SESSION_SECRET || 'namagiri-local-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000
    }
}));

const PORT = process.env.PORT || 3000;
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Authentication required"
    });
}

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://10.60.252.5:${PORT}`;


// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json({
  limit: '12mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '12mb'
}));





app.get('/', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.sendFile(__dirname + '/index.html');
    }

    res.sendFile(__dirname + '/login.html');
});

app.get('/index.html', (req, res) => {
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/');
    }

    res.sendFile(__dirname + '/index.html');
});

app.use(express.static(__dirname, { index: false }));
// ===============================
// POSTGRESQL DATABASE
// ===============================

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'namagiri_staff',
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT || 5432),
  ssl: process.env.PGHOST?.includes('supabase')
    ? { rejectUnauthorized: false }
    : undefined
});


// ===============================
// TEST DATABASE
// ===============================

app.get('/api/testdb', async (_req, res) => {

  try {

    const r = await pool.query(
      'SELECT NOW() AS now'
    );

    res.json({
      success: true,
      message: 'PostgreSQL connected successfully',
      time: r.rows[0].now
    });

  } catch (e) {

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: e.message
    });

  }

});


// ===============================
// GET STAFF FOR VERIFICATION
// ===============================

app.get('/api/qr/:employeeId', requireAuth, async (req, res) => {
  try {

    const r = await pool.query(

      `SELECT
        employee_id,
        name,
        designation,
        department,
        date_of_joining,
        blood_group,
        emergency_contact,
        phone,
        email,
        address,
        photo,
        status,
        created_at
      FROM staff
      WHERE employee_id = $1`,

      [req.params.employeeId]

    );


    if (!r.rows.length) {

      return res.status(404).json({

        success: false,

        message: 'Staff not found'

      });

    }


    res.json({

      success: true,

      staff: r.rows[0]

    });


  } catch (e) {

    console.error(
      'Staff verification error:',
      e
    );


    res.status(500).json({

      success: false,

      message: 'Database error',

      error: e.message

    });

  }

});


// ===============================
// SAVE / UPDATE STAFF
// ===============================

app.post('/api/staff', requireAuth, async (req, res) => {

  try {

    const b = req.body;


    const q = `

      INSERT INTO staff
      (
        employee_id,
        name,
        designation,
        department,
        date_of_joining,
        blood_group,
        emergency_contact,
        phone,
        email,
        address,
        photo,
        staff_signature,
        doctor_signature,
        status
      )

      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14
      )

      ON CONFLICT (employee_id)

      DO UPDATE SET

        name = EXCLUDED.name,

        designation = EXCLUDED.designation,

        department = EXCLUDED.department,

        date_of_joining = EXCLUDED.date_of_joining,

        blood_group = EXCLUDED.blood_group,

        emergency_contact = EXCLUDED.emergency_contact,

        phone = EXCLUDED.phone,

        email = EXCLUDED.email,

        address = EXCLUDED.address,

        photo = EXCLUDED.photo,

        staff_signature = EXCLUDED.staff_signature,

        doctor_signature = EXCLUDED.doctor_signature,

        status = EXCLUDED.status

      RETURNING *

    `;


    const v = [

      b.employee_id,

      b.name,

      b.designation,

      b.department,

      b.date_of_joining || null,

      b.blood_group || null,

      b.emergency_contact || null,

      b.phone || null,

      b.email || null,

      b.address || null,

      b.photo || null,

      b.staff_signature || null,

      b.doctor_signature || null,

      b.status || 'ACTIVE'

    ];


    const r = await pool.query(q, v);


    res.status(201).json({

      success: true,

      message: 'Staff record saved successfully',

      staff: r.rows[0]

    });


  } catch (e) {

    console.error(
      'Save staff error:',
      e
    );


    res.status(500).json({

      success: false,

      message: e.message

    });

  }

});


// ===============================
// GENERATE QR CODE
// ===============================

app.get('/api/qr/:employeeId', async (req, res) => {

  try {

    const employeeId =
      encodeURIComponent(
        req.params.employeeId
      );


    const url =
      `${PUBLIC_BASE_URL}/verify.html?id=${employeeId}`;


    const dataUrl =
      await QRCode.toDataURL(

        url,

        {
          width: 240,
          margin: 2
        }

      );


    res.json({

      success: true,

      url,

      dataUrl

    });


  } catch (e) {

    res.status(500).json({

      success: false,

      message: e.message

    });

  }

});


// ===============================
// VERIFY HTML PAGE
// ===============================

app.get('/verify.html', (_req, res) => {

  res.sendFile(
    __dirname + '/verify.html'
  );

});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (
        username === adminUsername &&
        password === adminPassword
    ) {
        req.session.authenticated = true;

        return res.json({
            success: true,
            message: 'Login successful'
        });
    }

    res.status(401).json({
        success: false,
        message: 'Invalid username or password'
    });
});
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
});
// ===============================
// START SERVER
// ===============================

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    '---------------------------------------'
  );

  console.log(
    'NAMAGIRI STAFF ID CARD SYSTEM'
  );

  console.log(
    `Server running at http://localhost:${PORT}`
  );

  console.log(
    `Verification base URL: ${PUBLIC_BASE_URL}`
  );

  console.log(
    '---------------------------------------'
  );

});