const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const aiRoutes = require('./routes/ai');
const moderationRoutes = require('./routes/moderation');
const walletRoutes = require('./routes/ownerWallets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1', moderationRoutes);
app.use('/api/v1', walletRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.get('/', (req, res) => res.send('CipherChat Backend is Running!'));
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CipherChat Server running on port ${PORT}`));
