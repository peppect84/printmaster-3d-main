// server/index.ts
import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios'; // Importato per fare richieste HTTP

dotenv.config({ path: '../.env.local' });

const app = express();
const port = process.env.PORT || 5000;

// *** INIZIO MODIFICA CORS EFFETTUATA ***
const allowedOrigins = [
  'http://localhost:8080', // Per lo sviluppo locale se usi questa porta
  'http://localhost:5173', // Per lo sviluppo locale se usi questa porta Vite
  'https://printmaster3d.netlify.app' // Il tuo dominio Netlify reale
];

app.use(cors({
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. curl, postman, app native)
    if (!origin) return callback(null, true);
    // Permetti solo gli origin specificati
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      console.error(msg); // Logga questo errore per debug su Render
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// *** FINE MODIFICA CORS EFFETTUATA ***

interface FormidableRequest extends Request {
  fields?: formidable.Fields;
  files?: formidable.Files;
}

const sendEmailHandler: RequestHandler = async (req: FormidableRequest, res: Response) => {
  let fileToCleanUp: formidable.File | null = null; // Variabile per tenere traccia del file temporaneo da eliminare

  try {
    const data: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
      const uploadDir = './temp_uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }

      const form = formidable({
        multiples: false, // <-- CORRETTO: era 'multitudes', ora è 'multiples'
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
    // Recupera il token hCaptcha
    const hcaptchaToken = Array.isArray(data.fields.hcaptchaToken) ? data.fields.hcaptchaToken[0] : String(data.fields.hcaptchaToken || '');

    const file = Array.isArray(data.files.file)
                     ? data.files.file[0]
                     : (data.files.file !== undefined ? data.files.file as formidable.File : null);
    
    fileToCleanUp = file; // Imposta il file da pulire, se presente

    if (!name || !email || !message || !hcaptchaToken) { // Aggiunto controllo per hcaptchaToken
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath); // Elimina il file se la validazione iniziale fallisce
      }
      res.status(400).json({ message: 'Missing required fields or hCaptcha token' });
      return;
    }

    // --- INIZIO: Verifica hCaptcha ---
    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;

    if (!HCAPTCHA_SECRET_KEY) {
        console.error('HCAPTCHA_SECRET_KEY is not defined in environment variables.');
        if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
            fs.unlinkSync(fileToCleanUp.filepath);
        }
        res.status(500).json({ message: 'Server configuration error: HCAPTCHA_SECRET_KEY not set.' });
        return;
    }

    try {
        const hcaptchaVerifyResponse = await axios.post('https://hcaptcha.com/siteverify', null, {
            params: {
                secret: HCAPTCHA_SECRET_KEY,
                response: hcaptchaToken,
                remoteip: req.ip // L'indirizzo IP del client per una verifica più robusta
            }
        });

        const { success, 'error-codes': errorCodes } = hcaptchaVerifyResponse.data;

        if (!success) {
            console.error('hCaptcha verification failed:', errorCodes);
            if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
                fs.unlinkSync(fileToCleanUp.filepath);
            }
            // Reindirizza il messaggio d'errore del captcha al frontend per chiarezza
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
    // --- FINE: Verifica hCaptcha ---

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
          // Eliminazione del file temporaneo è gestita nel blocco finally
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

  } catch (error: any) { // Specifica il tipo 'any' per 'error' o crea un'interfaccia più specifica
    console.error('Errore generale nel server API:', error);
    // Gestione degli errori dalla Promise di formidable
    if (error.status && error.message) {
        res.status(error.status).json({ message: error.message, error: error.error });
    } else {
        res.status(500).json({ message: 'Error sending email', error: error.message || 'Unknown error' });
    }
  } finally {
    // Assicurati che il file temporaneo venga sempre eliminato alla fine
    if (fileToCleanUp && fileToCleanUp.filepath && fs.existsSync(fileToCleanUp.filepath)) { // Aggiunto controllo per fileToCleanUp.filepath
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