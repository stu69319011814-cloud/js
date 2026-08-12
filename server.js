const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); // รองรับการต่อข้าม IP/Domain

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
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

// เก็บรายชื่อผู้ใช้ออนไลน์ { socketId: username }
const users = {};

function broadcastOnlineUsers() {
  const onlineList = Object.values(users);
  io.emit('online-users', onlineList);
}

io.on('connection', (socket) => {
  // เมื่อเข้าสู่ระบบด้วยชื่อเล่น
  socket.on('register', (username) => {
    socket.username = username;
    users[socket.id] = username;
    broadcastOnlineUsers(); // แจ้งเตือนทุกคนว่ามีคนออนไลน์เพิ่ม
  });

  // ส่งข้อความกลุ่ม
  socket.on('send-group', (data) => {
    io.emit('receive-message', { ...data, type: 'group' });
  });

  // ส่งข้อความเดี่ยว
  socket.on('send-private', (data) => {
    // หา Socket ID ของผู้รับตามชื่อ
    const targetSocketId = Object.keys(users).find(id => users[id] === data.target);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-message', { ...data, type: 'private' });
      // ส่งหาตัวเองด้วยเพื่อให้ขึ้นในหน้าจอ
      socket.emit('receive-message', { ...data, type: 'private' });
    }
  });

  // เมื่อผู้ใช้ตัดการเชื่อมต่อ
  socket.on('disconnect', () => {
    delete users[socket.id];
    broadcastOnlineUsers();
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
