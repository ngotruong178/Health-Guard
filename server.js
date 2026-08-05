const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Phục vụ file giao diện tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Bộ nhớ lưu trữ tạm dữ liệu theo user_id
let healthStorage = {
    latest: {},
    history: {}
};

// ================= API CHO ESP32-S3 =================

// Endpoint nhận dữ liệu từ ESP32-S3
app.post('/api/vitals', (req, res) => {
    const { user_id, heart_rate, spo2, temp, sys_bp, dia_bp, ai_status } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: "Thiếu user_id" });
    }

    const now = new Date();
    const timestampStr = now.toLocaleTimeString('vi-VN') + " (" + 
      String(now.getDate()).padStart(2, '0') + "/" + String(now.getMonth() + 1).padStart(2, '0') + ")";

    const newRecord = {
        heart_rate: heart_rate || 75,
        spo2: spo2 || 98,
        temp: temp || 36.5,
        sys_bp: sys_bp || 120,
        dia_bp: dia_bp || 80,
        ai_status: ai_status || "Bình thường",
        timestamp: timestampStr
    };

    // Lưu dữ liệu mới nhất
    healthStorage.latest[user_id] = newRecord;

    // Lưu lịch sử
    if (!healthStorage.history[user_id]) {
        healthStorage.history[user_id] = [];
    }
    healthStorage.history[user_id].push(newRecord);

    // Giữ lại tối đa 50 bản ghi lịch sử gần nhất cho mỗi user
    if (healthStorage.history[user_id].length > 50) {
        healthStorage.history[user_id].shift();
    }

    console.log(`[ESP32 Sync] Cập nhật thành công cho User ID #${user_id}`);
    res.status(200).json({ status: "success", message: "Đã nhận dữ liệu sinh hiệu" });
});

// ================= API CHO WEB FRONTEND =================

// Endpoint để Web Frontend lấy dữ liệu hiện tại
app.get('/api/vitals', (req, res) => {
    res.json(healthStorage);
});

// Lấy API Key Gemini từ Server (để bảo mật Key không lộ ở client)
app.get('/api/config/gemini-key', (req, res) => {
    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server HealthGuard đang chạy tại port ${PORT}`);
});