// Add this to your index.js - PAIRING API ENDPOINT
app.get('/api/pair', async (req, res) => {
    const { number, name } = req.query;
    
    if (!number) {
        return res.json({ success: false, error: 'Phone number required!' });
    }
    
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const pairingCode = await conn.requestPairingCode(cleanNumber);
        
        // Store in database
        await User.findOneAndUpdate(
            { jid: cleanNumber + '@s.whatsapp.net' },
            { 
                jid: cleanNumber + '@s.whatsapp.net',
                pairingCode: pairingCode,
                name: name || 'Anonymous',
                pairedAt: new Date()
            },
            { upsert: true }
        );
        
        res.json({ success: true, code: pairingCode });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const groupCount = await Group.countDocuments();
        res.json({ 
            users: userCount, 
            activeUsers: userCount,
            groups: groupCount 
        });
    } catch (error) {
        res.json({ users: 0, groups: 0 });
    }
});
