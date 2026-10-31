"""
Gated Fusion Module Stub — CliniFusion-X
===================================================

This module demonstrates the architectural design for fusing 
the Swin Transformer image feature vector with the structured 
clinical/symptom feature vector.

NOTE: This is a REFERENCE STUB. It is not currently wired into
the inference pipeline because using it requires fine-tuning 
the Swin model on NIH ChestX-ray14 with dual inputs (Image + Clinical).

Usage when retraining:
1. Extract (B, 768) image features from Swin (before the final classifier).
2. Encode patient symptoms into a (B, N) binary vector.
3. Feed both into GatedFusion.
4. Pass the fused output to the multi-label classifier head.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class GatedFusion(nn.Module):
    def __init__(self, img_dim=768, clin_dim=15, fused_dim=512):
        """
        Args:
            img_dim: Dimension of the image feature vector from Swin-Tiny
            clin_dim: Dimension of the clinical feature vector (e.g., number of tracked symptoms)
            fused_dim: Target dimension for the fused representation
        """
        super().__init__()
        
        # Project both to common dimension
        self.img_proj = nn.Linear(img_dim, fused_dim)
        self.clin_proj = nn.Linear(clin_dim, fused_dim)
        
        # Gating mechanism
        self.gate = nn.Sequential(
            nn.Linear(fused_dim * 2, fused_dim),
            nn.Sigmoid()
        )
        
    def forward(self, img_features: torch.Tensor, clin_features: torch.Tensor) -> torch.Tensor:
        """
        Args:
            img_features: Tensor of shape (B, img_dim)
            clin_features: Tensor of shape (B, clin_dim)
            
        Returns:
            fused_features: Tensor of shape (B, fused_dim)
        """
        # Project inputs
        h_img = F.relu(self.img_proj(img_features))
        h_clin = F.relu(self.clin_proj(clin_features))
        
        # Calculate gating vector using concatenated features
        concat_feats = torch.cat([h_img, h_clin], dim=-1)
        z = self.gate(concat_feats)
        
        # Gated fusion (element-wise multiplication)
        # The gate determines how much information from the clinical branch is added
        # to the image branch.
        fused = h_img + (z * h_clin)
        
        # L2 Normalize the fused vector for better training stability
        fused = F.normalize(fused, p=2, dim=1)
        
        return fused

class CliniFusionNet(nn.Module):
    """
    Example of the complete architecture integrating Swin + GatedFusion
    """
    def __init__(self, swin_backbone, clin_dim=15, num_classes=15):
        super().__init__()
        self.backbone = swin_backbone
        
        # Assume swin_backbone.num_features = 768
        self.fusion = GatedFusion(img_dim=768, clin_dim=clin_dim, fused_dim=512)
        
        # Final classifier
        self.classifier = nn.Linear(512, num_classes)
        
    def forward(self, image_tensor, clinical_tensor):
        # 1. Forward pass through Swin (extract features, skip the old classifier)
        # Note: timm models usually have a forward_features() method
        img_features = self.backbone.forward_features(image_tensor)
        
        # 2. Fuse features
        fused = self.fusion(img_features, clinical_tensor)
        
        # 3. Classify
        logits = self.classifier(fused)
        return logits
