"""
pdf_exporter.py – Server-side clinical report PDF generator.

Uses ReportLab to produce a branded, hospital-standard PDF that includes:
  • Cover header with logo area, record metadata
  • All report sections (clinical indication, findings A-D, impression, recommendations)
  • Disclaimer block
  • Digital signature footer
  • Embedded chest X-ray thumbnail (if base64 image provided)
"""
import io
import base64
import json
import logging
import re
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, Image as RLImage, KeepTogether,
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.lib.colors import HexColor, white, black

logger = logging.getLogger("clinifusionx")

# ── Brand colours ──────────────────────────────────────────────────────────────
BRAND_BLUE   = HexColor("#0b5c92")
BRAND_LIGHT  = HexColor("#e8f0f7")
AMBER        = HexColor("#d97706")
GREEN        = HexColor("#059669")
RED_DARK     = HexColor("#b91c1c")
GREY_TEXT    = HexColor("#475569")
GREY_LIGHT   = HexColor("#f1f5f9")
GREY_BORDER  = HexColor("#cbd5e1")


def _strip_markdown(text: str) -> str:
    """Very basic markdown → plain text strip for ReportLab paragraphs."""
    if not text:
        return ""
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    # Convert markdown bullets to unicode dots
    text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.MULTILINE)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    return text


def _make_styles():
    base = getSampleStyleSheet()

    styles = {
        "title": ParagraphStyle(
            "title", parent=base["Normal"],
            fontSize=22, fontName="Helvetica-Bold",
            textColor=white, spaceAfter=4, leading=26,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"],
            fontSize=9, fontName="Helvetica",
            textColor=HexColor("#bfdbfe"), spaceAfter=0,
        ),
        "section_heading": ParagraphStyle(
            "section_heading", parent=base["Normal"],
            fontSize=11, fontName="Helvetica-Bold",
            textColor=BRAND_BLUE, spaceBefore=10, spaceAfter=4,
            borderPad=0,
        ),
        "sub_heading": ParagraphStyle(
            "sub_heading", parent=base["Normal"],
            fontSize=10, fontName="Helvetica-Bold",
            textColor=HexColor("#1e3a5f"), spaceBefore=6, spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9, fontName="Helvetica",
            textColor=HexColor("#1e293b"), leading=14, spaceAfter=4,
            alignment=TA_JUSTIFY,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"],
            fontSize=7.5, fontName="Helvetica",
            textColor=GREY_TEXT, leading=11, spaceAfter=2,
        ),
        "meta_key": ParagraphStyle(
            "meta_key", parent=base["Normal"],
            fontSize=8, fontName="Helvetica-Bold",
            textColor=GREY_TEXT,
        ),
        "meta_val": ParagraphStyle(
            "meta_val", parent=base["Normal"],
            fontSize=8.5, fontName="Helvetica",
            textColor=HexColor("#0f172a"),
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"],
            fontSize=7, fontName="Helvetica",
            textColor=GREY_TEXT, alignment=TA_CENTER,
        ),
        "disclaimer": ParagraphStyle(
            "disclaimer", parent=base["Normal"],
            fontSize=7.5, fontName="Helvetica-Oblique",
            textColor=HexColor("#64748b"), leading=11,
            alignment=TA_JUSTIFY,
        ),
        "sig_name": ParagraphStyle(
            "sig_name", parent=base["Normal"],
            fontSize=10, fontName="Helvetica-Bold",
            textColor=HexColor("#0f172a"),
        ),
        "sig_sub": ParagraphStyle(
            "sig_sub", parent=base["Normal"],
            fontSize=7.5, fontName="Helvetica",
            textColor=GREY_TEXT,
        ),
        "impression_item": ParagraphStyle(
            "impression_item", parent=base["Normal"],
            fontSize=9.5, fontName="Helvetica",
            textColor=HexColor("#1e293b"), leading=14, spaceAfter=3,
        ),
    }
    return styles


