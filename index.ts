import express, { Request, Response, RequestHandler } from 'express';
import formidable from 'formidable';
import nodemailer from 'nodemailer';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';

// Aggiunte per Stripe
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

// DEFINIZIONI INTERFACCE
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

// Inizializzazione di Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-06-30.basil',
  typescript: true,
});

// Configurazione CORS
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost:4001',
  'https://printmaster3d.netlify.app',
  'https://printmaster3d.it',
  'https://www.printmaster3d.it'
];

app.use(cors({
  origin: function (origin, callback) {
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

app.use(express.json());

// ENDPOINT PER I PAGAMENTI
const createPaymentIntentHandler: RequestHandler = async (req, res) => {
  const { amount } = req.body;
  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).send({ error: 'Importo non valido o mancante.' });
    return;
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    res.status(500).send({ error: errorMessage });
  }
};
app.post('/api/create-payment-intent', createPaymentIntentHandler);

// ENDPOINT PER L'INVIO DELLE EMAIL DI CONFERMA ORDINE
const sendOrderConfirmationHandler: RequestHandler = async (req, res) => {
    const { customerName, customerEmail, orderSummary, orderTotal } = req.body;
  
    if (!customerName || !customerEmail || !orderSummary || !orderTotal) {
      // --- CORREZIONE QUI ---
      res.status(400).json({ message: 'Dati dell\'ordine mancanti.' });
      return; // Usa un 'return' vuoto
    }
  
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  
    // Email per l'amministratore
    const adminMailOptions = {
      from: `"PrintMaster3D Ordini" <${process.env.EMAIL_USER}>`,
      to: 'tecnolife46@gmail.com',
      subject: `Nuovo Ordine Confermato da ${customerName}`,
      html: `<h1>Nuovo Ordine Ricevuto!</h1><p><strong>Cliente:</strong> ${customerName}</p><p><strong>Email Cliente:</strong> ${customerEmail}</p><hr><h3>Riepilogo Ordine:</h3><pre>${orderSummary}</pre><hr><p><strong>TOTALE: ${orderTotal} €</strong></p>`,
    };
  
    // Email per il cliente
    const customerMailOptions = {
      from: `"PrintMaster3D" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Il tuo ordine PrintMaster3D è stato confermato!`,
      html: `<h1>Grazie per il tuo ordine, ${customerName}!</h1><p>Abbiamo ricevuto il tuo ordine. Ecco un riepilogo:</p><hr><h3>Il tuo Riepilogo:</h3><pre>${orderSummary}</pre><hr><p><strong>TOTALE PAGATO: ${orderTotal} €</strong></p><br><p><strong>Nota:</strong> Potrai ritirare il tuo ordine presso la nostra sede in Via Scale Sant'Antonio, 59, Aci Catena (CT).</p><p>Ti contatteremo non appena sarà pronto per il ritiro.</p><p>Grazie,<br>Il team di PrintMaster3D</p>`,
    };
  
    try {
      await transporter.sendMail(adminMailOptions);
      await transporter.sendMail(customerMailOptions);
      res.status(200).json({ message: 'Email di conferma inviate con successo!' });
    } catch (error) {
      console.error("Errore invio email di conferma:", error);
      res.status(500).json({ message: 'Errore durante l\'invio delle email.' });
    }
  };
app.post('/api/send-order-confirmation', sendOrderConfirmationHandler);

// ENDPOINT PER IL FORM DI CONTATTO
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

    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
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
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { success } = hcaptchaVerifyResponse.data;

      if (!success) {
        if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) {
          fs.unlinkSync(fileToCleanUp.filepath);
        }
        res.status(401).json({ message: 'hCaptcha verification failed. Please try again.' });
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
        const fileContent = fs.readFileSync(file.filepath);
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
      html: `<p><strong>Nome:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Messaggio:</strong></p><p>${message}</p>`,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully!' });

  } catch (error: unknown) {
    console.error('Errore generale nel server API:', error);
    if (typeof error === 'object' && error !== null && 'status' in error && 'message' in error) {
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
