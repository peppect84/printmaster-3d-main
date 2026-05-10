import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const missingEnv = ['RESEND_API_KEY', 'HCAPTCHA_SECRET_KEY'].filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn('Missing required environment variables:', missingEnv.join(', '));
}

if (!process.env.RESEND_FROM_EMAIL && !process.env.RESEND_FROM_KEY && !process.env.EMAIL_USER) {
  console.warn('Resend from email is not configured. Set RESEND_FROM_EMAIL, RESEND_FROM_KEY or EMAIL_USER.');
}

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
  'https://www.printmaster3d.netlify.app',
  'https://printmaster3d.it', // Dominio senza www
  'https://www.printmaster3d.it', // AGGIUNTO: Dominio con www
  'https://printmaster-3d-main.onrender.com', // Se usi il server Render sullo stesso dominio
  'https://ptlicciardellog.netlify.app' // Nuovo dominio per l'invio email
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

    const resendApiKey = process.env.RESEND_API_KEY;
    
    // Logghiamo i valori originali per il debug
    console.log('DEBUG - Original Env Vars:', {
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      RESEND_FROM_KEY: process.env.RESEND_FROM_KEY,
      EMAIL_USER: process.env.EMAIL_USER
    });

    // Se RESEND_FROM_EMAIL non è configurato o è una gmail (che fallirebbe se non verificata), 
    // usiamo l'indirizzo di onboarding di Resend.
    let resendFromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_KEY || process.env.EMAIL_USER;
    
    // Forziamo onboarding@resend.dev se è gmail o se non è presente
    if (!resendFromEmail || resendFromEmail.toLowerCase().includes('gmail.com')) {
  console.error('Mittente non valido configurato');
  res.status(500).json({ message: 'Errore configurazione server: mittente non valido.' });
  return;
    }
    
    const emailRecipient = process.env.EMAIL_TO || 'tecnolife46@gmail.com';

    console.log('Resend config:', {
      hasApiKey: !!resendApiKey,
      resendFromEmail,
      emailRecipient,
    });

    if (!resendApiKey) {
      console.error('Resend API key is not configured.');
      res.status(500).json({ message: 'Server configuration error: RESEND_API_KEY not set.' });
      return;
    }

    const attachments = [] as Array<{ name: string; type?: string; data: string }>;
    if (file) {
      try {
          const filePath = file.filepath;
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found at ${filePath}`);
          }
          const fileContent = fs.readFileSync(filePath);
          attachments.push({
              name: file.originalFilename || 'attachment',
              type: file.mimetype || 'application/octet-stream',
              data: fileContent.toString('base64'),
          });
      } catch (readErr) {
          console.error('Error reading temporary file:', readErr);
          res.status(500).json({ message: 'Error processing attachment', error: (readErr as Error).message });
          return;
      }
    }

    const resendPayload = {
      from: resendFromEmail,
      to: [emailRecipient],
      subject: `Nuova richiesta da ${name} - PrintMaster 3D`,
      html: `
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Messaggio:</strong></p>
        <p>${message}</p>
      `,
      reply_to: email,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    try {
      await axios.post('https://api.resend.com/emails', resendPayload, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (sendError) {
      console.error('Errore durante l\'invio dell\'email con Resend:', sendError);
      let errorMessage = 'Unknown error';
      if (sendError instanceof Error) {
        errorMessage = sendError.message;
      }
      if (typeof sendError === 'object' && sendError !== null && 'response' in sendError) {
        const errorObj = sendError as { response?: { data?: unknown } };
        const response = errorObj.response;
        if (response && response.data) {
          errorMessage = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        }
      }
      res.status(500).json({ message: 'Error sending email', error: errorMessage });
      return;
    }

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
app.post('/api/send-email-pt', sendEmailHandler);

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});
