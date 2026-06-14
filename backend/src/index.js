require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const treesRoutes = require('./routes/trees');
const personsRoutes = require('./routes/persons');
const relationshipsRoutes = require('./routes/relationships');
const mediaRoutes = require('./routes/media');
const eventsRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');
const historyRoutes = require('./routes/history');
const memoryRoutes = require('./routes/memory');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/trees', treesRoutes);
app.use('/api/trees', personsRoutes);
app.use('/api/trees', relationshipsRoutes);
app.use('/api/trees', mediaRoutes);
app.use('/api/trees', eventsRoutes);
app.use('/api/trees', chatRoutes);
app.use('/api/trees', historyRoutes);
app.use('/api/trees', memoryRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

io.on('connection', (socket) => {
  socket.on('join-tree', (treeId) => socket.join(`tree:${treeId}`));
  socket.on('leave-tree', (treeId) => socket.leave(`tree:${treeId}`));
});

app.set('io', io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
