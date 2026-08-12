const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const os = require('os'); // เรียกใช้งานระบบ Network ของเครื่อง

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ฟังก์ชันหาเลข IP วงแลนปัจจุบันของเครื่อง Server
function getServerIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // ค้นหา IPv4 ที่ไม่ใช่ internal (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// สร้าง API ส่งค่า IP ให้หน้าเว็บ
app.get('/api/server-ip', (req, res) => {
  res.json({ ip: getServerIp() });
});

// ตั้งค่าอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ fileUrl: `/uploads/${req.file.filename}`, fileName: req.file.originalname });
});

const users = {};

function broadcastOnlineUsers() {
  const onlineList = Object.values(users);
  io.emit('online-users', onlineList);
}

io.on('connection', (socket) => {
  socket.on('register', (username) => {
    socket.username = username;
    users[socket.id] = username;
    broadcastOnlineUsers();
  });

  socket.on('send-group', (data) => {
    io.emit('receive-message', { ...data, type: 'group' });
  });

  socket.on('send-private', (data) => {
    const targetSocketId = Object.keys(users).find(id => users[id] === data.target);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-message', { ...data, type: 'private' });
      socket.emit('receive-message', { ...data, type: 'private' });
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    broadcastOnlineUsers();
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Server IP: http://${getServerIp()}:${PORT}`);
});
