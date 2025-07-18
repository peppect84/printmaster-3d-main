import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';

// DEFINIZIONI INTERFACCE
interface FormidableRequest extends Request {
  fields?: formidable.Fields;
  files?: formidable.Files;
}

interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[]; // Opzionale, se ci sono codici di errore
}

const app = express();
const port = process.env.PORT || 10000;

// Configurazione CORS
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4000', // AGGIUNTO: Per lo sviluppo locale
  'http://localhost:4001',
  'https://printmaster3d.netlify.app', // Mantienilo se lo usi
  'https://printmaster3d.it', // Dominio senza www
  'https://www.printmaster3d.it' // AGGIUNTO: Dominio con www
];

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza 'origin' (es. da Postman o file locali)
    if (!origin) return callback(null, true); 
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      console.error(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const sendEmailHandler: RequestHandler = async (req: FormidableRequest, res: Response) => {
  let fileToCleanUp: formidable.File | null = null;

  try {
    const data: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
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
          console.error('Formidable parse error:', err);
          if (err.code === formidable.errors.biggerThanMaxFileSize) {
            return reject({ status: 400, message: 'File is too large (max 10MB)', error: err.message });
          } else {
            return reject({ status: 500, message: 'Error parsing form data', error: err.message });
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
      console.error('hCaptcha token is missing from the request.');
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(400).json({ message: 'hCaptcha token is missing. Please try again.' });
      return;
    }

    // VERIFICA HCAPTCHA
    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
    console.log('HCAPTCHA_SECRET_KEY exists:', !!HCAPTCHA_SECRET_KEY);
    console.log('hcaptchaToken received:', hcaptchaToken);

    if (!HCAPTCHA_SECRET_KEY) {
      console.error('HCAPTCHA_SECRET_KEY is not defined in environment variables');
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(500).json({ message: 'Server configuration error: HCAPTCHA_SECRET_KEY not set.' });
      return;
    }

    try {
      const hcaptchaVerifyResponse = await axios.post<HCaptchaVerifyResponse>(
        'https://hcaptcha.com/siteverify',
        new URLSearchParams({
          secret: HCAPTCHA_SECRET_KEY,
          response: hcaptchaToken,
          remoteip: req.ip || ''
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // CORREZIONE QUI: Assicurati che TypeScript riconosca il tipo dei dati
      const { success, 'error-codes': errorCodes } = hcaptchaVerifyResponse.data as HCaptchaVerifyResponse;

      if (!success) {
        console.error('hCaptcha verification failed:', errorCodes);
        if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
            fs.unlinkSync(fileToCleanUp.filepath);
        }
        res.status(401).json({ message: 'hCaptcha verification failed. Please try again.', errorCodes });
        return;
      }
    } catch (hcaptchaError) {
      console.error('Error during hCaptcha verification request:', hcaptchaError);
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath);
      }
      res.status(500).json({ message: 'Could not verify hCaptcha. Please try again later.' });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let attachments = [];
    if (file) {
      try {
          const filePath = file.filepath;
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
          }
          const fileContent = fs.readFileSync(filePath);
          attachments.push({
              filename: file.originalFilename || 'attachment',
              content: fileContent,
              contentType: file.mimetype || 'application/octet-stream',
          });
      } catch (readErr) {
          console.error('Error reading temporary file:', readErr);
          res.status(500).json({ message: 'Error processing attachment', error: (readErr as Error).message });
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
    res.status(200).json({ message: 'Email sent successfully!' });

  } catch (error: unknown) { 
    console.error('Errore generale nel server API:', error);
    if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        'message' in error
    ) {
        const errObj = error as { status: number; message: string; error?: string };
        res.status(errObj.status).json({ message: errObj.message, error: errObj.error });
    } else if (error instanceof Error) {
        res.status(500).json({ message: 'Error sending email', error: error.message });
    } else {
        res.status(500).json({ message: 'Error sending email', error: 'Unknown error' });
    }
  } finally {
    if (fileToCleanUp && fileToCleanUp.filepath && fs.existsSync(fileToCleanUp.filepath)) {
      fs.unlink(fileToCleanUp.filepath, (err) => {
        if (err) console.error('Errore durante l\'eliminazione del file temporaneo nel finally:', err);
      });
    }
  }
};

app.post('/api/send-email', sendEmailHandler);

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});