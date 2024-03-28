require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const path = require('path'); // Import path module

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// SQL Server connection configuration
const config = {
    user: process.env.DATABASE_USER, // Update with your RDS username
    password: process.env.DATABASE_PASSWORD, // Update with your RDS password
    server: process.env.DATABASE_SERVER, // Update with your RDS endpoint
    database: process.env.DATABASE, // Ensure this is your database name on RDS
    options: {
        encrypt: true, // Required for Azure, might be optional for AWS depending on your setup
        trustServerCertificate: true // Change based on your SSL configuration
    }
};

// Connect to SQL Server
const poolPromise = sql.connect(config)
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Failed to connect to SQL Server:', err);
    });


    app.post('/register', async (req, res) => {
        try {
            const { name, item, amount, notes } = req.body;
            const pool = await poolPromise;
            const result = await pool.request()
                .input('name', sql.VarChar, name)
                .input('item', sql.VarChar, item)
                .input('amount', sql.Int, amount)
                .input('notes', sql.VarChar, notes)
                .execute('spRegisterItem');
    
            // Check the output of the stored procedure
            const output = result.recordset[0] || {};
    
            // Use the 'success' flag from the stored procedure to determine the response
            if (output.success === 1) { // Ensure 'success' is interpreted correctly (1 for true, 0 for false)
                res.json({ success: true, message: 'Registration successful' });
            } else {
                res.json({ success: false, message: output.message || 'Limit exceeded for this category. Contact Nadia for assistance.' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    });

    app.get('/progress', async (req, res) => {
        try {
            const pool = await poolPromise;
            const result = await pool.request().query(`
            SELECT cl.Item, COALESCE(SUM(c.Amount), 0) AS TotalAmount, cl.Limit
            FROM CategoryLimits cl
            LEFT JOIN Clothing c ON cl.Item = c.Item
            GROUP BY cl.Item, cl.Limit
        `);
            res.json({ success: true, data: result.recordset });
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    });

// app.get('/progress', async (req, res) => {
//     try {
//         const pool = await poolPromise;
//         const result = await pool.request().query(`
//         SELECT c.Item, SUM(c.Amount) AS TotalAmount, cl.Limit
//         FROM Clothing c
//         JOIN CategoryLimits cl ON c.Item = cl.Item
//         GROUP BY c.Item, cl.Limit
//     `);
//         res.json({ success: true, data: result.recordset });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Server error');
//     }
// });

app.get('/categories', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT Item, Limit FROM CategoryLimits');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

if (process.env.NODE_ENV === 'production') {
    // Set static folder
    app.use(express.static(path.join(__dirname, '../baby-shower-clothes-registration/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../baby-shower-clothes-registration/build', 'index.html'));
    });
}


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
