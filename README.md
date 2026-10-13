# CliniFusion-X

**Multimodal Clinical Intelligence Platform for Chest Radiograph Analysis**

CliniFusion-X is an AI-assisted clinical decision support system that combines a Swin Transformer image model with LLM-generated clinical reports and a rule-based Clinical Consistency Module (CCM).

---

## Project Structure

```
CliniFusion-X/
|
|-- backend/                        # FastAPI server + all ML modules
|   |-- app.py                      # Main API entrypoint (FastAPI)
|   |-- inference.py                # Swin Transformer inference engine
|   |-- model.py                    # Model loader utility
|   |-- ccm.py                      # Clinical Consistency Module (rule-based KB)
|   |-- explainability.py           # GradCAM / ScoreCAM heatmap generator
|   |-- clinical_extractor.py       # PDF clinical text extractor (LLM)
|   |-- report_generator.py         # LLM-based clinical report generator
|   |-- gated_fusion.py             # Gated multimodal fusion module
|   |-- train_fusion.py             # Training script for fusion model
|   |-- generate_synthetic_symptoms.py  # Training data utility
|   |-- config.json                 # Model configuration
|   |-- labels.json                 # ChestX-ray14 class labels
|   |-- thresholds.json             # Per-class detection thresholds
|   |-- requirements.txt            # Python dependencies
|
|-- frontend/                       # React + Vite + Tailwind UI
|   |-- src/
|   |   |-- routes/                 # Page components (Dashboard, Analysis, Results, Report...)
|   |   |-- components/             # Shared components (AppShell, TaxonomyModal)
|   |   |-- services/               # historyService, authService
|   |-- public/                     # Static assets (logo, sample CXR images)
|   |-- dist/                       # Production build output (git-ignored)
|
|-- best_swin_chestxray14.pth       # Trained model weights (not in git)
|-- Dockerfile                      # Multi-stage Docker build
|-- docker-compose.yml              # Docker Compose config
|-- README.md
```

---

## Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Server status + model info |
| `POST` | `/api/analyze` | Analyze chest X-ray with symptoms |
| `POST` | `/api/explain` | Generate GradCAM heatmap |
| `GET`  | `/api/kb-diseases` | All diseases + CCM symptom KB |
| `GET`  | `/api/risk-context/{disease}` | Risk factors for a specific disease |

---

## Key Architecture Components

- **Swin Transformer** — multi-label image classifier for 15 NIH ChestX-ray14 diseases
- **CCM (Clinical Consistency Module)** — rule-based knowledge base that cross-checks AI predictions against patient-reported symptoms
- **Gated Fusion** — combines visual features with symptom embeddings
- **LLM Report Generator** — generates structured clinical reports using Gemini
- **Explainability** — GradCAM / ScoreCAM visual explanation of model decisions
