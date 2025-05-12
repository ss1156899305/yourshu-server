const express = require('express');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();

// 启用 CORS 和 JSON 解析
app.use(cors());
app.use(express.json());

// MongoDB 配置
const url = process.env.MONGODB_URI;
const dbName = 'yourshu';
let client;

async function connectDB() {
    try {
        if (!client) {
            client = await MongoClient.connect(url);
            console.log('Connected to MongoDB');
        }
        return client.db(dbName);
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        throw err;
    }
}

// 创建服务器
const server = require('http').createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 添加保活路由
app.get('/ping', (req, res) => {
    res.send('pong');
});

// 添加首页路由
app.get('/', (req, res) => {
    res.send('Yourshu Server is running');
});

// 数据库操作
const db = {
    async addUser(userData) {
        const db = await connectDB();
        await db.collection('users').updateOne(
            { pluginId: userData.pluginId },
            { $set: userData },
            { upsert: true }
        );
    },

    async updateUserActivity(pluginId) {
        const db = await connectDB();
        await db.collection('users').updateOne(
            { pluginId },
            { 
                $set: { 
                    lastSeen: new Date(),
                    isOnline: true
                }
            }
        );
    },

    async removeUser(pluginId) {
        const db = await connectDB();
        await db.collection('users').updateOne(
            { pluginId },
            { $set: { isOnline: false } }
        );
    },

    async getOnlineUsers() {
        const db = await connectDB();
        return await db.collection('users')
            .find({ isOnline: true })
            .toArray();
    },

    async saveAd(adData) {
        const db = await connectDB();
        await db.collection('ads').insertOne({
            ...adData,
            createdAt: new Date()
        });
    },

    async getActiveAds() {
        const db = await connectDB();
        return await db.collection('ads')
            .find()
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
    },

    async getPluginConfig() {
        const db = await connectDB();
        const config = await db.collection('configs')
            .findOne({ type: 'plugin' });
        return config || { type: 'plugin', enabled: true };
    }
};

// Socket.IO 事件处理
io.on('connection', async (socket) => {
    console.log('New plugin connected');

    socket.on('register', async (data) => {
        try {
            const { version, userAgent } = data;
            const pluginId = require('crypto')
                .createHash('md5')
                .update(socket.id + userAgent + Date.now().toString())
                .digest('hex');
            
            await db.addUser({
                pluginId,
                version,
                userAgent,
                lastSeen: new Date(),
                ip: socket.handshake.address,
                isOnline: true
            });
            
            console.log(`Plugin ${pluginId} registered`);

            const activeAds = await db.getActiveAds();
            socket.emit('adConfigs', activeAds);
            
            const pluginConfig = await db.getPluginConfig();
            socket.emit('pluginConfig', pluginConfig);

            socket.pluginId = pluginId;
        } catch (err) {
            console.error('Plugin registration failed:', err);
        }
    });

    socket.on('heartbeat', async () => {
        if (socket.pluginId) {
            try {
                await db.updateUserActivity(socket.pluginId);
            } catch (err) {
                console.error('Update activity failed:', err);
            }
        }
    });

    socket.on('disconnect', async () => {
        if (socket.pluginId) {
            try {
                await db.removeUser(socket.pluginId);
                console.log(`Plugin ${socket.pluginId} disconnected`);
            } catch (err) {
                console.error('Update disconnect status failed:', err);
            }
        }
    });
});

// API 路由
app.post('/api/broadcast', async (req, res) => {
    try {
        const { type, content } = req.body;
        const db = await connectDB();
        
        if (type === 'ad') {
            await db.collection('ads').insertOne({
                ...content,
                createdAt: new Date()
            });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Broadcast failed:', err);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// 获取统计信息
app.get('/api/stats', async (req, res) => {
    try {
        const onlineUsers = await db.getOnlineUsers();
        const activeAds = await db.getActiveAds();
        
        res.json({
            onlineUsers: onlineUsers.length,
            activeAds: activeAds.length
        });
    } catch (err) {
        console.error('Get stats failed:', err);
        res.status(500).json({ error: 'Get stats failed' });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// 导出 app 实例
module.exports = app; 