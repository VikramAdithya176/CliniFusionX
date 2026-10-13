import torch
import timm
import json
from pathlib import Path

def load_config(config_path="config.json"):
    with open(config_path, "r") as f:
        return json.load(f)

def create_model(model_name="swin_tiny_patch4_window7_224", num_classes=15, pretrained=False):
    return timm.create_model(
        model_name,
        pretrained=pretrained,
        num_classes=num_classes
    )

def load_model(weights_path="best_swin_chestxray14.pth", config_path="config.json", device=None):
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    config = load_config(config_path)
    model = create_model(model_name=config.get("model_name", "swin_tiny_patch4_window7_224"), num_classes=config.get("num_classes", 15))

    try:
        checkpoint = torch.load(weights_path, map_location=device, weights_only=False)
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif isinstance(checkpoint, dict):
            state_dict = checkpoint
        else:
            raise ValueError("Unsupported checkpoint format.")
        
        model.load_state_dict(state_dict)
    except Exception as e:
        print(f"Failed to load checkpoint: {e}")
        # Continue with uninitialized weights if model not found for dev purposes,
        # but in production we'd want this to fail or handle gracefully.
        raise e

    model.to(device)
    model.eval()

    return model, device
