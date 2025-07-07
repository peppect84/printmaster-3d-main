// index.ts

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';

// INTERFACCE
interface FormidableRequest extends Request {
  fields?: formidable.Fields;
  files?: formidable.Files;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

const app = express();
const port = process.env.PORT || 10000;

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://printmaster3d.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`Origin not allowed: ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

const sendEmailHandler: RequestHandler = async (req: FormidableRequest, res: Response) => {
  let fileToCleanUp: formidable.File | null = null;

  try {
    const data: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
      const form = formidable({
        multiples: false,
        maxFileSize: 10 * 1024 * 1024,
        uploadDir: './temp_uploads',
        keepExtensions: true
      });

      if (!fs.existsSync('./temp_uploads')) fs.mkdirSync('./temp_uploads');

      form.parse(req, (err, fields, files) => {
        if (err) return reject({ status: 500, message: 'Errore parsing form', error: err.message });
        resolve({ fields, files });
      });
    });

    const name = String(data.fields.name || '');
    const email = String(data.fields.email || '');
    const message = String(data.fields.message || '');
    const hcaptchaToken = String(data.fields.hcaptchaToken || '');

    const file = data.files.file ? (Array.isArray(data.files.file) ? data.files.file[0] : data.files.file) : null;
    fileToCleanUp = file;

    if (!name || !email || !message) {
      if (fileToCleanUp?.filepath && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      return res.status(400).json({ message: 'Campi obbligatori mancanti' });
    }

    if (!hcaptchaToken) {
      if (fileToCleanUp?.filepath && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      return res.status(400).json({ message: 'Captcha mancante' });
    }

    // ✅ Verifica hCaptcha
    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
    if (!HCAPTCHA_SECRET_KEY) {
      return res.status(500).json({ message: 'hCaptcha non configurato correttamente' });
    }

    const hcaptchaVerifyResponse = await axios.post<HCaptchaVerifyResponse>(
      'https://hcaptcha.com/siteverify',
      new URLSearchParams({
        secret: HCAPTCHA_SECRET_KEY,
        response: hcaptchaToken,
        remoteip: req.ip || ''
      })
    );

    if (!hcaptchaVerifyResponse.data.success) {
      if (fileToCleanUp?.filepath && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      return res.status(401).json({ message: 'Verifica hCaptcha fallita', errorCodes: hcaptchaVerifyResponse.data['error-codes'] });
    }

    // 📧 Invio email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const attachments = file ? [{
      filename: file.originalFilename || 'allegato',
      content: fs.readFileSync(file.filepath),
      contentType: file.mimetype || 'application/octet-stream'
    }] : [];

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'tecnolife46@gmail.com',
      replyTo: email,
      subject: `Nuova richiesta da ${name} - PrintMaster 3D`,
      html: `<p><strong>Nome:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`,
      attachments: attachments
    });

    res.status(200).json({ message: 'Messaggio inviato con successo!' });

  } catch (error: any) {
    res.status(500).json({ message: 'Errore nel server', error: error.message });
  } finally {
    if (fileToCleanUp?.filepath && fs.existsSync(fileToCleanUp.filepath)) {
      fs.unlink(fileToCleanUp.filepath, err => {
        if (err) console.error('Errore cancellando il file:', err);
      });
    }
  }
};

app.post('/api/send-email', sendEmailHandler);

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
