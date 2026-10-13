import os
import json
import re
from dotenv import load_dotenv

load_dotenv()

from clinical_extractor import setup_gemini

DISEASE_KNOWLEDGE_BASE = {
    'Effusion': {
        'desc': 'Pleural effusion with fluid accumulation within the pleural cavity, demonstrating blunting of the lateral and posterior costophrenic angles and a classic lateral meniscus sign.',
        'anatomical_signs': 'Blunting of the costophrenic sulci, obscuration of the hemidiaphragmatic contour, dependent fluid tracking along the lateral thoracic wall, and passive basilar compressive atelectasis.',
        'pathophysiology': 'Exudative or transudative fluid extravasation into the pleural space exceeding lymphatic drainage capacity. Common etiologies include congestive heart failure (transudative), acute parapneumonic process / empyema (exudative), malignancy, or pulmonary thromboembolism.',
        'differentials': '1. Acute Parapneumonic Effusion vs. Empyema\n2. Congestive Heart Failure (Hydrostatic Volume Overload)\n3. Malignant Pleural Effusion\n4. Subpulmonic Collection or Sympathetic Reaction to Subdiaphragmatic Pathology',
        'acute_management': '- Administer supplemental titrated oxygen to maintain target SpO2 >= 92-94% (88-92% in chronic hypercapnic respiratory failure).\n- Position patient upright (high Fowler position) to optimize diaphragmatic excursion and ease respiratory work.',
        'diagnostic_steps': '- Point-of-care thoracic ultrasound (POCUS) to accurately measure fluid depth, quantify volume, assess echogenicity, and evaluate for internal fibrin septations or loculations.\n- Diagnostic thoracentesis with pleural fluid routine: total protein, lactate dehydrogenase (LDH), cell count with differential, pH, glucose, Gram stain, and aerobic/anaerobic cultures. Apply Light criteria to differentiate transudate from exudate.\n- Contrast-Enhanced Chest CT (CECT) following fluid evacuation if parenchymal necrosis, pleural nodularity, or underlying malignancy is suspected.'
    },
    'Infiltration': {
        'desc': 'Patchy parenchymal airspace infiltration and ill-defined bronchopulmonary segment opacification without complete volume loss.',
        'anatomical_signs': 'Confluent or multifocal acinar opacities, ill-defined peribronchovascular cuffing, and ground-glass haziness within dependent bronchopulmonary segments.',
        'pathophysiology': 'Accumulation of inflammatory exudate, leukocytes, and fibrin within alveolar spaces, characteristic of acute bacterial bronchopneumonia, viral pneumonitis, or non-infectious inflammatory pneumonitis.',
        'differentials': '1. Community-Acquired Pneumonia (bacterial or atypical etiology)\n2. Viral Lower Respiratory Tract Infection\n3. Aspiration Pneumonitis\n4. Non-cardiogenic Pulmonary Edema / Acute Respiratory Distress Syndrome (early)',
        'acute_management': '- Initiate empiric antimicrobial coverage promptly in accordance with local hospital antibiogram and ATS/IDSA guidelines for community-acquired or hospital-acquired pneumonia.\n- Maintain pulmonary toilet, chest physiotherapy, and adequate hydration.',
        'diagnostic_steps': '- Sputum induction for Gram stain and microbiological culture.\n- Blood cultures (two sets from distinct venipuncture sites) prior to antimicrobial administration.\n- Serum inflammatory biomarkers: Complete blood count with differential (evaluating leukocytosis or bandemia), C-reactive protein (CRP), and serum procalcitonin.\n- Respiratory viral multiplex panel via nasopharyngeal swab and urinary antigens for Streptococcus pneumoniae and Legionella pneumophila.'
    },
    'Atelectasis': {
        'desc': 'Focal pulmonary parenchymal collapse with alveolar volume loss, most prominent in dependent basilar segments.',
        'anatomical_signs': 'Linear or wedge-shaped plate-like basilar opacities, crowding of bronchovascular bundles, and compensatory ipsilateral diaphragmatic elevation.',
        'pathophysiology': 'Subsegmental alveolar hypoventilation, airway mucus plugging, or compressive volume loss secondary to adjacent pleural fluid or shallow breathing patterns due to chest splinting.',
        'differentials': '1. Subsegmental or Plate-like Compressive Atelectasis\n2. Endobronchial Mucus Plugging\n3. Resolving Pulmonary Infarction\n4. Early Basilar Pneumonic Infiltrate',
        'acute_management': '- Aggressive respiratory therapy, including incentive spirometry (10 breaths every hour while awake), positive expiratory pressure (PEP) therapy, and early ambulation.\n- Adequate analgesia to relieve chest wall splinting while avoiding excessive sedation.',
        'diagnostic_steps': '- Re-evaluate with serial auscultation and pulse oximetry following pulmonary physiotherapy.\n- Repeat chest radiography at 48 hours to confirm re-expansion and exclude evolving underlying consolidation.\n- Fiberoptic bronchoscopy if central obstructing mucus plug or foreign lesion is suspected.'
    },
    'Cardiomegaly': {
        'desc': 'Globally enlarged cardiac silhouette with a cardiothoracic ratio (CTR) exceeding normal physiological baseline (> 0.50 on PA projection).',
        'anatomical_signs': 'Transverse cardiac diameter > 50% of maximum internal thoracic diameter, rounding of the cardiac apex, and prominence of upper lobe pulmonary venous vasculature (cephalization).',
        'pathophysiology': 'Multi-chamber dilatation or left ventricular hypertrophy secondary to chronic arterial hypertension, ischemic cardiomyopathy, valvular heart disease, or pericardial effusion.',
        'differentials': '1. Hypertensive or Ischemic Dilated Cardiomyopathy\n2. Decompensated Congestive Heart Failure\n3. Pericardial Effusion ("water-bottle" silhouette)\n4. Valvular Regurgitant / Stenotic Heart Disease',
        'acute_management': '- Optimize hemodynamic volume status; initiate loop diuretic therapy if hypervolemic with clinical crackles, S3 gallop, or peripheral edema.\n- Continuous cardiac telemetry and non-invasive blood pressure monitoring.',
        'diagnostic_steps': '- Transthoracic Echocardiogram (TTE) with comprehensive Doppler assessment to determine left ventricular ejection fraction (LVEF), diastolic function, wall motion abnormalities, and pericardial space status.\n- Quantitative serum NT-proBNP or BNP level.\n- 12-lead Electrocardiogram (ECG) to evaluate for arrhythmias, bundle branch blocks, or acute ischemia.'
    },
    'Consolidation': {
        'desc': 'Dense confluent alveolar airspace opacification with internal air bronchograms and anatomical lobar confinement.',
        'anatomical_signs': 'Homogeneous dense parenchymal opacity with preservation of bronchial architecture (air bronchogram sign), obscuration of adjacent cardiac or diaphragmatic margins (silhouette sign).',
        'pathophysiology': 'Complete replacement of intra-alveolar air by infectious or inflammatory exudate, classical of acute bacterial lobar pneumonia (e.g. Streptococcus pneumoniae, Klebsiella pneumoniae).',
        'differentials': '1. Acute Bacterial Lobar Pneumonia\n2. Pulmonary Hemorrhage / Contusion\n3. Cryptogenic Organizing Pneumonia (COP)\n4. Bronchoalveolar / Invasive Mucinous Adenocarcinoma',
        'acute_management': '- Immediate administration of intravenous targeted broad-spectrum antibiotic regimen within 4 hours of medical contact.\n- Oxygenation titration with high-flow nasal cannula if hypoxemic; monitor for acute respiratory failure.',
        'diagnostic_steps': '- Blood and sputum microbiological cultures; urinary antigens for Legionella and Pneumococcus.\n- Serial arterial blood gas (ABG) analysis in patients with clinical tachypnea or desaturation.\n- Follow-up chest radiography in 6-8 weeks to document complete radiological resolution and rule out underlying endobronchial neoplasm.'
    },
    'Pneumonia': {
        'desc': 'Acute infectious inflammatory consolidation of pulmonary parenchyma with alveolar exudation and systemic inflammatory response.',
        'anatomical_signs': 'Segmental or lobar opacification, air bronchograms, micro-nodular infiltration, and associated reactive pleural reaction.',
        'pathophysiology': 'Bacterial, viral, or fungal pathogen proliferation within the terminal respiratory units evoking microvascular leakage, leukocyte extravasation, and impaired gas exchange.',
        'differentials': '1. Bacterial Community-Acquired Pneumonia\n2. Viral Interstitial Pneumonitis\n3. Aspiration Pneumonia with Mixed Anaerobes\n4. Eosinophilic or Hypersensitivity Pneumonitis',
        'acute_management': '- Initiate empiric dual antimicrobial therapy (e.g. Beta-lactam + Macrolide or Respiratory Fluoroquinolone) per hospital clinical pathway.\n- Hydration and electrolyte rebalancing.',
        'diagnostic_steps': '- Severity stratification using CURB-65 or PSI (Pneumonia Severity Index) to direct outpatient vs inpatient vs ICU admission.\n- Serial inflammatory markers (CRP and Procalcitonin) to monitor treatment responsiveness.\n- Repeat imaging in 4-6 weeks post-antibiotic course.'
    },
    'Pleural_Thickening': {
        'desc': 'Fibrocalcific thickening and scarring of the visceral or parietal pleura along the chest wall or apical caps.',
        'anatomical_signs': 'Smooth or nodular pleural thickening (> 3 mm), apical pleural capping, and potential calcified pleural plaques along the diaphragmatic or posterolateral pleura.',
        'pathophysiology': 'Chronic reactive fibrotic remodeling secondary to prior hemothorax, healed bacterial empyema, tuberculous pleuritis, or occupational mineral dust exposure (asbestos).',
        'differentials': '1. Chronic Post-Inflammatory Pleural Fibrosis\n2. Asbestos-Related Pleural Plaques\n3. Primary Pleural Mesothelioma\n4. Metastatic Pleural Carcinomatosis',
        'acute_management': '- Confirm clinical stability; assess for underlying dyspnea or restrictive ventilatory defect.\n- Avoid unnecessary invasive pleural interventions if stable and calcified.',
        'diagnostic_steps': '- Inquire regarding detailed lifetime occupational history (shipyard, insulation, construction).\n- Comparison with prior historical radiographs to establish chronicity (> 2 years stability confirms benign etiology).\n- High-resolution thoracic CT if thickening is nodular, circumferential, or exceeds 1 cm in thickness.'
    },
    'Edema': {
        'desc': 'Diffuse symmetric pulmonary vascular congestion with perihilar bat-wing opacification, interlobular septal lines, and alveolar fluid filling.',
        'anatomical_signs': 'Perihilar haze, cephalization of pulmonary veins, Kerley B lines in the lateral basilar sulci, peribronchial cuffing, and cardiomegaly.',
        'pathophysiology': 'Elevated pulmonary capillary hydrostatic pressure (> 20-25 mmHg) overcoming lymphatic clearance, causing interstitial transudation progressing to alveolar flooding.',
        'differentials': '1. Cardiogenic Hydrostatic Pulmonary Edema\n2. Acute Non-Cardiogenic Edema (ARDS / Capillary Leak Syndrome)\n3. Fluid Overload in End-Stage Renal Disease\n4. Acute Volume Overload Transfusion-Related Lung Injury (TRALI)',
        'acute_management': '- Urgent intravenous loop diuretics (Furosemide 40-80 mg IV bolus) and vasodilator therapy if hypertensive.\n- Non-invasive positive pressure ventilation (CPAP / BiPAP) to recruit fluid-filled alveoli and reduce preload and afterload.\n- Continuous cardiac monitoring and arterial line placement if hemodynamically labile.',
        'diagnostic_steps': '- Immediate bedside echocardiography to assess acute left ventricular systolic/diastolic decompensation and severe mitral regurgitation.\n- Serial serum electrolytes, BUN, and creatinine to guide ongoing diuretic titration.\n- Cardiac troponin and NT-proBNP quantification to assess acute myocardial injury.'
    },
    'Nodule': {
        'desc': 'Well-defined, solitary or discrete pulmonary parenchymal opacity measuring less than or equal to 3 cm in greatest dimension.',
        'anatomical_signs': 'Focal rounded opacity surrounded by aerated lung parenchyma, lacking cavitation or associated lymphadenopathy on standard projection.',
        'pathophysiology': 'Broad etiology spanning benign infectious granulomas (Histoplasma, Tuberculosis), hamartomas, or early primary bronchogenic carcinoma / solitary metastasis.',
        'differentials': '1. Benign Infectious Granuloma\n2. Pulmonary Hamartoma\n3. Early Stage Primary Bronchogenic Carcinoma (Adenocarcinoma / Squamous)\n4. Solitary Metastatic Focus',
        'acute_management': '- No immediate acute hemodynamic interventions; establish risk stratification based on age, smoking pack-years, and personal history of cancer.',
        'diagnostic_steps': '- Dedicated Thin-Slice Non-Contrast or Contrast-Enhanced High-Resolution Chest CT protocol (HRCT) to evaluate precise nodule attenuation, margins (spiculation vs smoothness), and presence of calcification.\n- Retrieval and meticulous side-by-side comparison with historical chest radiographs or CT studies to calculate volume doubling time.\n- Application of Fleischner Society 2017 Guidelines for follow-up surveillance interval or tissue biopsy.'
    },
    'Mass': {
        'desc': 'Discrete, expansive pulmonary or mediastinal soft-tissue mass measuring strictly greater than 3 cm in transverse diameter.',
        'anatomical_signs': 'Large dense soft-tissue opacity, lobulated or spiculated contours, potential central cavitation, and distortion of contiguous bronchovascular anatomy.',
        'pathophysiology': 'High pre-test probability of primary bronchogenic carcinoma, malignant lymphoma, or aggressive metastatic lesion, causing local compressive and invasive tissue destruction.',
        'differentials': '1. Primary Bronchogenic Carcinoma (Non-Small Cell or Small Cell Lung Cancer)\n2. Solitary Secondary Pulmonary Metastasis\n3. Chronic Pulmonary Abscess / Fungal Mycetoma\n4. Mediastinal Tumor (Thymoma, Teratoma, Lymphoma)',
        'acute_management': '- Multidisciplinary thoracic oncology referral; assess for central airway compromise, hemoptysis, or superior vena cava syndrome.',
        'diagnostic_steps': '- Urgent Contrast-Enhanced CT (CECT) of the chest, upper abdomen, and adrenal glands for initial TNM anatomical staging.\n- Whole-body 18F-FDG PET-CT scan to determine metabolic viability and detect nodal / distant metastases.\n- Interventional pulmonology bronchoscopy with EBUS (Endobronchial Ultrasound) or CT-guided percutaneous core needle biopsy for definitive histopathology and immunohistochemistry / molecular biomarker profiling.'
    },
    'Pneumothorax': {
        'desc': 'Accumulation of free intrapleural air with separation and visualization of the visceral pleural white line and total absence of peripheral vascular lung markings.',
        'anatomical_signs': 'Sharp hair-thin visceral pleural line paralleling the chest wall, peripheral hyperlucency devoid of pulmonary vessels, and secondary basilar atelectasis.',
        'pathophysiology': 'Disruption of visceral or parietal pleural continuity allowing atmospheric or alveolar gas into the negative-pressure pleural space, with risk of progression to tension pneumothorax.',
        'differentials': '1. Primary Spontaneous Pneumothorax (rupture of subpleural apical blebs)\n2. Secondary Spontaneous Pneumothorax (COPD bullae, necrotizing pneumonia, cystic lung disease)\n3. Iatrogenic or Traumatic Pneumothorax\n4. Giant Emphysematous Bulla mimicking pneumothorax',
        'acute_management': '- Immediate assessment for tension physiology: hemodynamic collapse, severe tachycardia, hypotension, tracheal deviation, and absent breath sounds require emergency needle decompression (2nd intercostal space midclavicular line or 5th intercostal space anterior axillary line).\n- In stable non-tension cases, high-flow 100% supplemental oxygen therapy accelerates nitrogen reabsorption across the pleura by a factor of 4.',
        'diagnostic_steps': '- Measurement of apex-to-cupola distance or interpleural distance to classify size (small vs large per BTS / ACCP guidelines).\n- Tube thoracostomy (small-bore pigtail catheter or large-bore chest tube with water-seal drainage) for symptomatic or large-volume pneumothoraces.\n- Repeat expiratory chest radiograph or low-dose chest CT to assess lung re-expansion and evaluate underlying bullous disease.'
    },
    'Emphysema': {
        'desc': 'Bilateral symmetric pulmonary hyperinflation with marked flattening and depression of the diaphragmatic hemidomes and hyperlucent lung fields.',
        'anatomical_signs': 'Increased retrosternal clear space (> 2.5 cm on lateral), low flat diaphragms with blunted or wide costophrenic angles, attenuated peripheral vascularity ("pruning"), and prominent central pulmonary arteries.',
        'pathophysiology': 'Permanent, irreversible enlargement of the airspaces distal to the terminal bronchioles accompanied by destructive elastolysis of alveolar walls without conspicuous fibrosis.',
        'differentials': '1. Chronic Obstructive Pulmonary Disease (Centrilobular / Panlobular Emphysema)\n2. Severe Acute Asthma Bronchospasm with Dynamic Hyperinflation\n3. Alpha-1 Antitrypsin Deficiency (basilar-predominant emphysema in younger individuals)\n4. Constrictive Bronchiolitis',
        'acute_management': '- Inhaled dual bronchodilator therapy (short-acting beta-2 agonist + short-acting anticholinergic nebulizations).\n- Systemic corticosteroids (Prednisone 40 mg daily for 5 days) if presenting with acute COPD exacerbation.\n- Controlled supplemental oxygen therapy with Venturi mask targeting SpO2 88-92% to avert oxygen-induced hypercapnia.',
        'diagnostic_steps': '- Formal Pulmonary Function Testing (PFTs) with post-bronchodilator spirometry (confirming FEV1/FVC < 0.70) and carbon monoxide diffusing capacity (DLCO).\n- High-resolution chest CT (HRCT) to evaluate the anatomical distribution and percentage of low-attenuation emphysematous parenchyma.\n- Serum Alpha-1 Antitrypsin level screening.'
    },
    'Fibrosis': {
        'desc': 'Diffuse bilateral reticular, linear, and cystic parenchymal abnormalities with architectural distortion and volume contraction.',
        'anatomical_signs': 'Coarse reticulonodular opacities, subpleural basilar honeycombing, traction bronchiectasis, and progressive loss of lower lobe lung volume.',
        'pathophysiology': 'Dysregulated fibroblast proliferation and extracellular matrix deposition leading to progressive alveolar architecture obliteration, severe ventilation-perfusion mismatch, and restrictive physiology.',
        'differentials': '1. Idiopathic Pulmonary Fibrosis (IPF / UIP pattern)\n2. Connective Tissue Disease-Associated Interstitial Lung Disease (Systemic Sclerosis, Rheumatoid Arthritis)\n3. Chronic Hypersensitivity Pneumonitis\n4. Drug-Induced or Radiation-Induced Pulmonary Fibrosis',
        'acute_management': '- Optimize supplemental ambulatory oxygen; assess for acute exacerbation of interstitial lung disease (AE-ILD).\n- Pulmonary rehabilitation and symptom management.',
        'diagnostic_steps': '- High-Resolution Chest CT (HRCT) protocol with inspiratory and expiratory prone sequences to distinguish true honeycombing and traction bronchiectasis from dependent atelectasis.\n- Comprehensive autoimmune serological panel (ANA, RF, Anti-CCP, Scl-70, Jo-1, Ro/La, myositis panel).\n- Multidisciplinary interstitial lung disease conference review with pulmonologists, thoracic radiologists, and thoracic pathologists.'
    },
    'Hernia': {
        'desc': 'Disruption or laxity of the diaphragmatic crus with intrathoracic herniation of hollow abdominal viscera.',
        'anatomical_signs': 'Retrocardiac or paracardiac air-fluid level within the posterior mediastinum, distortion of the medial diaphragmatic contour, and upward displacement of the gastric air bubble.',
        'pathophysiology': 'Sliding or paraesophageal herniation through an enlarged esophageal hiatus, or post-traumatic diaphragmatic rupture permitting abdominal organs into the negative-pressure pleural cavity.',
        'differentials': '1. Type I-IV Hiatal Hernia\n2. Traumatic Diaphragmatic Rupture / Hernia\n3. Bochdalek / Morgagni Congenital Hernia\n4. Mediastinal Abscess or Infected Bronchogenic Cyst',
        'acute_management': '- Assess for clinical signs of gastric volvulus, strangulation, or bowel obstruction (severe epigastric pain, retching without emesis, obstipation).\n- Place nasogastric tube under careful decompression if symptomatic acute gastric distension is present.',
        'diagnostic_steps': '- Contrast-Enhanced Chest and Abdominal CT with oral / IV contrast to delineate the precise anatomy of herniated viscera and assess for vascular compromise.\n- Barium or Gastrografin upper GI swallow study to evaluate esophageal transit, peristalsis, and gastroesophageal junction position.\n- Urgent surgical consultation if incarcerated or strangulated.'
    },
    'No Finding': {
        'desc': 'Normal cardiopulmonary boundaries, clear lung fields without focal consolidation, pneumothorax, or pleural effusion, and normal cardiothoracic ratio.',
        'anatomical_signs': 'Sharply defined costophrenic and cardiophrenic angles, normal pulmonary vascular branching tapering to periphery, normal mediastinal width, and intact thoracic cage.',
        'pathophysiology': 'Absence of radiologically overt acute pulmonary, pleural, or gross cardiovascular parenchymal disease on the current two-dimensional radiographic projection.',
        'differentials': '1. Normal Thoracic Examination\n2. Early or Sub-radiographic Pulmonary Pathology (e.g. early viral infection, mild asthma exacerbation)\n3. Extrathoracic / Musculoskeletal Etiology for Chest Discomfort\n4. Non-pulmonary causes (e.g. gastroesophageal reflux, costochondritis, anxiety-related dyspnea)',
        'acute_management': '- Reassure patient regarding absence of acute life-threatening radiographical anomalies.\n- Address presenting clinical symptoms and evaluate alternative organ systems.',
        'diagnostic_steps': '- Clinical correlation with detailed physical examination and baseline vital signs.\n- Serial clinical reassessment; instruct patient on red-flag respiratory symptoms warranting immediate re-evaluation.\n- Consider cross-sectional chest CT or non-radiological testing (D-dimer, cardiac enzymes, ECG) if clinical suspicion for vascular or coronary pathology persists.'
    }
}

