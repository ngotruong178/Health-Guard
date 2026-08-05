const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

let healthStorage = {
    latest: {},
    history: {}
};

// ================= API CHO ESP32-S3 =================
app.post('/api/vitals', (req, res) => {
    const { user_id, heart_rate, spo2, temp, sys_bp, dia_bp, ai_status } = req.body;
    if (!user_id) return res.status(400).json({ error: "Thiếu user_id" });

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

    healthStorage.latest[user_id] = newRecord;
    if (!healthStorage.history[user_id]) healthStorage.history[user_id] = [];
    healthStorage.history[user_id].push(newRecord);

    if (healthStorage.history[user_id].length > 50) {
        healthStorage.history[user_id].shift();
    }

    res.status(200).json({ status: "success", message: "Đã nhận dữ liệu sinh hiệu" });
});

app.get('/api/vitals', (req, res) => {
    res.json(healthStorage);
});

// ================= API PHÂN TÍCH Y KHOA QUA GEMINI =================
// ================= API PHÂN TÍCH Y KHOA QUA GEMINI (FETCH TRỰC TIẾP) =================
app.post('/api/analyze-health', async (req, res) => {
    try {
        const { name, age, vitals } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "Chưa cấu hình GEMINI_API_KEY trên Render!" });
        }

        const systemPrompt = "Bạn là trợ lý y khoa AI tư vấn sức khỏe gia đình chuyên nghiệp. Hãy đưa ra nhận xét ngắn gọn (3-4 dòng) bằng tiếng Việt cho người dùng về các chỉ số sinh hiệu đo được, đồng thời đưa ra 2 lời khuyên hữu ích về ăn uống/nghỉ ngơi. Thân thiện, chu đáo.";
        const userPrompt = `Bệnh nhân: ${name || 'Thành viên'} (${age || 20} tuổi). Chỉ số hiện tại từ ESP32: Nhịp tim: ${vitals.heart_rate} bpm, SpO2: ${vitals.spo2}%, Thân nhiệt: ${vitals.temp}°C, Huyết áp: ${vitals.sys_bp}/${vitals.dia_bp} mmHg. Hãy phân tích.`;

        // Gọi trực tiếp REST API v1beta của Gemini
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: userPrompt }]
                    }
                ],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || "Lỗi từ Google Gemini API");
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể tải phản hồi từ Gemini. Vui lòng thử lại.";

        res.json({ result: aiText });

    } catch (error) {
        console.error("Lỗi Gemini backend:", error);
        res.status(500).json({ error: "Lỗi phân tích từ Gemini: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server HealthGuard đang chạy tại port ${PORT}`);
});