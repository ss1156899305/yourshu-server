const { MongoClient } = require('mongodb');

// MongoDB Atlas 连接字符串（免费版）
const uri = process.env.MONGODB_URI || "mongodb+srv://<username>:<password>@cluster0.mongodb.net/yourshu?retryWrites=true&w=majority";
const client = new MongoClient(uri);

let db;

async function connect() {
    try {
        await client.connect();
        db = client.db('yourshu');
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('MongoDB连接失败:', err);
    }
}

// 用户相关操作
async function addUser(userData) {
    const users = db.collection('users');
    await users.updateOne(
        { pluginId: userData.pluginId },
        { $set: { ...userData, lastSeen: new Date() } },
        { upsert: true }
    );
}

async function updateUserActivity(pluginId) {
    const users = db.collection('users');
    await users.updateOne(
        { pluginId },
        { $set: { lastSeen: new Date() } }
    );
}

async function removeUser(pluginId) {
    const users = db.collection('users');
    await users.updateOne(
        { pluginId },
        { $set: { isOnline: false, lastSeen: new Date() } }
    );
}

async function getOnlineUsers() {
    const users = db.collection('users');
    return await users.find({ 
        lastSeen: { 
            $gte: new Date(Date.now() - 5 * 60 * 1000) // 5分钟内活跃的用户
        }
    }).toArray();
}

// 广告相关操作
async function saveAd(adData) {
    const ads = db.collection('ads');
    await ads.insertOne({
        ...adData,
        createdAt: new Date()
    });
}

async function getActiveAds() {
    const ads = db.collection('ads');
    return await ads.find({
        createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内的广告
        }
    }).toArray();
}

// 插件配置相关操作
async function updatePluginConfig(config) {
    const configs = db.collection('configs');
    await configs.updateOne(
        { type: 'plugin_config' },
        { $set: { ...config, updatedAt: new Date() } },
        { upsert: true }
    );
}

async function getPluginConfig() {
    const configs = db.collection('configs');
    return await configs.findOne({ type: 'plugin_config' });
}

// 初始化连接
connect().catch(console.error);

module.exports = {
    addUser,
    updateUserActivity,
    removeUser,
    getOnlineUsers,
    saveAd,
    getActiveAds,
    updatePluginConfig,
    getPluginConfig
}; 