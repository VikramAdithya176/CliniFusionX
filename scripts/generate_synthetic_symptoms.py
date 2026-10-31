"""
Generate Synthetic Symptoms for NIH ChestX-ray14
===================================================

This script reads a mock or real NIH labels CSV and generates 
a synthetic symptom vector for each patient based on the 
CCM rules (ccm.py) with added noise to make it realistic.

You need a CSV with at least:
- Image Index (filename)
- Finding Labels (pipe-separated e.g. "Atelectasis|Effusion")
"""

import pandas as pd
import numpy as np
import random
from ccm import SYMPTOM_KB, DISEASE_KB, normalize_symptom

# Collect all unique canonical symptoms — primary AND secondary — across all diseases
ALL_CANONICAL_SYMPTOMS = sorted(list(set(
    sym
    for disease, info in DISEASE_KB.items()
    for sym in (info.get("primary", []) + info.get("secondary", []))
)))
NUM_SYMPTOMS = len(ALL_CANONICAL_SYMPTOMS)
print(f"Total canonical symptoms tracked: {NUM_SYMPTOMS} "
      f"(primary + secondary from {len(DISEASE_KB)} diseases)")

def generate_symptoms_for_labels(
    labels_str: str,
    base_prob: float = 0.80,
    secondary_prob: float = 0.40,
    noise_prob: float = 0.05,
):
    """
    Given a string of labels (e.g. 'Atelectasis|Effusion'), return a binary vector
    of symptoms of length NUM_SYMPTOMS.

    Primary symptoms are sampled at `base_prob`.
    Secondary (context-dependent) symptoms are sampled at `secondary_prob`.
    Unrelated symptoms appear with background `noise_prob`.
    """
    labels = [L.strip() for L in labels_str.split('|')]

    # 1. Gather primary and secondary symptom sets for the given diseases
    primary_symptoms: set = set()
    secondary_symptoms: set = set()
    for lbl in labels:
        if lbl in DISEASE_KB:
            primary_symptoms.update(DISEASE_KB[lbl].get("primary", []))
            secondary_symptoms.update(DISEASE_KB[lbl].get("secondary", []))

    # Secondary symptoms that are NOT already primary get lower probability
    secondary_only = secondary_symptoms - primary_symptoms

    # 2. Generate binary vector
    symptom_vector = []
    for sym in ALL_CANONICAL_SYMPTOMS:
        if sym in primary_symptoms:
            # Primary: patient has high chance (base_prob)
            has_symptom = 1 if random.random() < base_prob else 0
        elif sym in secondary_only:
            # Secondary / context-dependent: lower chance (secondary_prob)
            has_symptom = 1 if random.random() < secondary_prob else 0
        else:
            # Unrelated symptom: background noise (noise_prob)
            has_symptom = 1 if random.random() < noise_prob else 0

        symptom_vector.append(has_symptom)

    return symptom_vector

def main(input_csv="dummy_nih_labels.csv", output_csv="nih_with_symptoms.csv"):
    try:
        df = pd.read_csv(input_csv)
    except FileNotFoundError:
        print(f"File {input_csv} not found. Creating a dummy CSV for testing...")
        # Create a dummy CSV for demonstration purposes
        df = pd.DataFrame({
            'Image Index': ['00000001_000.png', '00000001_001.png', '00000002_000.png'],
            'Finding Labels': ['Pneumonia|Effusion', 'No Finding', 'Cardiomegaly']
        })
        df.to_csv(input_csv, index=False)
        print(f"Created {input_csv}")
        
    print(f"Reading {len(df)} rows from {input_csv}...")
    
    # Generate vectors
    symptom_matrix = []
    for idx, row in df.iterrows():
        vec = generate_symptoms_for_labels(row.get('Finding Labels', 'No Finding'))
        symptom_matrix.append(vec)
        
    # Append as new columns
    symptom_df = pd.DataFrame(symptom_matrix, columns=ALL_CANONICAL_SYMPTOMS)
    out_df = pd.concat([df, symptom_df], axis=1)
    
    out_df.to_csv(output_csv, index=False)
    print(f"Saved dataset with synthetic symptoms to: {output_csv}")
    print("\nSample Output:")
    print(out_df.head(3))
    
    print("\nDone! You can now use this CSV in train_fusion.py")

if __name__ == "__main__":
    main()
