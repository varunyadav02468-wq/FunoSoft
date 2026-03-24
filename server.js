const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Database Setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Email Transporter (Optional but preferred)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Change this to your email provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// API Endpoint
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
    }

    // Store in Database
    const query = `INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)`;
    db.run(query, [name, email, subject, message], function(err) {
        if (err) {
            console.error('Error storing data:', err.message);
            return res.status(500).json({ error: 'Failed to store message.' });
        }

        // Telegram Notification (Async)
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (botToken && chatId && chatId !== '<YOUR_CHAT_ID>') {
            const telegramMessage = `🚀 New FunoSoft Lead

👤 Name: ${name}
📧 Email: ${email}

📌 Subject:
${subject}

💬 Message:
${message}`;

            axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: telegramMessage
            })
            .then(response => {
                console.log('Telegram message sent:', response.data);
            })
            .catch(error => {
                console.error('Error sending Telegram message:', error.response ? error.response.data : error.message);
            });
        } else {
            console.log('Telegram notification skipped (bot token or chat ID missing/placeholder).');
        }

        res.status(200).json({ success: true, message: 'Your message has been sent successfully.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
