 import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuration de Multer pour recevoir l'image en mémoire temporairement
const upload = multer({ storage: multer.memoryStorage() });

// Initialisation de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Route de test
app.get('/', (req: Request, res: Response) => {
  res.json({ message: "Bienvenue sur l'API d'AgriPulse AI 🚀" });
});

// Route pour analyser l'image de la plante
app.post('/api/diagnose', upload.single('plantImage'), async (req: Request, res: Response): Promise<any> => {
  try {
    const file = req.file;
    const userId = req.body.userId;

    if (!file) {
      return res.status(400).json({ error: "Aucune image n'a été fournie." });
    }

    // 1. Upload de l'image dans Supabase Storage
    const fileName = `${Date.now()}-${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('plant-images')
      .upload(fileName, file.buffer, { contentType: file.mimetype });

    if (uploadError) {
      throw uploadError;
    }

    // Récupérer l'URL publique de l'image
    const { data: publicUrlData } = supabase.storage
      .from('plant-images')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    // 2. Simulation de la réponse de l'IA pour le prototype
    const analysisResult = {
      disease_name: "Nécrose des feuilles (Mildiou)",
      confidence_score: 0.92,
      treatment_advice: "Isoler les plants infectés, appliquer un fongicide à base de cuivre et réduire l'arrosage excessif."
    };

    // 3. Enregistrement du diagnostic dans Supabase
    const { data: dbData, error: dbError } = await supabase
      .from('diagnostics')
      .insert([
        {
          user_id: userId || null,
          image_url: imageUrl,
          disease_name: analysisResult.disease_name,
          confidence_score: analysisResult.confidence_score,
          treatment_advice: analysisResult.treatment_advice
        }
      ])
      .select();

    if (dbError) {
      throw dbError;
    }

    return res.status(200).json({
      success: true,
      message: "Diagnostic réalisé avec succès",
      data: dbData[0]
    });

  } catch (error: any) {
    console.error("Erreur lors du diagnostic :", error.message);
    return res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

app.listen(port, () => {
  console.log(`Serveur AgriPulse en cours d'exécution sur le port ${port}`);
});