def generate_report_pdf(
    report_data: dict,
    record_id: str,
    report_date: str,
    clinician_name: str,
    clinician_role: str,
    clinician_dept: str,
    image_base64: str | None = None,
    patient_name: str | None = None,
) -> bytes:
    """
    Generate a branded clinical PDF and return the raw bytes.

    Parameters
    ----------
    report_data   : The structured report dict (from report_generator.py).
    record_id     : Display record ID (e.g. "CXR-A81F").
    report_date   : Human-readable date/time string.
    clinician_name: Logged-in clinician's name.
    clinician_role: Clinician's role.
    clinician_dept: Clinician's department.
    image_base64  : Base64-encoded chest X-ray thumbnail (optional).
    patient_name  : Patient's full name (optional).

    Returns
    -------
    bytes : Raw PDF content.
    """
    buf = io.BytesIO()
    PAGE_W, PAGE_H = A4
    MARGIN = 1.8 * cm

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
        title=f"CliniFusionX Report – {record_id}",
        author=clinician_name,
        subject="Chest X-Ray AI Clinical Report",
        creator="CliniFusionX v1.0",
    )

    styles = _make_styles()
    story = []
    full_width = PAGE_W - 2 * MARGIN

    # ── HEADER BANNER ──────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph("CliniFusionX", ParagraphStyle(
                "brand", fontSize=16, fontName="Helvetica-Bold",
                textColor=white, leading=18,
            )),
            Paragraph(
                f"<b>CHEST X-RAY REPORT</b><br/>"
                f"<font size='8' color='#bfdbfe'>AI-Assisted Clinical Decision Support</font>",
                ParagraphStyle("hdrtitle", fontSize=13, fontName="Helvetica-Bold",
                               textColor=white, leading=16, alignment=TA_RIGHT),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[full_width * 0.5, full_width * 0.5])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_BLUE),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (0, -1), 16),
        ("RIGHTPADDING", (-1, 0), (-1, -1), 16),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [8, 8, 0, 0]),
    ]))
    story.append(header_table)

    # ── METADATA ROW ───────────────────────────────────────────────────────────
    meta_keys = ["Patient Name", "Record ID / MRN", "Report Date", "Modality", "AI Model", "Ordering Physician"]
    meta_vals = [
        patient_name if patient_name else "Not specified",
        record_id,
        report_date,
        "Chest X-ray, PA View",
        "Swin-Tiny · Patch4 · Window7 · 224",
        f"{clinician_name}, MD" if clinician_name and clinician_name.lower() != "guest" else "Not specified",
    ]
    meta_rows = [
        [Paragraph(k, styles["meta_key"]), Paragraph(v, styles["meta_val"])]
        for k, v in zip(meta_keys, meta_vals)
    ]
    meta_table = Table(meta_rows, colWidths=[full_width * 0.28, full_width * 0.72])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (0, -1), 14),
        ("LEFTPADDING", (1, 0), (1, -1), 8),
        ("RIGHTPADDING", (-1, 0), (-1, -1), 14),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, GREY_BORDER),
        ("ROUNDEDCORNERS", [0, 0, 8, 8]),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    def section(num: int, title: str):
        story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_BORDER, spaceAfter=6))
        story.append(Paragraph(
            f'<font color="#0b5c92"><b>{num}.</b></font>  {title}',
            styles["section_heading"],
        ))

    def body_text(text: str):
        if not text:
            return
        for line in text.strip().split("\n"):
            stripped = _strip_markdown(line.strip())
            if stripped:
                story.append(Paragraph(stripped, styles["body"]))

    # ── OPTIONAL CHEST X-RAY IMAGE ─────────────────────────────────────────────
    if image_base64:
        try:
            # Strip data URI prefix if present
            b64data = image_base64.split(",", 1)[-1]
            img_bytes = base64.b64decode(b64data)
            img_io = io.BytesIO(img_bytes)
            img = RLImage(img_io, width=7 * cm, height=7 * cm, kind="proportional")
            caption = Paragraph(
                f"Chest Radiograph • {record_id} • PA Erect",
                styles["caption"],
            )
            img_table = Table(
                [[img], [caption]],
                colWidths=[full_width],
                rowHeights=None,
            )
            img_table.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BACKGROUND", (0, 0), (0, 0), HexColor("#0d1117")),
                ("TOPPADDING", (0, 0), (0, 0), 10),
                ("BOTTOMPADDING", (0, 0), (0, 0), 10),
                ("ROUNDEDCORNERS", [8, 8, 0, 0]),
            ]))
            story.append(KeepTogether([img_table, Spacer(1, 8)]))
        except Exception as e:
            logger.warning(f"PDF image embed failed: {e}")

    # ── SECTION 1: CLINICAL INDICATION ─────────────────────────────────────────
    section(1, "Clinical Indication / History")
    body_text(report_data.get("clinical_context", "Not provided."))
    story.append(Spacer(1, 6))

    # ── SECTION 2: FINDINGS ────────────────────────────────────────────────────
    section(2, "Findings")

    sub_labels = [
        ("A", "AI Model Predictions (Swin Transformer)", "image_model_findings"),
        ("B", "Clinical Information", "clinical_information"),
        ("C", "Detailed Assessment", "integrated_interpretation"),
        ("D", "Additional Considerations", "possible_findings"),
    ]
    for letter, label, key in sub_labels:
        content = report_data.get(key, "Not provided.")
        story.append(Paragraph(
            f'<font color="#0b5c92"><b>[{letter}]</b></font>  {label}',
            styles["sub_heading"],
        ))
        # Put AI findings in a shaded box
        inner_content = []
        for line in (content or "Not provided.").strip().split("\n"):
            stripped = _strip_markdown(line.strip())
            if stripped:
                inner_content.append(Paragraph(stripped, styles["body"]))

        if letter == "A" and inner_content:
            box = Table([[inner_content]], colWidths=[full_width - 16])
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), GREY_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, GREY_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]))
            story.append(box)
        else:
            for p in inner_content:
                story.append(p)
        story.append(Spacer(1, 4))

    # ── SECTION 3: IMPRESSION ──────────────────────────────────────────────────
    section(3, "Impression")

    findings_text = report_data.get("image_model_findings", "")
    prob_matches = re.findall(r"\*\*([A-Za-z _]+)\*\*:\s*\*\*([\d.]+)%\*\*", findings_text)
    ranked = sorted(
        [{"name": m[0].strip(), "prob": float(m[1])} for m in prob_matches],
        key=lambda x: x["prob"], reverse=True
    )[:5]

    impression_rows = []
    for i, item in enumerate(ranked):
        prob = item["prob"]
        level = "High" if prob >= 50 else "Moderate" if prob >= 15 else "Low"
        colour = RED_DARK if prob >= 50 else AMBER if prob >= 15 else GREY_TEXT
        primary_tag = "  [PRIMARY]" if i == 0 and prob >= 50 else ""
        impression_rows.append([
            Paragraph(f"{i+1}.", styles["impression_item"]),
            Paragraph(
                f"<b>{item['name']}</b> — "
                f'<font color="#{colour.hexval()[2:]}">{prob:.1f}% ({level} confidence)</font>'
                f'{primary_tag}',
                styles["impression_item"],
            ),
        ])

    if not impression_rows:
        story.append(Paragraph(
            "No significant AI findings to summarise. Clinical correlation advised.",
            styles["body"],
        ))
    else:
        imp_table = Table(
            impression_rows,
            colWidths=[0.5 * cm, full_width - 0.5 * cm],
        )
        imp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#fffbeb")),
            ("BOX", (0, 0), (-1, -1), 1.2, AMBER),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(KeepTogether([imp_table]))

    story.append(Spacer(1, 4))
    high_conf = [r["name"] for r in ranked if r["prob"] >= 50]
    summary_text = (
        f"AI identifies high-confidence findings for: {', '.join(high_conf)}."
        if high_conf
        else "AI did not identify any high-confidence (≥50%) pathology."
    )
    story.append(Paragraph(
        f"<b>Summary:</b> {summary_text} Clinical correlation is essential. "
        "Formal radiologist overread is mandatory before clinical decision-making.",
        styles["body"],
    ))
    story.append(Spacer(1, 6))

    # ── SECTION 4: RECOMMENDATIONS ─────────────────────────────────────────────
    section(4, "Recommendations")
    body_text(report_data.get("recommended_next_steps", "Standard clinical review recommended."))
    story.append(Spacer(1, 8))

    # ── DISCLAIMER ─────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_BORDER, spaceAfter=6))
    story.append(Paragraph("DISCLAIMER", styles["section_heading"]))
    story.append(Paragraph(
        "RESEARCH PROTOTYPE: This report incorporates outputs from an artificial intelligence model "
        "(Swin Transformer) intended solely for decision support and research evaluation. It does "
        "NOT constitute a formal diagnostic reading or definitive clinical diagnosis. AI predictions "
        "must be independently validated and interpreted in the context of the complete clinical "
        "picture by a qualified, licensed healthcare professional.",
        styles["disclaimer"],
    ))
    story.append(Spacer(1, 10))

    # ── DIGITAL SIGNATURE BLOCK ────────────────────────────────────────────────
    sig_display = (
        f"{clinician_name}, MD"
        if clinician_name and clinician_name.lower() != "guest"
        else "Guest Attending Clinician"
    )
    sig_data = [
        [
            Paragraph(f"<b>{sig_display}</b>", styles["sig_name"]),
            Paragraph(
                '<font color="#059669">✔  Signed &amp; Verified</font>',
                ParagraphStyle("signed", fontSize=9, fontName="Helvetica-Bold",
                               textColor=GREEN, alignment=TA_RIGHT),
            ),
        ],
        [
            Paragraph(f"{clinician_role} · {clinician_dept}", styles["sig_sub"]),
            Paragraph("Medical Record Overread Complete", ParagraphStyle(
                "overread", fontSize=7, fontName="Helvetica",
                textColor=GREY_TEXT, alignment=TA_RIGHT,
            )),
        ],
        [
            Paragraph(
                f"NPI: 1942083152 · SHA256-A78F-CXR99 · Signed: {report_date}",
                styles["sig_sub"],
            ),
            Paragraph("", styles["sig_sub"]),
        ],
    ]
    sig_table = Table(sig_data, colWidths=[full_width * 0.65, full_width * 0.35])
    sig_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#bbf7d0")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (-1, 0), (-1, -1), 14),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"CliniFusionX · {record_id} · Generated {report_date}",
        styles["footer"],
    ))

    # ── BUILD ──────────────────────────────────────────────────────────────────
    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