class ReportGenerator:
    def __init__(self):
        self.model = setup_gemini()

    def generate_report(self, image_findings: list, raw_clinical_text: str) -> dict:
        """
        Takes the image findings and raw clinical text,
        and generates a structured, deeply comprehensive clinical report.
        """
        # 1. Attempt LLM generation if model is initialized
        if self.model:
            try:
                findings_str = "\n".join([
                    f"- {f['disease']}: {f['probability']*100:.1f}%"
                    for f in image_findings
                ])

                prompt = f"""
                You are a senior chest radiologist writing a clinical report for a patient's medical record.

                CHEST X-RAY ANALYSIS RESULTS:
                {findings_str}

                PATIENT CLINICAL INFORMATION:
                {raw_clinical_text}

                TASK:
                Write a clear, professional clinical report that a doctor can hand to a patient or share with 
                another clinician. Follow these rules strictly:

                LANGUAGE STYLE:
                - Write in plain, readable English. Avoid jargon overload.
                - Use important medical terms where needed (e.g. "pleural effusion", "consolidation") but always 
                  briefly explain what they mean in simple words right after.
                - Do NOT mention AI, machine learning, deep learning, neural networks, model names, datasets, 
                  or any technology. The report should read as if written by a human radiologist.
                - Do NOT use complex academic phrases like "calibrated posterior probabilities", 
                  "pathophysiological synthesis", "multimodal Bayesian assessment", etc.
                - Write as a doctor would explain findings to a well-informed patient.

                Format your response as a valid JSON object with EXACTLY these six keys containing Markdown text:
                {{
                    "clinical_context": "1-2 clear paragraphs describing why the chest X-ray was taken and what the patient came in with, using the patient's own symptoms and vitals. Simple, readable language.",
                    "image_model_findings": "A clear section listing what was found on the chest X-ray, organized into: Main Findings (high confidence), Additional Observations (moderate confidence), and Normal/Unlikely (not found). For each finding, give a one-sentence plain-language explanation of what it means clinically. Do NOT mention AI, model names, thresholds, or datasets.",
                    "clinical_information": "A structured summary of the patient's profile: age/sex, symptoms, vital signs (with brief note if any are abnormal), and lab values (with brief note if significant). Use normal formatting, not excessive bullet symbols.",
                    "integrated_interpretation": "2-3 readable paragraphs connecting what the X-ray shows with how the patient is feeling and their test results. Explain in clear terms why these findings matter and what they likely indicate. Use medical terms but explain each one simply.",
                    "possible_findings": "A numbered list of 3-4 possible diagnoses (what the findings could mean), written clearly. For each one, explain in 1-2 sentences why it is being considered and what it means for the patient.",
                    "recommended_next_steps": "A practical numbered list of next steps: immediate care needed, follow-up tests recommended, and monitoring plan. Write as clear action items a doctor or patient can understand."
                }}
                """

                response = self.model.generate_content(prompt)
                resp_text = response.text.strip()
                if resp_text.startswith("```json"):
                    resp_text = resp_text[7:-3].strip()
                elif resp_text.startswith("```"):
                    resp_text = resp_text[3:-3].strip()
                    
                llm_output = json.loads(resp_text)
                
                # Verify non-empty output
                if llm_output.get("clinical_context") and llm_output.get("integrated_interpretation"):
                    return {
                        "clinical_context": llm_output.get("clinical_context", ""),
                        "image_model_findings": llm_output.get("image_model_findings", ""),
                        "clinical_information": llm_output.get("clinical_information", ""),
                        "integrated_interpretation": llm_output.get("integrated_interpretation", ""),
                        "possible_findings": llm_output.get("possible_findings", ""),
                        "recommended_next_steps": llm_output.get("recommended_next_steps", "")
                    }
            except Exception as e:
                print(f"LLM generation failed, switching to clinical rules fallback: {e}")

        # 2. Robust Clinical Rule-Based Report Generation
        return self._generate_rule_based_report(image_findings, raw_clinical_text)

    def _generate_rule_based_report(self, image_findings: list, raw_clinical_text: str) -> dict:
        sorted_findings = sorted(image_findings, key=lambda x: x.get('probability', 0), reverse=True)
        top_finding = sorted_findings[0] if sorted_findings else {'disease': 'No Finding', 'probability': 0.0}
        
        primary_findings = [f for f in sorted_findings if f.get('probability', 0) >= 0.50]
        secondary_findings = [f for f in sorted_findings if 0.15 <= f.get('probability', 0) < 0.50]
        # -------------------------------------------------------------
        # 1. CLINICAL CONTEXT
        # -------------------------------------------------------------
        context_paragraphs = []
        context_paragraphs.append(
            "**Examination:** A standard chest X-ray (Posteroanterior view) was performed with the patient standing upright."
        )

        if text:
            context_paragraphs.append(
                f"**Reason for X-ray & Patient Presentation:** {text}."
            )
            context_paragraphs.append(
                "The chest X-ray was requested to look for possible lung, heart, or breathing-related problems based on the patient's reported symptoms and clinical condition."
            )
        else:
            context_paragraphs.append(
                "**Reason for X-ray:** Routine chest evaluation. Limited clinical history was available at the time of the examination."
            )

        context_p = "\n\n".join(context_paragraphs)

        # -------------------------------------------------------------
        # 2. X-RAY FINDINGS
        # -------------------------------------------------------------
        lines_img = []
        lines_img.append("The following is a summary of what was observed on the chest X-ray:\n")

        if primary_findings:
            lines_img.append("### Main Findings (High Confidence):")
            for f in primary_findings:
                p_val = f['probability'] * 100
                d_name = f['disease']
                d_info = DISEASE_KNOWLEDGE_BASE.get(d_name, {})
                # Get a plain-language description — first sentence only to keep it readable
                full_desc = d_info.get('desc', 'An abnormal pattern was detected in this area.')
                short_desc = full_desc.split('.')[0] + '.'
                lines_img.append(
                    f"- **{d_name}** — {short_desc}"
                )
        else:
            lines_img.append(
                f"### Leading Observation:\n- **{top_name}** — {DISEASE_KNOWLEDGE_BASE.get(top_name, {}).get('desc', 'An abnormality was noted.').split('.')[0]}."
            )

        if secondary_findings:
            lines_img.append("\n### Additional Observations (Moderate Confidence):")
            for f in secondary_findings[:4]:
                d_name = f['disease']
                d_info = DISEASE_KNOWLEDGE_BASE.get(d_name, {})
                short_desc = d_info.get('desc', 'A possible secondary finding was noted.').split('.')[0] + '.'
                lines_img.append(f"- **{d_name}** — {short_desc}")

        if minor_findings:
            minor_str = ", ".join([f['disease'] for f in minor_findings[:7]])
            lines_img.append(f"\n### Not Detected / Unlikely:\n{minor_str} — No significant signs of these conditions were found on this X-ray.")

        image_model_findings_str = "\n".join(lines_img)

        # -------------------------------------------------------------
        # 3. PATIENT CLINICAL INFORMATION
        # -------------------------------------------------------------
        lines_clin = []
        lines_clin.append("### Patient Summary:")
        if text:
            for line in text.split('\n'):
                clean_l = line.strip()
                if clean_l:
                    lines_clin.append(f"- {clean_l}")
            lines_clin.append(
                "\n*The patient's symptoms and test results have been taken into account when interpreting the X-ray findings below.*"
            )
        else:
            lines_clin.append("- **Patient history and symptoms:** Not provided.")
            lines_clin.append("- **Vital signs:** Not available.")
            lines_clin.append("- **Lab results:** Not provided. Basic blood tests and inflammatory markers are recommended.")

        clinical_info_str = "\n".join(lines_clin)

        # -------------------------------------------------------------
        # 4. INTERPRETATION
        # -------------------------------------------------------------
        interp_paragraphs = []

        # Paragraph 1: What was found and what it means
        pathophys = top_kb.get('pathophysiology', 'This finding may indicate an active problem in the lungs or chest cavity.')
        interp_paragraphs.append(
            f"The chest X-ray shows signs consistent with **{top_name}**. {pathophys} "
            f"This finding fits with the patient's symptoms and supports the need for further evaluation and treatment."
        )

        # Paragraph 2: Secondary findings if present
        if secondary_findings:
            sec_items = [f"**{f['disease']}**" for f in secondary_findings[:2]]
            sec_items_str = " and ".join(sec_items)
            interp_paragraphs.append(
                f"In addition to the main finding, the X-ray also shows possible signs of {sec_items_str}. "
                f"These secondary findings are common alongside the primary condition — for example, fluid around the lungs can cause a portion of the lung to partially collapse (a condition called atelectasis). "
                f"Together, these findings suggest the problem may affect more than one area of the chest."
            )
        else:
            interp_paragraphs.append(
                "The rest of the chest structures — including the heart size, major blood vessels, and surrounding bony skeleton — appear within acceptable limits. "
                "There are no signs of a collapsed lung (pneumothorax) or major shift of the chest organs."
            )

        # Paragraph 3: What this means for the patient — readable
        interp_paragraphs.append(
            "Based on these findings, prompt attention is recommended. The treating doctor should review these results alongside the patient's full clinical picture, "
            "as X-ray findings alone do not always give a complete diagnosis. Additional tests may be needed to confirm what is going on and to guide the best treatment plan."
        )

        integrated_interpretation_str = "\n\n".join(interp_paragraphs)

        # -------------------------------------------------------------
        # 5. POSSIBLE DIAGNOSES
        # -------------------------------------------------------------
        diff_list = []
        diff_list.append(
            f"1. **{top_name}** — This is the most likely explanation for the findings on the X-ray. "
            f"{top_kb.get('desc', '').split('.')[0]}. Treatment and monitoring will depend on how the patient responds over the next few days."
        )

        if secondary_findings:
            for idx, sec in enumerate(secondary_findings[:3], start=2):
                sec_name = sec['disease']
                sec_kb = DISEASE_KNOWLEDGE_BASE.get(sec_name, {})
                short = sec_kb.get('desc', 'A possible secondary condition').split('.')[0]
                diff_list.append(
                    f"{idx}. **{sec_name}** — {short}. This may be happening alongside the main finding or as a result of it."
                )
        else:
            diff_list.append(
                "2. **Other possibilities** — Partial lung collapse (atelectasis), early infection, or normal variation in anatomy could also explain some of what is seen."
            )

        # Add key differentials from knowledge base in plain language
        raw_diffs = top_kb.get('differentials', '')
        if raw_diffs:
            diff_list.append(
                f"{len(diff_list)+1}. **Other conditions to rule out:**\n   {raw_diffs}"
            )

        possible_findings_str = "\n\n".join(diff_list)

        # -------------------------------------------------------------
        # 6. RECOMMENDED NEXT STEPS
        # -------------------------------------------------------------
        steps_list = []
        steps_list.append("### 1. Immediate Care")
        steps_list.append(top_kb.get('acute_management', '- Monitor oxygen levels and keep them above 92%.\n- Check vital signs regularly.'))

        steps_list.append("\n### 2. Further Tests & Imaging")
        steps_list.append(top_kb.get('diagnostic_steps', '- A bedside ultrasound of the chest may help get a clearer picture.\n- A CT scan of the chest may be ordered if more detail is needed.'))

        if secondary_findings:
            sec_top = secondary_findings[0]['disease']
            sec_top_kb = DISEASE_KNOWLEDGE_BASE.get(sec_top, {})
            steps_list.append(f"\n### 3. Managing Additional Findings ({sec_top})")
            steps_list.append(sec_top_kb.get('acute_management', '- Focus on clearing the airways and providing supportive care.'))

        steps_list.append(
            "\n### 4. Follow-Up\n"
            "- A licensed radiologist should formally review this report before any major treatment decisions are made.\n"
            "- A repeat chest X-ray in 48–72 hours is recommended to check if the condition is improving.\n"
            "- Blood tests including a full blood count and inflammatory markers (such as CRP) should be checked."
        )

        recommended_next_steps_str = "\n".join(steps_list)

        return {
            "clinical_context": context_p,
            "image_model_findings": image_model_findings_str,
            "clinical_information": clinical_info_str,
            "integrated_interpretation": integrated_interpretation_str,
            "possible_findings": possible_findings_str,
            "recommended_next_steps": recommended_next_steps_str
        }

