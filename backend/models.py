from sqlalchemy import Column, String, Integer, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    username = Column(String, primary_key=True, index=True)
    password_hash = Column(String)
    name = Column(String)
    role = Column(String)
    department = Column(String)

class Patient(Base):
    __tablename__ = "patients"
    
    mrn = Column(String, primary_key=True, index=True) # Medical Record Number
    first_name = Column(String)
    last_name = Column(String)
    date_of_birth = Column(String)
    sex = Column(String)
    
    records = relationship("AnalysisRecord", back_populates="patient")

class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    patient_id = Column(String, ForeignKey("patients.mrn"), nullable=True, index=True)
    
    timestamp = Column(Integer)
    date = Column(String)
    status = Column(String)
    
    # Store complex nested data as JSON strings
    findings = Column(Text)
    top_finding = Column(Text)
    report = Column(Text)
    
    # Clinical input (fallback if not tied to a formal patient record)
    age = Column(String)
    sex = Column(String)
    clinical_text = Column(Text)
    
    # The image (base64 string or path)
    image_preview = Column(Text)
    
    patient = relationship("Patient", back_populates="records")
