const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const session = require('express-session');

const app = express();


// =====================================================
// TRUST RENDER PROXY
// =====================================================

app.set('trust proxy', 1);


// =====================================================
// SESSION
// =====================================================

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


// =====================================================
// PORT
// =====================================================

const PORT = process.env.PORT || 3000;


// =====================================================
// PUBLIC BASE URL
// =====================================================

const PUBLIC_BASE_URL =
    process.env.PUBLIC_BASE_URL ||
    `http://localhost:${PORT}`;


// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function requireAuth(req, res, next) {

    if (req.session && req.session.authenticated) {

        return next();

    }

    return res.status(401).json({

        success: false,

        message: 'Authentication required'

    });

}


// =====================================================
// GENERAL MIDDLEWARE
// =====================================================

app.use(cors({

    origin: true,

    credentials: true

}));


app.use(express.json({

    limit: '12mb'

}));


app.use(express.urlencoded({

    extended: true,

    limit: '12mb'

}));


// =====================================================
// HOME PAGE
// =====================================================

app.get('/', (req, res) => {

    if (req.session && req.session.authenticated) {

        return res.sendFile(
            __dirname + '/index.html'
        );

    }

    res.sendFile(
        __dirname + '/login.html'
    );

});


// =====================================================
// INDEX PAGE
// =====================================================

app.get('/index.html', (req, res) => {

    if (!req.session || !req.session.authenticated) {

        return res.redirect('/');

    }

    res.sendFile(
        __dirname + '/index.html'
    );

});


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(__dirname, {
        index: false
    })
);


// =====================================================
// POSTGRESQL DATABASE
// =====================================================

const pool = new Pool({

    user: process.env.PGUSER || 'postgres',

    host: process.env.PGHOST || 'localhost',

    database:
        process.env.PGDATABASE ||
        'namagiri_staff',

    password:
        process.env.PGPASSWORD,

    port:
        Number(
            process.env.PGPORT || 5432
        ),

    ssl:
        process.env.PGHOST?.includes('supabase')
            ? { rejectUnauthorized: false }
            : undefined

});


// =====================================================
// TEST DATABASE
// =====================================================

app.get('/api/testdb', async (req, res) => {

    // Login required
    if (!req.session || !req.session.authenticated) {

        return res.status(401).json({

            success: false,

            message: 'Authentication required'

        });

    }

    try {

        const result = await pool.query(

            'SELECT NOW() AS now'

        );

        res.json({

            success: true,

            message:
                'PostgreSQL connected successfully',

            time:
                result.rows[0].now

        });

    }

    catch (error) {

        console.error(
            'Database connection error:',
            error
        );

        res.status(500).json({

            success: false,

            message:
                'Database connection failed',

            error:
                error.message

        });

    }

});


// =====================================================
// LOGIN
// =====================================================

app.post('/api/login', (req, res) => {

    const username =
        req.body.username;

    const password =
        req.body.password;


    const adminUsername =
        process.env.ADMIN_USERNAME;

    const adminPassword =
        process.env.ADMIN_PASSWORD;


    // Check username and password
    if (
        username === adminUsername &&
        password === adminPassword
    ) {

        // Create authenticated session
        req.session.authenticated = true;


        // IMPORTANT:
        // Save session before sending response
        req.session.save((error) => {

            if (error) {

                console.error(
                    'Session save error:',
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        'Login successful, but session could not be saved.'

                });

            }


            return res.json({

                success: true,

                message:
                    'Login successful'

            });

        });

        return;

    }


    // Invalid login
    return res.status(401).json({

        success: false,

        message:
            'Invalid username or password'

    });

});


// =====================================================
// LOGOUT
// =====================================================

app.post('/api/logout', (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            console.error(
                'Logout error:',
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    'Logout failed'

            });

        }


        res.clearCookie('connect.sid');


        res.json({

            success: true,

            message:
                'Logout successful'

        });

    });

});


// =====================================================
// SAVE / UPDATE STAFF
// =====================================================

app.post('/api/staff', requireAuth, async (req, res) => {

    try {

        const b = req.body;


        const query = `

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
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14
            )

            ON CONFLICT (employee_id)

            DO UPDATE SET

                name =
                    EXCLUDED.name,

                designation =
                    EXCLUDED.designation,

                department =
                    EXCLUDED.department,

                date_of_joining =
                    EXCLUDED.date_of_joining,

                blood_group =
                    EXCLUDED.blood_group,

                emergency_contact =
                    EXCLUDED.emergency_contact,

                phone =
                    EXCLUDED.phone,

                email =
                    EXCLUDED.email,

                address =
                    EXCLUDED.address,

                photo =
                    EXCLUDED.photo,

                staff_signature =
                    EXCLUDED.staff_signature,

                doctor_signature =
                    EXCLUDED.doctor_signature,

                status =
                    EXCLUDED.status

            RETURNING *

        `;


        const values = [

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


        const result =
            await pool.query(
                query,
                values
            );


        res.status(201).json({

            success: true,

            message:
                'Staff record saved successfully',

            staff:
                result.rows[0]

        });

    }

    catch (error) {

        console.error(
            'Save staff error:',
            error
        );


        res.status(500).json({

            success: false,

            message:
                error.message

        });

    }

});


// =====================================================
// GET STAFF FOR VERIFICATION
// PUBLIC ROUTE
// QR SCAN DOES NOT REQUIRE LOGIN
// =====================================================

app.get('/api/staff/:employeeId', async (req, res) => {

    try {

        const employeeId =
            req.params.employeeId;


        const result = await pool.query(

            `

            SELECT

                employee_id,
                name,
                designation,
                department,
                date_of_joining,
                blood_group,
                photo,
                status,
                created_at

            FROM staff

            WHERE employee_id = $1

            `,

            [employeeId]

        );


        if (!result.rows.length) {

            return res.status(404).json({

                success: false,

                message:
                    'Staff not found'

            });

        }


        res.json({

            success: true,

            staff:
                result.rows[0]

        });

    }

    catch (error) {

        console.error(

            'Staff verification error:',

            error

        );


        res.status(500).json({

            success: false,

            message:
                'Database error'

        });

    }

});


// =====================================================
// GENERATE QR CODE
// LOGIN REQUIRED
// =====================================================

app.get(
    '/api/qr/:employeeId',
    requireAuth,
    async (req, res) => {

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

                url: url,

                dataUrl: dataUrl

            });

        }

        catch (error) {

            console.error(
                'QR generation error:',
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// =====================================================
// VERIFY HTML PAGE
// PUBLIC
// =====================================================

app.get('/verify.html', (req, res) => {

    res.sendFile(

        __dirname +
        '/verify.html'

    );

});


// =====================================================
// START SERVER
// =====================================================

app.listen(

    PORT,

    '0.0.0.0',

    () => {

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

    }

);