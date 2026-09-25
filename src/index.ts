import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuration de Multer (stockage en mémoire)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Format de fichier non autorisé (jpeg, png, webp uniquement)'));
    }
    cb(null, true);
  },
});

// Middleware de protection par clé API
const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.header('x-api-key');
  const validKey = process.env.API_KEY;
  
  if (validKey && key !== validKey) {
    res.status(401).json({ success: false, error: 'Clé API invalide ou manquante' });
    return;
  }
  next();
};

// Route de test
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'AgriPulse AI Backend est opérationnel 🚀' });
});

// Route principale de diagnostic
app.post(
  '/api/diagnostics',
  requireApiKey,
  upload.single('image') as any,
  (async (req: Request, res: Response): Promise<void> => {
    try {
      const { culture, disease, confidence } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'Aucune image fournie' });
        return;
      }

      if (!culture || !disease || confidence === undefined) {
        res.status(400).json({
          success: false,
          error: 'Champs requis manquants : culture, disease, confidence.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Reçu avec succès !',
        data: {
          culture,
          disease,
          confidence,
          fileName: file.originalname,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Erreur interne' });
    }
  }) as any
);

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
