import json
import torch
from pathlib import Path
from PIL import Image
from torchvision import transforms
from model import load_model, load_config
import numpy as np

class InferenceEngine:
    def __init__(self, weights_path="best_swin_chestxray14.pth", config_path="config.json", labels_path="labels.json", thresholds_path="thresholds.json"):
        self.base_dir = Path(__file__).resolve().parent
        self.config = load_config(self.base_dir / config_path)
        
        with open(self.base_dir / labels_path, "r", encoding="utf-8") as f:
            self.class_names = json.load(f)
            
        with open(self.base_dir / thresholds_path, "r", encoding="utf-8") as f:
            self.thresholds = json.load(f)
            
        weights_file = self.base_dir / weights_path
        if not weights_file.exists() and (self.base_dir.parent / weights_path).exists():
            weights_file = self.base_dir.parent / weights_path
            
        self.model, self.device = load_model(weights_file, self.base_dir / config_path)
        
        # Preprocessing setup
        mean = self.config.get("normalization", {}).get("mean", [0.485, 0.456, 0.406])
        std = self.config.get("normalization", {}).get("std", [0.229, 0.224, 0.225])
        self.image_size = self.config.get("image_size", 224)
        self.resize_size = self.config.get("resize_size", 256)

        self.transform = transforms.Compose([
            transforms.Resize((self.resize_size, self.resize_size)),
            transforms.CenterCrop(self.image_size),
            transforms.ToTensor(),
            transforms.Normalize(mean, std)
        ])

    def preprocess_image(self, image_data):
        # image_data can be path or PIL Image
        if isinstance(image_data, (str, Path)):
            image = Image.open(image_data).convert("RGB")
        elif isinstance(image_data, Image.Image):
            image = image_data.convert("RGB")
        else:
            raise ValueError("Unsupported image type")
            
        return self.transform(image).unsqueeze(0)

    def predict(self, image_data):
        image_tensor = self.preprocess_image(image_data).to(self.device)

        with torch.no_grad():
            logits = self.model(image_tensor)
            probabilities = torch.sigmoid(logits)[0].cpu().tolist()

        results = []
        for name, probability in zip(self.class_names, probabilities):
            threshold = float(self.thresholds[name])
            results.append({
                "disease": name,
                "probability": round(float(probability), 4),
                "threshold": round(threshold, 4),
                "detected": bool(probability >= threshold)
            })

        return results
