require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise"); // استخدام promise-based MySQL
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// ✅ إنشاء اتصال بقاعدة البيانات باستخدام promise
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "blood_bank",
};

let db;
const connectDB = async () => {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log("✅ متصل بقاعدة البيانات!");
  } catch (err) {
    console.error("❌ فشل الاتصال بقاعدة البيانات:", err);
    process.exit(1); // إنهاء التطبيق في حال فشل الاتصال
  }
};
connectDB();

// ✅ API لإضافة طلب جديد
app.post("/api/requests", async (req, res) => {
  try {
    const {
      patient_name, national_id, age, gender, blood_type, bags_needed, reason,
      hospital_name, branch, medical_report_url, relation, phone_number,
      delivery_method, address, payment_method
    } = req.body;

    const query = `
      INSERT INTO Requests (patient_name, national_id, age, gender, blood_type, bags_needed, reason,
      hospital_name, branch, medical_report_url, relation, phone_number, delivery_method, address, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
      patient_name, national_id, age, gender, blood_type, bags_needed, reason,
      hospital_name, branch, medical_report_url, relation, phone_number,
      delivery_method, address, payment_method
    ]);

    res.status(201).json({ message: "✅ تم إضافة الطلب بنجاح", requestId: result.insertId });
  } catch (err) {
    console.error("❌ خطأ أثناء إضافة الطلب:", err);
    res.status(500).json({ message: "فشل في حفظ الطلب", error: err.message });
  }
});

// ✅ API لجلب جميع الطلبات
app.get('/api/requests', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM Requests ORDER BY created_at DESC');
    if (results.length === 0) {
      return res.status(404).json({ message: 'لا توجد طلبات متاحة' });
    }
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الطلبات', error: err.message });
  }
});

// 🔍 API لجلب طلب معين عبر request_id
app.get("/api/requests/:id", async (req, res) => {
  try {
    const requestId = req.params.id;
    const [result] = await db.execute("SELECT * FROM Requests WHERE request_id = ?", [requestId]);
    
    if (result.length === 0) {
      return res.status(404).json({ message: "لم يتم العثور على الطلب" });
    }
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ", error: err.message });
  }
});

// ✅ إنشاء مجلد uploads تلقائيًا
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ✅ إعداد التخزين للملفات المرفوعة
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
});

// ✅ API لرفع التقارير الطبية
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'يرجى رفع ملف صالح' });
  }
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

// ✅ API لجلب الطلبات بناءً على userId
app.get('/api/requests/user', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'يجب توفير userId' });
    }
    const [results] = await db.execute("SELECT * FROM Requests WHERE user_id = ?", [userId]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ', error: err.message });
  }
});

// ✅ API لجلب الطلبات قيد المراجعة
app.get('/api/requests/pending', async (req, res) => {
  try {
    const [results] = await db.execute("SELECT * FROM Requests WHERE status = 'pending'");
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ', error: err.message });
  }
});

// ✅ API لتحديث حالة الطلب
app.put('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_status } = req.body;
    if (!['approved', 'rejected'].includes(user_status)) {
      return res.status(400).json({ message: 'الحالة يجب أن تكون approved أو rejected' });
    }
    await db.execute("UPDATE Requests SET user_status = ? WHERE request_id = ?", [user_status, id]);
    res.json({ message: `تم تحديث الطلب ${id} إلى الحالة ${user_status}` });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تحديث الطلب', error: err.message });
  }
});

// ✅ تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على: http://localhost:${PORT}`);
});
