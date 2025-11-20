"""
Stock photo detection utility for animal listings.
Uses simple heuristics and can be extended with ML models.
"""

import hashlib
import requests
from django.core.files.base import ContentFile
from PIL import Image
import io


class StockPhotoDetector:
    """Detect stock photos in animal listings."""

    # Common stock photo watermarks/patterns
    WATERMARKS = [
        "shutterstock",
        "getty",
        "istockphoto",
        "adobe",
        "istock",
        "alamy",
        "dreamstime",
        "123rf",
        "pond5",
        "fotolia",
    ]

    @staticmethod
    def check_image_metadata(image_url: str) -> dict:
        """
        Check image metadata for stock photo indicators.
        
        Returns:
            dict with confidence score and reasons
        """
        try:
            response = requests.get(image_url, timeout=10)
            if response.status_code != 200:
                return {"is_stock": False, "confidence": 0.0, "reasons": []}

            image = Image.open(io.BytesIO(response.content))
            exif_data = image._getexif() if hasattr(image, "_getexif") else {}
            
            reasons = []
            confidence = 0.0

            # Check for common stock photo metadata
            if exif_data:
                exif_str = str(exif_data).lower()
                for watermark in StockPhotoDetector.WATERMARKS:
                    if watermark in exif_str:
                        reasons.append(f"Found watermark: {watermark}")
                        confidence += 0.3

            # Check image dimensions (stock photos often have specific aspect ratios)
            width, height = image.size
            aspect_ratio = width / height if height > 0 else 1

            # Common stock photo dimensions
            common_ratios = [16/9, 4/3, 1/1, 3/2]  # 16:9, 4:3, 1:1, 3:2
            for ratio in common_ratios:
                if abs(aspect_ratio - ratio) < 0.1:
                    reasons.append(f"Common stock photo aspect ratio: {aspect_ratio:.2f}")
                    confidence += 0.15
                    break

            # Check for very high image quality (>5000px width typically stock)
            if width > 5000 or height > 5000:
                reasons.append("Very high resolution suggests professional/stock image")
                confidence += 0.1

            return {
                "is_stock": confidence > 0.5,
                "confidence": min(confidence, 1.0),
                "reasons": reasons
            }

        except Exception as e:
            return {
                "is_stock": False,
                "confidence": 0.0,
                "reasons": [f"Error analyzing image: {str(e)}"]
            }

    @staticmethod
    def check_reverse_image_search(image_url: str) -> dict:
        """
        Check if image appears in reverse image searches (simplified).
        In production, use Google Vision API or TinEye API.
        
        For now, returns placeholder response.
        Returns:
            dict with stock photo indicators
        """
        # In production environment, integrate with:
        # - Google Vision API (SafeSearchAnnotation)
        # - TinEye API (reverse image search)
        # - Microsoft Computer Vision (adult/racy content detection)
        
        return {
            "is_stock": False,
            "confidence": 0.0,
            "reasons": ["Reverse image search not configured in development"]
        }

    @classmethod
    def detect(cls, image_url: str) -> tuple[bool, float]:
        """
        Main detection method.
        
        Args:
            image_url: URL to image to analyze
            
        Returns:
            tuple (is_stock_photo: bool, confidence: float 0-1)
        """
        metadata_result = cls.check_image_metadata(image_url)
        
        # Could combine with reverse image search in production
        # reverse_result = cls.check_reverse_image_search(image_url)
        # combined_confidence = max(metadata_result["confidence"], reverse_result["confidence"])
        
        return (
            metadata_result["is_stock"],
            metadata_result["confidence"]
        )
