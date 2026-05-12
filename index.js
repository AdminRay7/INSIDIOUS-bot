const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// MongoDB connection (optional - remove if not using)
// mongoose.connect('your-mongodb-url').catch(console.error);

let conn = null;
let pairingRequests = new Map();

// Initialize WhatsApp bot
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    conn = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari'),
    });
    
    conn.ev.on('creds.update', saveCreds);
    
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ INSIDIOUS bot is connected and ready!');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting...');
                setTimeout(startBot, 5000);
            }
        }
    });
    
    return conn;
}

// PAIRING API ENDPOINT - This is what your website calls
app.get('/api/pair', async (req, res) => {
    const { number, name } = req.query;
    
    console.log(`📱 Pairing request for: ${number}, Name: ${name}`);
    
    if (!number) {
        return res.json({ success: false, error: 'Phone number required!' });
    }
    
    try {
        if (!conn) {
            return res.json({ success: false, error: 'Bot is starting. Wait 10 seconds and try again.' });
        }
        
        // Clean phone number (remove any non-digits)
        const cleanNumber = number.replace(/[^0-9]/g, '');
        
        // Generate REAL WhatsApp pairing code
        const pairingCode = await conn.requestPairingCode(cleanNumber);
        
        console.log(`✅ Generated code ${pairingCode} for ${cleanNumber}`);
        
        // Store the pairing request
        pairingRequests.set(cleanNumber, {
            code: pairingCode,
            name: name || 'Anonymous',
            time: Date.now()
        });
        
        res.json({ 
            success: true, 
            code: pairingCode,
            message: 'Pairing code generated successfully!'
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.json({ 
            success: false, 
            error: error.message || 'Failed to generate pairing code' 
        });
    }
});

// Stats endpoint for your website
app.get('/api/stats', async (req, res) => {
    res.json({ 
        users: pairingRequests.size,
        activeUsers: conn ? 1 : 0,
        groups: 0,
        status: conn ? 'online' : 'offline'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: conn ? 'connected' : 'connecting',
        pairingRequests: pairingRequests.size
    });
});

// Start the bot and server
startBot().then(() => {
    console.log('🤖 INSIDIOUS bot is running!');
}).catch(err => {
    console.error('Failed to start bot:', err);
});

app.listen(PORT, () => {
    console.log(`🌐 API server running on port ${PORT}`);
    console.log(`📡 Pairing endpoint: http://localhost:${PORT}/api/pair`);
});
