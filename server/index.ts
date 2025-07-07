import express, { Request, Response } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';

interface FormidableRequest extends Request {
  fields?: formidable.Fields;
  files?: formidable.Files;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
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
      const msg = `The CORS policy does not allow access from: ${origin}`;
      console.error(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.post('/api/send-email', async (req: FormidableRequest, res: Response): Promise<void> => {
  let fileToCleanUp: formidable.File | null = null;

  try {
    const data = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      const uploadDir = './temp_uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }

      const form = formidable({
        multiples: false,
        maxFileSize: 10 * 1024 * 1024,
        uploadDir: uploadDir,
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) {
          if (err.code === formidable.errors.biggerThanMaxFileSize) {
            reject({ status: 400, message: 'File is too large (max 10MB)', error: err.message });
          } else {
            reject({ status: 500, message: 'Form parsing error', error: err.message });
          }
        }
        resolve({ fields, files });
      });
    });

    const name = Array.isArray(data.fields.name) ? data.fields.name[0] : String(data.fields.name || '');
    const email = Array.isArray(data.fields.email) ? data.fields.email[0] : String(data.fields.email || '');
    const message = Array.isArray(data.fields.message) ? data.fields.message[0] : String(data.fields.message || '');
    const hcaptchaToken = Array.isArray(data.fields.hcaptchaToken) ? data.fields.hcaptchaToken[0] : String(data.fields.hcaptchaToken || '');

    const file = Array.isArray(data.files.file)
      ? data.files.file[0]
      : (data.files.file !== undefined ? data.files.file as formidable.File : null);

    fileToCleanUp = file;

    if (!name || !email || !message) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
        fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (!hcaptchaToken) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
        fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(400).json({ message: 'Missing hCaptcha token' });
      return;
    }

    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
    if (!HCAPTCHA_SECRET_KEY) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
        fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(500).json({ message: 'hCaptcha secret not configured' });
      return;
    }

    try {
      const hcaptchaVerifyResponse = await axios.post<HCaptchaVerifyResponse>('https://hcaptcha.com/siteverify', null, {
        params: {
          secret: HCAPTCHA_SECRET_KEY,
          response: hcaptchaToken,
          remoteip: req.ip
        }
      });

      if (!hcaptchaVerifyResponse.data.success) {
        if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath);
        }
        res.status(401).json({ message: 'hCaptcha verification failed', errorCodes: hcaptchaVerifyResponse.data['error-codes'] });
        return;
      }
    } catch (err) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
        fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(500).json({ message: 'Error verifying hCaptcha' });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const attachments = [];
    if (file) {
      try {
        const filePath = file.filepath;
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath);
          attachments.push({
            filename: file.originalFilename || 'attachment',
            content: fileContent,
            contentType: file.mimetype || 'application/octet-stream',
          });
        }
      } catch (err) {
        res.status(500).json({ message: 'Error reading file', error: (err as Error).message });
        return;
      }
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'tecnolife46@gmail.com',
      replyTo: email,
      subject: `Nuova richiesta da ${name} - PrintMaster 3D`,
      html: `
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Messaggio:</strong></p>
        <p>${message}</p>
      `,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully' });

  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'message' in error
    ) {
      const errObj = error as { status: number; message: string; error?: string };
      res.status(errObj.status).json({ message: errObj.message, error: errObj.error });
    } else if (error instanceof Error) {
      res.status(500).json({ message: 'Unhandled error', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error' });
    }
  } finally {
    if (fileToCleanUp && fileToCleanUp.filepath && fs.existsSync(fileToCleanUp.filepath)) {
      fs.unlink(fileToCleanUp.filepath, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});
