import PDFDocument from "pdfkit";

export async function generateAdmissionPDF(lead: any): Promise<Buffer> {
  const app = lead.confirmedApplication;

  function formatGender(value?: string | null): string {
    if (!value) return "—";
    if (value === "MALE") return "Male";
    if (value === "FEMALE") return "Female";
    if (value === "OTHER") return "Other";
    return value;
  }

  function formatMaritalStatus(value?: string | null): string {
    if (!value) return "—";
    if (value === "SINGLE") return "Single";
    if (value === "MARRIED") return "Married";
    return value;
  }

  // Pre-fetch passport photo if one has been uploaded
  let photoBuffer: Buffer | null = null;
  const photoDoc = app?.documents?.find((d: any) =>
    d.documentType?.name?.toLowerCase().includes("photo"),
  );
  if (photoDoc?.fileUrl) {
    try {
      const res = await fetch(photoDoc.fileUrl as string);
      if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // silently fall back to placeholder text
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = 515;
    const LEFT = 40;

    // ─── helpers ───────────────────────────────────────────────────

    function sectionHeader(title: string, y: number, color = "#005826") {
      doc.rect(LEFT, y, W, 16).fillAndStroke(color, color);
      doc
        .fillColor("#fff")
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text(title, LEFT + 6, y + 4, { width: W - 12 });
      doc.fillColor("#000");
      return y + 16;
    }

    function cell(
      text: string,
      x: number,
      y: number,
      w: number,
      h: number,
      opts?: object,
    ) {
      doc.rect(x, y, w, h).lineWidth(0.4).stroke();
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#000")
        .text(text ?? "", x + 4, y + 4, {
          width: w - 8,
          height: h - 8,
          ...opts,
        });
    }

    function labelCell(
      label: string,
      value: string,
      x: number,
      y: number,
      labelW: number,
      totalW: number,
      h = 18,
    ) {
      // Label box
      doc.rect(x, y, labelW, h).lineWidth(0.4).stroke();
      doc
        .fillColor("#555")
        .fontSize(7)
        .font("Helvetica-Bold")
        .text(label, x + 4, y + (h - 7) / 2, { width: labelW - 8 });
      // Value box
      doc
        .rect(x + labelW, y, totalW - labelW, h)
        .lineWidth(0.4)
        .stroke();
      doc
        .fillColor("#000")
        .fontSize(8)
        .font("Helvetica")
        .text(value ?? "", x + labelW + 4, y + (h - 8) / 2, {
          width: totalW - labelW - 8,
        });
    }

    // ─── PAGE 1 HEADER ────────────────────────────────────────────
    // Header height = 135pt ≈ 45mm (standard passport photo height)

    const HDR_H = 135;
    const PHOTO_W = 110;

    // Outer border
    doc.rect(LEFT, 40, W, HDR_H).lineWidth(1).stroke();

    // Left panel — file/adm IDs
    doc.rect(LEFT, 40, 110, HDR_H).lineWidth(0.5).stroke();
    doc
      .fillColor("#555")
      .fontSize(6.5)
      .font("Helvetica-Bold")
      .text("FILE NO.", LEFT + 5, 50, { width: 100 });
    doc
      .fillColor("#000")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(app?.fileNumber ?? "—", LEFT + 5, 60, { width: 100 });
    doc
      .fillColor("#555")
      .fontSize(6.5)
      .font("Helvetica-Bold")
      .text("ADM ID", LEFT + 5, 90, { width: 100 });
    doc
      .fillColor("#000")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(app?.admissionId ?? "—", LEFT + 5, 100, { width: 100 });
    doc
      .fillColor("#999")
      .fontSize(6)
      .font("Helvetica")
      .text("For Office Use Only", LEFT + 5, 126, { width: 100 });
    doc.fillColor("#000");

    // Center panel — institute name + address + form title
    doc
      .fillColor("#006400")
      .fontSize(17)
      .font("Helvetica-Bold")
      .text("FUTURE EDUCATION", LEFT + 110, 52, {
        width: W - 110 - PHOTO_W,
        align: "center",
      });
    doc
      .fillColor("#333")
      .fontSize(8)
      .font("Helvetica")
      .text(
        lead.branch?.address ??
          "HE-9, 1st Floor, City Centre, Sec-4, Bokaro Steel City – 827004",
        LEFT + 110,
        78,
        { width: W - 110 - PHOTO_W, align: "center" },
      );
    doc
      .fillColor("#006400")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("ADMISSION ASSISTANCE FORM", LEFT + 110, 104, {
        width: W - 110 - PHOTO_W,
        align: "center",
      });
    doc.fillColor("#000");

    // Right panel — passport photo box (110 × 135 ≈ 35mm × 45mm)
    doc
      .rect(LEFT + W - PHOTO_W, 40, PHOTO_W, HDR_H)
      .lineWidth(0.5)
      .stroke();
    if (photoBuffer) {
      try {
        doc.save();
        doc.rect(LEFT + W - PHOTO_W + 1, 41, PHOTO_W - 2, HDR_H - 2).clip();
        doc.image(photoBuffer, LEFT + W - PHOTO_W + 1, 41, {
          width: PHOTO_W - 2,
          height: HDR_H - 2,
          cover: [PHOTO_W - 2, HDR_H - 2],
        });
        doc.restore();
      } catch {
        doc
          .fillColor("#aaa")
          .fontSize(7)
          .font("Helvetica")
          .text(
            "Photo unavailable",
            LEFT + W - PHOTO_W + 2,
            40 + HDR_H / 2 - 4,
            {
              width: PHOTO_W - 4,
              align: "center",
            },
          );
      }
    } else {
      const midY = 40 + HDR_H / 2;
      doc
        .fillColor("#aaa")
        .fontSize(7)
        .font("Helvetica")
        .text("Passport size", LEFT + W - PHOTO_W + 2, midY - 10, {
          width: PHOTO_W - 4,
          align: "center",
        })
        .text("photograph", LEFT + W - PHOTO_W + 2, midY, {
          width: PHOTO_W - 4,
          align: "center",
        });
    }
    doc.fillColor("#000");

    let y = 40 + HDR_H + 4;

    // Branch row
    doc.rect(LEFT, y, W, 18).lineWidth(0.4).stroke();
    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("BRANCH:", LEFT + 4, y + 5);
    doc
      .fillColor("#000")
      .fontSize(8)
      .font("Helvetica")
      .text(lead.branch?.name ?? "", LEFT + 58, y + 5);
    y += 18;

    // Programme + Branch city row
    doc
      .rect(LEFT, y, W / 2, 18)
      .lineWidth(0.4)
      .stroke();
    doc
      .rect(LEFT + W / 2, y, W / 2, 18)
      .lineWidth(0.4)
      .stroke();
    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("PROGRAMME:", LEFT + 4, y + 5);
    doc
      .fillColor("#000")
      .fontSize(8)
      .font("Helvetica")
      .text(lead.courses?.[0]?.course?.name ?? "", LEFT + 70, y + 5, {
        width: W / 2 - 74,
      });
    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("CITY:", LEFT + W / 2 + 4, y + 5);
    doc
      .fillColor("#000")
      .fontSize(8)
      .font("Helvetica")
      .text(lead.branch?.city ?? "", LEFT + W / 2 + 38, y + 5);
    y += 22;

    // ─── AADHAR + APAAR (above name, as requested) ───────────────

    doc.rect(LEFT, y, W, 16).fillAndStroke("#003d1a", "#003d1a");
    doc
      .fillColor("#fff")
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .text("Identity / ID Numbers", LEFT + 6, y + 4, { width: W - 12 });
    doc.fillColor("#000");
    y += 16;

    const idH = 22;
    labelCell("Aadhar No.", app?.aadharNo ?? "", LEFT, y, 90, W / 2, idH);
    labelCell(
      "Apaar / ABC ID",
      app?.apaarId ?? "",
      LEFT + W / 2,
      y,
      100,
      W / 2,
      idH,
    );
    y += idH + 6;

    // ─── APPLICANT NAME ──────────────────────────────────────────

    doc.rect(LEFT, y, W, 14).lineWidth(0.4).stroke();
    doc
      .fillColor("#555")
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .text("Name of the Applicant (as per Matric record):", LEFT + 4, y + 3);
    y += 14;

    const name = (lead.studentName ?? "").toUpperCase().padEnd(30, " ");
    const boxW = Math.floor(W / 30);
    for (let i = 0; i < 30; i++) {
      doc
        .rect(LEFT + i * boxW, y, boxW, 22)
        .lineWidth(0.4)
        .stroke();
      if (name[i] && name[i] !== " ") {
        doc
          .fillColor("#000")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(name[i]!, LEFT + i * boxW + 3, y + 6);
      }
    }
    y += 26;

    // Gender / Marital status / DOB
    doc.rect(LEFT, y, 90, 20).lineWidth(0.4).stroke();
    doc
      .rect(LEFT + 90, y, 110, 20)
      .lineWidth(0.4)
      .stroke();
    doc
      .rect(LEFT + 200, y, W - 200, 20)
      .lineWidth(0.4)
      .stroke();

    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("Gender:", LEFT + 4, y + 6);
    doc
      .fillColor("#000")
      .fontSize(7.5)
      .font("Helvetica")
      .text(formatGender(lead.gender), LEFT + 42, y + 6);

    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("Marital Status:", LEFT + 94, y + 6);
    doc
      .fillColor("#000")
      .fontSize(7.5)
      .font("Helvetica")
      .text(formatMaritalStatus(lead.maritalStatus), LEFT + 144, y + 6);

    doc
      .fillColor("#555")
      .fontSize(7)
      .font("Helvetica-Bold")
      .text("Date of Birth:", LEFT + 204, y + 6);
    const dob = lead.dateOfBirth
      ? new Date(lead.dateOfBirth).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";
    doc
      .fillColor("#000")
      .fontSize(8)
      .font("Helvetica")
      .text(dob, LEFT + 278, y + 6);
    y += 20;

    // ─── ADDRESS ─────────────────────────────────────────────────

    y = sectionHeader("Contact & Address Details", y);

    const addrH = 18;
    labelCell(
      "Postal Address",
      app?.postalAddress ?? "",
      LEFT,
      y,
      100,
      W,
      addrH,
    );
    y += addrH;
    labelCell("Mobile / Tel.", lead.phone ?? "", LEFT, y, 90, W / 2, addrH);
    labelCell("Email", lead.email ?? "", LEFT + W / 2, y, 42, W / 2, addrH);
    y += addrH;
    labelCell(
      "Permanent Address",
      app?.permanentAddress ?? "",
      LEFT,
      y,
      100,
      W,
      addrH,
    );
    y += addrH;
    labelCell(
      "Perm. Mobile",
      app?.permanentPhone ?? "",
      LEFT,
      y,
      90,
      W / 2,
      addrH,
    );
    labelCell(
      "Nationality",
      app?.nationality ?? "",
      LEFT + W / 2,
      y,
      80,
      W / 2,
      addrH,
    );
    y += addrH;
    labelCell("Religion", app?.religion ?? "", LEFT, y, 70, W / 2, addrH);
    labelCell(
      "Category",
      app?.category ?? "",
      LEFT + W / 2,
      y,
      70,
      W / 2,
      addrH,
    );
    y += addrH + 8;

    // ─── FAMILY BACKGROUND ───────────────────────────────────────

    y = sectionHeader("Family Background", y);

    const famW = [160, 185, 170];
    let fx = LEFT;
    ["Member", "Occupation", "Annual Income"].forEach((h, i) => {
      cell(h, fx, y, famW[i]!, 16, { align: "center" });
      doc.fillColor("#555").fontSize(7).font("Helvetica-Bold");
      fx += famW[i]!;
    });
    y += 16;

    fx = LEFT;
    cell("Father:  " + (lead.fatherName ?? ""), fx, y, famW[0]!, 20);
    fx += famW[0]!;
    cell(app?.fatherOccupation ?? "", fx, y, famW[1]!, 20);
    fx += famW[1]!;
    cell(
      app?.fatherIncome ? `₹${app.fatherIncome.toLocaleString("en-IN")}` : "",
      fx,
      y,
      famW[2]!,
      20,
    );
    y += 20;

    fx = LEFT;
    cell("Mother:  " + (app?.motherName ?? ""), fx, y, famW[0]!, 20);
    fx += famW[0]!;
    cell(app?.motherOccupation ?? "", fx, y, famW[1]!, 20);
    fx += famW[1]!;
    cell(
      app?.motherIncome ? `₹${app.motherIncome.toLocaleString("en-IN")}` : "",
      fx,
      y,
      famW[2]!,
      20,
    );
    y += 20;

    fx = LEFT;
    cell(
      "No. of Sisters: " + String(app?.noOfSisters ?? ""),
      fx,
      y,
      famW[0]!,
      16,
    );
    fx += famW[0]!;
    cell(
      "No. of Brothers: " + String(app?.noOfBrothers ?? ""),
      fx,
      y,
      famW[1]!,
      16,
    );
    fx += famW[1]!;
    cell("", fx, y, famW[2]!, 16);
    y += 16 + 8;

    // ─── ACADEMIC RECORD ─────────────────────────────────────────

    y = sectionHeader("Academic Record", y);

    const acH = [
      "Academic Level",
      "Subjects / Stream",
      "School / College",
      "Board / University",
      "Year",
      "% / Grade",
    ];
    const acW = [80, 80, 135, 105, 55, 60];
    fx = LEFT;
    acH.forEach((h, i) => {
      cell(h, fx, y, acW[i]!, 22, { align: "center" });
      fx += acW[i]!;
    });
    y += 22;

    const levels: Array<[string, string]> = [
      ["Matric / X Std.", "TENTH"],
      ["Inter / XII Std.", "TWELFTH"],
      ["Graduation / Equiv.", "GRADUATION"],
      ["PG / Equiv.", "POST_GRADUATION"],
    ];

    for (const [label, levelKey] of levels) {
      const rec = app?.academicRecords?.find((r: any) => r.level === levelKey);
      fx = LEFT;
      cell(label, fx, y, acW[0]!, 20);
      fx += acW[0]!;
      cell(rec?.stream ?? "", fx, y, acW[1]!, 20);
      fx += acW[1]!;
      cell(rec?.institution ?? "", fx, y, acW[2]!, 20);
      fx += acW[2]!;
      cell(rec?.board ?? "", fx, y, acW[3]!, 20);
      fx += acW[3]!;
      cell(rec?.passingYear?.toString() ?? "", fx, y, acW[4]!, 20);
      fx += acW[4]!;
      cell(rec?.percentage ? `${rec.percentage}%` : "", fx, y, acW[5]!, 20);
      y += 20;
    }
    y += 8;

    // ─── ENTRANCE EXAMS ──────────────────────────────────────────

    if (app?.entranceExams?.length > 0) {
      y = sectionHeader("Entrance Exam Details", y, "#333");

      const exH = ["Exam Name", "Roll No.", "Score", "Rank"];
      const exW = [200, 105, 105, 105];
      fx = LEFT;
      exH.forEach((h, i) => {
        cell(h, fx, y, exW[i]!, 18, { align: "center" });
        fx += exW[i]!;
      });
      y += 18;

      for (const exam of app.entranceExams) {
        fx = LEFT;
        cell(exam.examName ?? "", fx, y, exW[0]!, 18);
        fx += exW[0]!;
        cell(exam.rollNo ?? "", fx, y, exW[1]!, 18);
        fx += exW[1]!;
        cell(exam.score ?? "", fx, y, exW[2]!, 18);
        fx += exW[2]!;
        cell(exam.rank?.toString() ?? "", fx, y, exW[3]!, 18);
        y += 18;
      }
    }

    // ─── PAGE 2 ───────────────────────────────────────────────────

    doc.addPage();
    y = 40;

    // Thin top rule
    doc
      .moveTo(LEFT, y)
      .lineTo(LEFT + W, y)
      .lineWidth(0.5)
      .stroke();
    y += 10;

    // ─── RULES & REGULATIONS ─────────────────────────────────────

    y = sectionHeader("Rules & Regulations (General)", y);

    const rulesTop = y;
    const RULES = [
      "Application should be in prescribed format, with all columns duly filled in black/blue ink, correctly and legibly. Incomplete or incorrect applications may be outright rejected.",
      "Students are required to submit attested xerox copies of their marksheet and eligibility certificates.",
      "Processing fees, once paid, will not be refunded under any circumstances.",
      "Students shall abide by the rules & regulations of Future Education, as declared and notified from time to time.",
      "Students are not expected to indulge in any antisocial, criminal, or political activities.",
      "Students found damaging the property of the organisation shall be punished and fined.",
      "In case of any dispute regarding student affairs, the matter shall be raised before the Authority of Future Education and settled only by Arbitration under the exclusive jurisdiction of competent courts/forums of Bokaro Steel City.",
      "Students admitted to their choice institute/college shall abide by all rules and regulations of such Institutes/Colleges/Universities.",
      "In case of any failure on the part of the student — before or after admission — Future Education will not be responsible.",
    ];

    y += 6;
    for (let i = 0; i < RULES.length; i++) {
      doc
        .fillColor("#000")
        .fontSize(7.5)
        .font("Helvetica")
        .text(`${i + 1}.  ${RULES[i]}`, LEFT + 10, y, {
          width: W - 20,
          align: "justify",
        });
      y = doc.y + 5;
    }
    y += 4;
    doc
      .rect(LEFT, rulesTop, W, y - rulesTop)
      .lineWidth(0.5)
      .stroke();

    // ─── DECLARATION ─────────────────────────────────────────────

    y += 12;
    doc
      .fillColor("#000")
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .text("Declaration:", LEFT, y);
    y += 14;
    doc
      .fillColor("#000")
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        "a)  The information furnished above is correct to the best of my/our belief. I/We shall be liable for legal action if any data is found false or forged.",
        LEFT + 10,
        y,
        { width: W - 20, align: "justify" },
      );
    y = doc.y + 6;
    doc
      .fontSize(7.5)
      .font("Helvetica")
      .text(
        "b)  I/We have read, understood, and agree to abide by all the Rules & Regulations of Future Education.",
        LEFT + 10,
        y,
        { width: W - 20 },
      );
    y = doc.y + 20;

    // ─── SIGNATURE FIELDS ────────────────────────────────────────

    const sigW = Math.floor(W / 3);
    const sigLabels = [
      "Parent's / Guardian's Signature",
      "Date",
      "Applicant's Signature",
    ];
    sigLabels.forEach((lbl, i) => {
      doc
        .fillColor("#555")
        .fontSize(7.5)
        .font("Helvetica")
        .text(lbl, LEFT + sigW * i + 4, y, {
          width: sigW - 8,
          align: "center",
        });
    });
    y += 28;
    [0, 1, 2].forEach((i) => {
      doc
        .moveTo(LEFT + sigW * i + 12, y)
        .lineTo(LEFT + sigW * (i + 1) - 12, y)
        .lineWidth(0.5)
        .stroke();
    });
    y += 24;

    // Divider before office section
    doc
      .moveTo(LEFT, y)
      .lineTo(LEFT + W, y)
      .lineWidth(1)
      .stroke();
    y += 10;

    // ─── FOR OFFICE USE ONLY ─────────────────────────────────────

    doc.rect(LEFT, y, W, 18).fillAndStroke("#e8f5e9", "#005826");
    doc
      .fillColor("#005826")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("FOR OFFICE USE ONLY", LEFT + 4, y + 5, {
        width: W,
        align: "center",
      });
    doc.fillColor("#000");
    y += 18;

    const ofH = 20;
    labelCell("Candidate's Name", lead.studentName ?? "", LEFT, y, 110, W, ofH);
    y += ofH;
    labelCell(
      "Programme",
      lead.courses?.[0]?.course?.name ?? "",
      LEFT,
      y,
      80,
      W / 2,
      ofH,
    );
    labelCell(
      "Branch / City",
      lead.branch?.name ?? "",
      LEFT + W / 2,
      y,
      80,
      W / 2,
      ofH,
    );
    y += ofH;

    labelCell(
      "College Booking Amt.",
      app?.bookingAmount ? `₹${app.bookingAmount}` : "",
      LEFT,
      y,
      120,
      W / 2,
      ofH,
    );
    labelCell(
      "Cash / DD No.",
      app?.bookingCashDDNo ?? "",
      LEFT + W / 2,
      y,
      80,
      W / 4,
      ofH,
    );
    labelCell(
      "Bank",
      app?.bookingBank ?? "",
      LEFT + (W * 3) / 4,
      y,
      40,
      W / 4,
      ofH,
    );
    y += ofH;

    labelCell(
      "Admission Asst. Amt.",
      app?.admissionAmount ? `₹${app.admissionAmount}` : "",
      LEFT,
      y,
      120,
      W / 2,
      ofH,
    );
    labelCell(
      "Cash / DD No.",
      app?.admissionCashDDNo ?? "",
      LEFT + W / 2,
      y,
      80,
      W / 4,
      ofH,
    );
    labelCell(
      "Bank",
      app?.admissionBank ?? "",
      LEFT + (W * 3) / 4,
      y,
      40,
      W / 4,
      ofH,
    );
    y += ofH;

    labelCell(
      "Dues Amount",
      app?.duesAmount ? `₹${app.duesAmount}` : "",
      LEFT,
      y,
      90,
      W / 2,
      ofH,
    );
    labelCell(
      "Due Date",
      app?.dueDate ? new Date(app.dueDate).toLocaleDateString("en-IN") : "",
      LEFT + W / 2,
      y,
      60,
      W / 2,
      ofH,
    );
    y += ofH + 10;

    // Authorised signature + date
    doc
      .fillColor("#000")
      .fontSize(9)
      .font("Helvetica")
      .text("Authorised Signature: _________________________", LEFT, y);
    doc.text("Date: ______________", LEFT + 340, y);
    y += 32;

    // Footer line
    doc
      .moveTo(LEFT, y)
      .lineTo(LEFT + W, y)
      .lineWidth(0.5)
      .stroke();
    y += 8;

    doc
      .fillColor("#666")
      .fontSize(7.5)
      .font("Helvetica")
      .text(`Counsellor: ${lead.assignedTo?.name ?? "—"}`, LEFT, y);
    doc.text(
      `Generated: ${new Date().toLocaleDateString("en-IN")}`,
      LEFT + 360,
      y,
    );

    doc.end();
  });
}
