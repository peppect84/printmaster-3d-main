import express, { Request, Response, RequestHandler } from 'express';
import formidable from 'formidable';
import fs from 'fs';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

dotenv.config();

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-06-30.basil',
  typescript: true,
});

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost:4001',
  'https://printmaster3d.netlify.app',
  'https://printmaster3d.it',
  'https://www.printmaster3d.it',
  'https://licciardellogiuseppept.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      console.error(msg);
      callback(new Error(msg), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('API Server for PrintMaster3D is running correctly.');
});

const validateCouponHandler: RequestHandler = async (req, res) => {
  const { couponCode, originalAmount } = req.body;
  if (!couponCode || typeof originalAmount !== 'number' || originalAmount <= 0) {
    return res.status(400).send({ error: 'Codice coupon o importo originale mancante o non valido.' });
  }
  try {
    const promoCodes = await stripe.promotionCodes.list({
      code: couponCode.toUpperCase(),
      active: true,
      limit: 1,
    });
    if (promoCodes.data.length === 0) {
      return res.status(404).send({ error: 'Coupon non valido o scaduto.' });
    }
    const coupon = promoCodes.data[0].coupon;
    let discount = 0;
    if (coupon.percent_off) {
      discount = originalAmount * (coupon.percent_off / 100);
    } else if (coupon.amount_off) {
      discount = coupon.amount_off;
    }

    const newTotal = Math.max(0, originalAmount - discount);
    const finalDiscount = Math.round(discount);
    const finalNewTotal = Math.round(newTotal);

    res.status(200).json({
      isValid: true,
      discount: finalDiscount,
      newTotal: finalNewTotal,
      couponId: coupon.id
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    res.status(500).send({ error: `Errore nella validazione del coupon: ${errorMessage}` });
  }
};
app.post('/api/validate-coupon', validateCouponHandler);

const createPaymentIntentHandler: RequestHandler = async (req, res) => {
  const { amount } = req.body;
  if (typeof amount !== 'number' || amount < 0) {
    res.status(400).send({ error: 'Importo non valido o mancante.' });
    return;
  }
  if (amount === 0) {
    res.send({ clientSecret: null, status: 'succeeded' });
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

// ENDPOINT CONFERMA ORDINE [SendGrid]
const sendOrderConfirmationHandler: RequestHandler = async (req, res) => {
  const { customerData, orderSummary, orderTotal } = req.body;
  if (!customerData || !orderSummary || !orderTotal) {
    res.status(400).json({ message: 'Dati dell\'ordine mancanti.' });
    return;
  }
  const fullAddress = `${customerData.street}, ${customerData.zip} ${customerData.city} (${customerData.province})`;

  const adminMsg = {
    to: 'tecnolife46@gmail.com',
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `Nuovo Ordine Confermato da ${customerData.fullName}`,
    html: `<h1>Nuovo Ordine Ricevuto!</h1>
           <p><strong>Cliente:</strong> ${customerData.fullName}</p>
           <p><strong>Email:</strong> ${customerData.email}</p>
           <p><strong>Telefono:</strong> ${customerData.phone}</p>
           <p><strong>Indirizzo di Fatturazione:</strong> ${fullAddress}</p>
           <hr>
           <h3>Riepilogo Ordine:</h3>
           <pre style="font-family: monospace; white-space: pre-wrap;">${orderSummary}</pre>
           <hr>
           <p style="font-size: 1.2em;"><strong>TOTALE: ${orderTotal} €</strong></p>`,
  };
  const customerMsg = {
    to: customerData.email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Il tuo ordine PrintMaster3D è stato confermato!',
    html: `<h1>Grazie per il tuo ordine, ${customerData.fullName}!</h1>
          <p>Abbiamo ricevuto il tuo ordine e lo stiamo elaborando. Ecco un riepilogo:</p>
          <hr>
          <h3>Il tuo Riepilogo:</h3>
          <pre style="font-family: monospace; white-space: pre-wrap;">${orderSummary}</pre>
          <hr>
          <p style="font-size: 1.2em;"><strong>TOTALE PAGATO: ${orderTotal} €</strong></p>
          <br><p><strong>Nota importante:</strong> Potrai ritirare il tuo ordine presso la nostra sede in Via Scale Sant'Antonio, 59, Aci Catena (CT).</p>
          <p>Ti contatteremo al numero <strong>${customerData.phone}</strong> non appena sarà pronto per il ritiro.</p>
          <p>Grazie,<br>Il team di PrintMaster3D</p>`,
  };
  try {
    await sgMail.send(adminMsg);
    await sgMail.send(customerMsg);
    res.status(200).json({ message: 'Email di conferma inviate con successo!' });
  } catch (error) {
    console.error("Errore invio email di conferma:", error);
    res.status(500).json({ message: 'Errore durante l\'invio delle email.' });
  }
};
app.post('/api/send-order-confirmation', sendOrderConfirmationHandler);

// ENDPOINT FORM CONTATTO (con HCAPTCHA)
const sendEmailHandler: RequestHandler = async (req: FormidableRequest, res: Response) => {
  let fileToCleanUp: formidable.File | null = null;
  try {
    const data: { fields: formidable.Fields; files: formidable.Files } = await new Promise((resolve, reject) => {
      const uploadDir = './temp_uploads';
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
      const form = formidable({
        multiples: false,
        maxFileSize: 10 * 1024 * 1024,
        uploadDir: uploadDir,
        keepExtensions: true,
      });
      form.parse(req, (err, fields, files) => {
        if (err) {
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
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    if (!hcaptchaToken) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      res.status(400).json({ message: 'hCaptcha token is missing. Please try again.' });
      return;
    }

    const HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY;
    if (!HCAPTCHA_SECRET_KEY) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
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
        if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
        res.status(401).json({ message: 'hCaptcha verification failed. Please try again.' });
        return;
      }
    } catch (hcaptchaError) {
      if (fileToCleanUp && fs.existsSync(fileToCleanUp.filepath)) fs.unlinkSync(fileToCleanUp.filepath);
      res.status(500).json({ message: 'Could not verify hCaptcha. Please try again later.' });
      return;
    }

    let attachments = [];
    if (file) {
      try {
        const fileContent = fs.readFileSync(file.filepath);
        attachments.push({
          content: fileContent.toString('base64'),
          filename: file.originalFilename || 'attachment',
          type: file.mimetype || 'application/octet-stream',
          disposition: 'attachment'
        });
      } catch (readErr) {
        res.status(500).json({ message: 'Error processing attachment', error: (readErr as Error).message });
        return;
      }
    }

    const msg = {
      to: 'tecnolife46@gmail.com',
      from: process.env.SENDGRID_FROM_EMAIL,
      replyTo: email,
      subject: `Nuova richiesta da ${name} - PrintMaster 3D`,
      html: `<p><strong>Nome:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Messaggio:</strong></p>
             <p>${message}</p>`,
      attachments: attachments.length > 0 ? attachments : undefined
    };

    await sgMail.send(msg);
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

// === ENDPOINT SENZA HCAPTCHA (PT) [SendGrid]
const sendEmailPtHandler: RequestHandler = async (req: Request, res: Response) => {
  const { nome, email, oggetto, messaggio } = req.body;
  if (!nome || !email || !messaggio) {
    return res.status(400).json({ message: 'Nome, email e messaggio sono obbligatori.' });
  }
  const msg = {
    to: 'tecnolife46@gmail.com',
    from: process.env.SENDGRID_FROM_EMAIL,
    replyTo: email,
    subject: `Nuovo Contatto da ${nome} (Sito PT)`,
    html: `<h1>Nuovo Contatto su LicciardelloG. Personal Trainer</h1>
           <p><strong>Nome:</strong> ${nome}</p>
           <p><strong>Email:</strong> ${email}</p>
           ${oggetto ? `<p><strong>Oggetto:</strong> ${oggetto}</p>` : ''}
           <hr>
           <p><strong>Messaggio:</strong></p>
           <p>${messaggio.replace(/\n/g, '<br>')}</p>`
  };
  try {
    await sgMail.send(msg);
    res.status(200).json({ message: 'Email inviata con successo!' });
  } catch (error) {
    console.error('Errore invio email dal sito PT:', error);
    res.status(500).json({ message: 'Errore durante l\'invio dell\'email.' });
  }
};
app.post('/api/send-email-pt', sendEmailPtHandler);

app.listen(port, () => {
  console.log(`Server API listening on port ${port}`);
});

