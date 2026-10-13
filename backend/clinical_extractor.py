import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

def setup_gemini():
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        genai.configure(api_key=api_key)
        return genai.GenerativeModel('gemini-2.5-flash')
    except Exception as e:
        print(f"Gemini setup error: {e}")
        return None

def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        text = ""
        with fitz.open(pdf_path) as doc:
            for page in doc:
                text += page.get_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"Failed to read PDF: {e}")
        return ""

class ClinicalExtractor:
    def __init__(self):
        self.model = setup_gemini()

    def extract(self, text: str, pdf_path: str = None) -> Dict[str, Any]:
        combined_text = text if text else ""
        if pdf_path:
            pdf_text = extract_text_from_pdf(pdf_path)
            combined_text += f"\n{pdf_text}"
            
        combined_text = combined_text.strip()
        
        default_empty = {
            "age": None,
            "symptoms": [],
            "vitals": {},
            "lab_results": {},
            "clinical_history": [],
            "other_relevant_information": []
        }
        
        if not combined_text:
            return default_empty
            
        if not self.model:
            print("Warning: LLM_API_KEY not set. Cannot extract clinical info.")
            return default_empty

        prompt = f"""
        Extract the following clinical information from the text below. 
        Format your response ONLY as a valid JSON object matching this schema exactly:
        {{
            "age": null or integer,
            "symptoms": [list of strings],
            "vitals": {{key-value pairs}},
            "lab_results": {{key-value pairs}},
            "clinical_history": [list of strings],
            "other_relevant_information": [list of strings]
        }}
        
        If any information is missing or not provided, use null or an empty list/object.
        Do NOT invent or hallucinate any information.
        
        Text:
        {combined_text}
        """
        
        try:
            response = self.model.generate_content(prompt)
            # Find json block in the response
            resp_text = response.text.strip()
            if resp_text.startswith("```json"):
                resp_text = resp_text[7:-3].strip()
            elif resp_text.startswith("```"):
                resp_text = resp_text[3:-3].strip()
                
            data = json.loads(resp_text)
            return data
        except Exception as e:
            print(f"LLM Extraction failed: {e}")
            return default_empty
