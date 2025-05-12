const express = require('express');
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

// 添加保活路由
app.get('/ping', (req, res) => {
    res.send('pong');
});

// 添加首页路由
app.get('/', (req, res) => {
    res.send('Yourshu Server is running');
});

// 测试数据库连接
app.get('/api/test', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('test').findOne({});
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Database test failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// 获取统计信息
app.get('/api/stats', async (req, res) => {
    try {
        const db = await connectDB();
        const users = await db.collection('users').countDocuments();
        const ads = await db.collection('ads').countDocuments();
        
        res.json({
            users,
            ads
        });
    } catch (err) {
        console.error('Get stats failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Vercel 需要导出 app 实例
module.exports = app; 
