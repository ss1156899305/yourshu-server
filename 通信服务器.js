const express = require('express');
const { Server } = require('socket.io');
const db = require('./数据库');
const app = express();

// 创建服务器
const server = require('http').createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 心跳检测间隔（30秒）
const HEARTBEAT_INTERVAL = 30000;

// 添加保活路由
app.get('/ping', (req, res) => {
    res.send('pong');
});

// 添加首页路由
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>有术助手服务器</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 40px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .status {
                        padding: 20px;
                        background: #f0f0f0;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>有术助手服务器</h1>
                    <div class="status">
                        <p>服务器状态: 运行中</p>
                        <p>启动时间: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
        </html>
    `);
});

io.on('connection', async (socket) => {
    console.log('新的插件连接');

    // 插件注册
    socket.on('register', async (data) => {
        try {
            const { version, userAgent } = data;
            const pluginId = generatePluginId(socket.id, userAgent);
            
            // 存储用户信息到数据库
            await db.addUser({
                pluginId,
                version,
                userAgent,
                lastSeen: new Date(),
                ip: socket.handshake.address,
                isOnline: true
            });
            
            console.log(`插件 ${pluginId} 已注册`);

            // 发送当前的广告配置
            const activeAds = await db.getActiveAds();
            socket.emit('adConfigs', activeAds);
            
            // 发送当前的插件配置
            const pluginConfig = await db.getPluginConfig();
            socket.emit('pluginConfig', pluginConfig);

            // 保存socket id和pluginId的映射关系
            socket.pluginId = pluginId;
        } catch (err) {
            console.error('插件注册失败:', err);
        }
    });

    // 更新活跃状态
    socket.on('heartbeat', async () => {
        if (socket.pluginId) {
            try {
                await db.updateUserActivity(socket.pluginId);
            } catch (err) {
                console.error('更新活跃状态失败:', err);
            }
        }
    });

    // 断开连接
    socket.on('disconnect', async () => {
        if (socket.pluginId) {
            try {
                await db.removeUser(socket.pluginId);
                console.log(`插件 ${socket.pluginId} 断开连接`);
            } catch (err) {
                console.error('更新断开状态失败:', err);
            }
        }
    });
});

// 生成唯一的插件ID
function generatePluginId(socketId, userAgent) {
    return require('crypto')
        .createHash('md5')
        .update(socketId + userAgent + Date.now().toString())
        .digest('hex');
}

// API 路由
app.post('/api/broadcast', express.json(), async (req, res) => {
    try {
        const { type, content } = req.body;
        
        if (type === 'ad') {
            // 存储广告到数据库
            await db.saveAd(content);
            // 获取所有活跃广告
            const activeAds = await db.getActiveAds();
            // 广播给所有客户端
            io.emit('adConfigs', activeAds);
        } else if (type === 'command') {
            // 广播命令
            io.emit('command', content);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('广播失败:', err);
        res.status(500).json({ error: '广播失败' });
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
        console.error('获取统计信息失败:', err);
        res.status(500).json({ error: '获取统计信息失败' });
    }
});

// 清理过期数据的定时任务
setInterval(async () => {
    try {
        const onlineUsers = await db.getOnlineUsers();
        console.log(`当前在线用户数: ${onlineUsers.length}`);
    } catch (err) {
        console.error('清理过期数据失败:', err);
    }
}, HEARTBEAT_INTERVAL);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`通信服务器运行在端口 ${PORT}`);
}); 