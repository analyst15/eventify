import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();
// Load .env.example values if they aren't already set in the environment or .env
dotenv.config({ path: path.join(process.cwd(), ".env.example") });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies with limit matching potential base64 attachments size (25mb)
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // CORS headers just in case
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    next();
  });

  const COMPANY_TOKEN = "31D8E205-50C3-4398-BFB3-E61B04EFA810";
  const SERVICE_TYPE_DEFAULT = "101652";

  // POST endpoint to request a payment token from DPO Group
  app.post("/api/dpo/create-token", async (req, res) => {
    try {
      const { 
        amount, 
        currency, 
        email, 
        firstName, 
        lastName, 
        phoneNumber, 
        ticketName, 
        registrationId,
        address,
        city,
        country,
        zipCode
      } = req.body;

      if (!amount || !currency || !email || !firstName || !lastName || !registrationId) {
        res.status(400).json({ error: "Missing required registration checkout parameters" });
        return;
      }

      const serviceDescription = ticketName || "Event Ticket";
      const serviceDate = new Date().toISOString().split("T")[0]; // Y-m-d format
      const companyRef = `AEMS-${registrationId}`;

      // Build redirection URLs that point back to our front-end checkout application
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const host = req.get("host");
      const redirectUrl = `${protocol}://${host}/?paymentSuccess=true&regId=${registrationId}`;
      const backUrl = `${protocol}://${host}/?paymentCancelled=true&regId=${registrationId}`;

      const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${COMPANY_TOKEN}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${parseFloat(amount).toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${currency}</PaymentCurrency>
    <CompanyRef>${companyRef}</CompanyRef>
    <RedirectURL>${redirectUrl}</RedirectURL>
    <BackURL>${backUrl}</BackURL>
    <CompanyRefUnique>0</CompanyRefUnique>
    <customerEmail>${email}</customerEmail>
    <customerFirstName>${firstName}</customerFirstName>
    <customerLastName>${lastName}</customerLastName>
    <customerPhone>${phoneNumber || ""}</customerPhone>
    <customerAddress>${address || ""}</customerAddress>
    <customerCity>${city || ""}</customerCity>
    <customerCountry>${country || ""}</customerCountry>
    <customerZip>${zipCode || ""}</customerZip>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${SERVICE_TYPE_DEFAULT}</ServiceType>
      <ServiceDescription>${serviceDescription}</ServiceDescription>
      <ServiceDate>${serviceDate}</ServiceDate>
    </Service>
  </Services>
</API3G>`.trim();

      console.log(`[DPO API LOG] Sending createToken request for Registration ${registrationId}:`, xmlRequest);

      const response = await fetch("https://secure.3gdirectpay.com/API/v6/", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          "Accept": "text/xml",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: xmlRequest
      });

      const responseText = await response.text();
      console.log(`[DPO API LOG] Received createToken response:`, responseText);

      const resultMatch = responseText.match(/<Result>([^<]+)<\/Result>/);
      const explanationMatch = responseText.match(/<ResultExplanation>([^<]+)<\/ResultExplanation>/);
      const transTokenMatch = responseText.match(/<TransToken>([^<]+)<\/TransToken>/);
      const transRefMatch = responseText.match(/<TransRef>([^<]+)<\/TransRef>/);

      const result = resultMatch ? resultMatch[1] : null;
      const explanation = explanationMatch ? explanationMatch[1] : null;
      const transToken = transTokenMatch ? transTokenMatch[1] : null;
      const transRef = transRefMatch ? transRefMatch[1] : null;

      if (result === "000" && transToken) {
        // Correct redirection URL configuration using the appropriate DPO domain (sandbox vs live)
        const isSandbox = COMPANY_TOKEN === "31D8E205-50C3-4398-BFB3-E61B04EFA810";
        const paymentUrl = isSandbox 
          ? `https://secure.3gdirectpay.com/payv2.php?ID=${transToken}`
          : `https://payments.directpay.online/payv2.php?ID=${transToken}`;
        res.json({
          success: true,
          transToken,
          transRef,
          paymentUrl
        });
      } else {
        res.status(400).json({
          success: false,
          error: explanation || "DPO payment gateway returned an error",
          resultCode: result
        });
      }
    } catch (err) {
      console.error("[DPO API ERROR] Create Token exception:", err);
      res.status(500).json({ error: "Failed to initiate DPO transaction gateway" });
    }
  });

  // POST endpoint to verify a payment token from DPO Group
  app.post("/api/dpo/verify-token", async (req, res) => {
    try {
      const { transToken } = req.body;

      if (!transToken) {
        res.status(400).json({ error: "Missing Transaction Token (transToken)" });
        return;
      }

      const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${COMPANY_TOKEN}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${transToken}</TransactionToken>
</API3G>`.trim();

      console.log(`[DPO API LOG] Sending verifyToken request for Token ${transToken}`);

      const response = await fetch("https://secure.3gdirectpay.com/API/v6/", {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "Accept": "text/xml",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: xmlRequest
      });

      const responseText = await response.text();
      console.log(`[DPO API LOG] Received verifyToken response:`, responseText);

      const resultMatch = responseText.match(/<Result>([^<]+)<\/Result>/);
      const explanationMatch = responseText.match(/<ResultExplanation>([^<]+)<\/ResultExplanation>/);

      const result = resultMatch ? resultMatch[1] : null;
      const explanation = explanationMatch ? explanationMatch[1] : null;

      // 000 is SUCCESS (paid), 900 is AUTHORIZED (also accepted/success status context)
      const isVerified = result === "000" || result === "900";

      res.json({
        success: true,
        verified: isVerified,
        resultCode: result,
        resultExplanation: explanation || "No explanation provided"
      });
    } catch (err) {
      console.error("[DPO API ERROR] Verify Token exception:", err);
      res.status(500).json({ error: "Failed to verify DPO transaction status" });
    }
  });

  // POST endpoint to send registration email notification
  app.post("/api/registration/notify", async (req, res) => {
    try {
      const { registrationId, ...data } = req.body;

      if (!registrationId || !data.email) {
        res.status(400).json({ error: "Missing registration ID or email" });
        return;
      }

      const recipientEmail = (process.env.NOTIFICATION_RECIPIENT_EMAIL || "connect@econ.africa").trim();
      const smtpHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : "";
      const smtpPort = process.env.SMTP_PORT ? process.env.SMTP_PORT.trim() : "587";
      const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : "";
      const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : "";

      const areasOfInterestText = Array.isArray(data.areasOfInterest) 
        ? data.areasOfInterest.join(", ") 
        : data.areasOfInterest || "None selected";

      const oppsText = Array.isArray(data.participationOpportunities) 
        ? data.participationOpportunities.join(", ") 
        : data.participationOpportunities || "None selected";

      const uploadedFiles: string[] = [];
      if (data.attachments) {
        if (data.attachments.headshot) uploadedFiles.push(`<b>Headshot:</b> ${data.attachments.headshot.name}`);
        if (data.attachments.bio) uploadedFiles.push(`<b>Biography:</b> ${data.attachments.bio.name}`);
        if (data.attachments.companyProfile) uploadedFiles.push(`<b>Company Profile:</b> ${data.attachments.companyProfile.name}`);
        if (data.attachments.presentationDeck) uploadedFiles.push(`<b>Presentation Deck:</b> ${data.attachments.presentationDeck.name}`);
      }
      const attachmentsText = uploadedFiles.length > 0 ? uploadedFiles.join("<br/>") : "No attachments uploaded";

      const emailSubject = `🔔 New Event Registration: ${data.firstName} ${data.lastName} (${data.organization || "No Org"})`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background: #111827; color: #ffffff; padding: 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
            .content { padding: 32px 24px; }
            .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
            .field-row { display: flex; margin-bottom: 10px; font-size: 14px; line-height: 1.5; }
            .field-label { width: 180px; font-weight: 600; color: #4b5563; flex-shrink: 0; }
            .field-value { color: #111827; flex-grow: 1; word-break: break-word; }
            .footer { background-color: #f3f4f6; color: #6b7280; text-align: center; padding: 16px; font-size: 12px; border-top: 1px solid #e5e7eb; }
            .badge { display: inline-block; background-color: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Registration Notification</h1>
            </div>
            <div class="content">
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 15px; color: #374151;">A new attendee has filled in details for the event registration. Here are the submission details:</p>

              <div class="section-title">Registration Info</div>
              <div class="field-row">
                <div class="field-label">Registration ID:</div>
                <div class="field-value"><strong>${registrationId}</strong></div>
              </div>
              <div class="field-row">
                <div class="field-label">Participation Type:</div>
                <div class="field-value"><span class="badge">${data.participationType}</span></div>
              </div>
              <div class="field-row">
                <div class="field-label">Attendance Type:</div>
                <div class="field-value">${data.attendance || "Not specified"}</div>
              </div>

              <div class="section-title">Personal Details</div>
              <div class="field-row">
                <div class="field-label">Full Name:</div>
                <div class="field-value"><strong>${data.firstName} ${data.lastName}</strong></div>
              </div>
              <div class="field-row">
                <div class="field-label">Email:</div>
                <div class="field-value"><a href="mailto:${data.email}">${data.email}</a></div>
              </div>
              <div class="field-row">
                <div class="field-label">Phone:</div>
                <div class="field-value">${data.phone || "N/A"}</div>
              </div>

              <div class="section-title">Professional Profile</div>
              <div class="field-row">
                <div class="field-label">Organization:</div>
                <div class="field-value">${data.organization || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Job Title:</div>
                <div class="field-value">${data.jobTitle || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Website:</div>
                <div class="field-value">${data.website ? `<a href="${data.website}" target="_blank">${data.website}</a>` : "N/A"}</div>
              </div>

              <div class="section-title">Billing & Address</div>
              <div class="field-row">
                <div class="field-label">Address:</div>
                <div class="field-value">${data.address || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">City:</div>
                <div class="field-value">${data.city || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Country:</div>
                <div class="field-value"><strong>${data.country || "N/A"}</strong></div>
              </div>
              <div class="field-row">
                <div class="field-label">Zip/Postal Code:</div>
                <div class="field-value">${data.zipCode || "N/A"}</div>
              </div>

              <div class="section-title">Proposal & Interests</div>
              <div class="field-row">
                <div class="field-label">Areas of Interest:</div>
                <div class="field-value">${areasOfInterestText}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Proposed Topic:</div>
                <div class="field-value">${data.proposedTopic || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Session Summary:</div>
                <div class="field-value" style="white-space: pre-line;">${data.sessionSummary || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Preferred Format:</div>
                <div class="field-value">${data.preferredFormat || "N/A"}</div>
              </div>
              <div class="field-row">
                <div class="field-label">Cooperation Opportunities:</div>
                <div class="field-value">${oppsText}</div>
              </div>

              <div class="section-title">Uploaded Attachments</div>
              <div class="field-row" style="margin-bottom: 0;">
                <div class="field-label">Files:</div>
                <div class="field-value" style="font-size: 13px;">${attachmentsText}</div>
              </div>
            </div>
            <div class="footer">
              This notice was automatically dispatched by your Event Registration System.<br/>
              Timestamp: ${new Date().toUTCString()}
            </div>
          </div>
        </body>
        </html>
      `.trim();

      let info;
      let emailSent = false;
      let emailSimulated = false;

      if (smtpHost && smtpUser && smtpPass) {
        console.log(`[EMAIL LOG] SMTP configured: host="${smtpHost}", port="${smtpPort}", user="${smtpUser}", recipient="${recipientEmail}". Attempting real email...`);
        
        const transporterOptions: any = {};
        if (smtpHost.toLowerCase().includes("gmail")) {
          // Gmail specifically needs standard SSL/TLS setup optimal behaviors
          transporterOptions.service = "gmail";
          transporterOptions.auth = {
            user: smtpUser,
            pass: smtpPass,
          };
        } else {
          transporterOptions.host = smtpHost;
          transporterOptions.port = parseInt(smtpPort || "587");
          transporterOptions.secure = smtpPort === "465";
          transporterOptions.auth = {
            user: smtpUser,
            pass: smtpPass,
          };
          if (smtpPort !== "465") {
            transporterOptions.tls = {
              rejectUnauthorized: false
            };
          }
        }

        const transporter = nodemailer.createTransport(transporterOptions);

        const mailAttachments: any[] = [];
        if (data.attachments) {
          const keys = ['bio', 'companyProfile', 'headshot', 'presentationDeck'];
          for (const key of keys) {
            const file = data.attachments[key];
            if (file && file.dataUrl) {
              const dataUrl = file.dataUrl;
              const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
              if (matches) {
                const contentType = matches[1];
                const base64Data = matches[2];
                mailAttachments.push({
                  filename: file.name,
                  content: Buffer.from(base64Data, 'base64'),
                  contentType: contentType
                });
              } else {
                mailAttachments.push({
                  filename: file.name,
                  path: dataUrl
                });
              }
            }
          }
        }

        info = await transporter.sendMail({
          from: `"Event Registration" <${smtpUser}>`,
          to: recipientEmail,
          subject: emailSubject,
          html: emailHtml,
          attachments: mailAttachments
        });

        console.log(`[EMAIL LOG] Real email successfully sent. MessageId: ${info.messageId}`);
        emailSent = true;
      } else {
        console.log(`\n==================================================`);
        console.log(`[EMAIL SIMULATION] SMTP not configured in environment.`);
        console.log(`[EMAIL SIMULATION] Recipient: ${recipientEmail}`);
        console.log(`[EMAIL SIMULATION] Subject: ${emailSubject}`);
        console.log(`[EMAIL SIMULATION] Body preview:\n`);
        console.log(emailHtml);
        console.log(`==================================================\n`);
        emailSimulated = true;
      }

      res.json({
        success: true,
        emailSent,
        emailSimulated,
        recipient: recipientEmail,
      });
    } catch (err: any) {
      console.error("[EMAIL ERROR] Failed to perform notify:", err);
      // We don't return 500 so the client registration flow is not blocked. Instead we return success: false with error details.
      res.json({ success: false, error: err.message || "Unknown error" });
    }
  });

  // GET endpoint to test SMTP settings and connection diagnostics
  app.get("/api/registration/test-email", async (req, res) => {
    try {
      const recipientEmail = (process.env.NOTIFICATION_RECIPIENT_EMAIL || "connect@econ.africa").trim();
      const smtpHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : "";
      const smtpPort = process.env.SMTP_PORT ? process.env.SMTP_PORT.trim() : "587";
      const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : "";
      const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : "";

      const diagnosticLog: string[] = [];
      diagnosticLog.push(`[DIAGNOSTIC] Current local time is: ${new Date().toISOString()}`);
      diagnosticLog.push(`[DIAGNOSTIC] Recipient Email: "${recipientEmail}"`);
      diagnosticLog.push(`[DIAGNOSTIC] SMTP Host: "${smtpHost}"`);
      diagnosticLog.push(`[DIAGNOSTIC] SMTP Port: "${smtpPort}"`);
      diagnosticLog.push(`[DIAGNOSTIC] SMTP User: "${smtpUser}"`);
      diagnosticLog.push(`[DIAGNOSTIC] SMTP Pass length: ${smtpPass.length} chars (is set: ${!!smtpPass})`);

      if (!smtpHost || !smtpUser || !smtpPass) {
        res.json({
          success: false,
          error: "Incomplete SMTP configuration. Please check your environment variables.",
          diagnostics: diagnosticLog
        });
        return;
      }

      const transporterOptions: any = {};
      if (smtpHost.toLowerCase().includes("gmail")) {
        diagnosticLog.push(`[DIAGNOSTIC] Gmail specific service transport enabled.`);
        transporterOptions.service = "gmail";
        transporterOptions.auth = {
          user: smtpUser,
          pass: smtpPass,
        };
      } else {
        diagnosticLog.push(`[DIAGNOSTIC] Custom SMTP host transport configured.`);
        transporterOptions.host = smtpHost;
        transporterOptions.port = parseInt(smtpPort || "587");
        transporterOptions.secure = smtpPort === "465";
        transporterOptions.auth = {
          user: smtpUser,
          pass: smtpPass,
        };
        if (smtpPort !== "465") {
          transporterOptions.tls = {
            rejectUnauthorized: false
          };
        }
      }

      diagnosticLog.push(`[DIAGNOSTIC] Creating nodemailer transporter with options: host="${transporterOptions.host || 'Gmail service'}", port="${transporterOptions.port || 'Default Service Port'}", secure="${transporterOptions.secure || 'false'}"`);
      const transporter = nodemailer.createTransport(transporterOptions);

      diagnosticLog.push(`[DIAGNOSTIC] Verifying connection to ${smtpHost}...`);
      
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SMTP Connection Timeout (10 seconds limit exceeded). This usually indicates your hosting provider's firewall blocks outgoing connections on this port.")), 10000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
      diagnosticLog.push(`[DIAGNOSTIC] SMTP connection Verified successfully!`);

      diagnosticLog.push(`[DIAGNOSTIC] Attempting to send test email to: ${recipientEmail}...`);
      const info = await transporter.sendMail({
        from: `"Event Registration Diagnostics" <${smtpUser}>`,
        to: recipientEmail,
        subject: `🧪 Registration Email Test Diagnostic - Success!`,
        html: `
          <h1>SMTP Connection & Send Test Success 🚀</h1>
          <p>If you are reading this email, your Web Application's SMTP mailing is fully functional!</p>
          <p><b>Diagnosis Details:</b></p>
          <ul>
            <li><b>SMTP Host:</b> ${smtpHost}</li>
            <li><b>SMTP Port:</b> ${smtpPort}</li>
            <li><b>SMTP Username:</b> ${smtpUser}</li>
            <li><b>Notification Recipient:</b> ${recipientEmail}</li>
            <li><b>Attempted At (UTC):</b> ${new Date().toUTCString()}</li>
          </ul>
          <p>Please double check if spam filters, folders or email delivery rule configurations are delaying delivery.</p>
        `
      });

      diagnosticLog.push(`[DIAGNOSTIC] Test email dispatched successfully! Message ID: ${info.messageId}`);
      if (info.accepted && info.accepted.length > 0) {
        diagnosticLog.push(`[DIAGNOSTIC] Delivery accepted by: ${info.accepted.join(', ')}`);
      }
      if (info.rejected && info.rejected.length > 0) {
        diagnosticLog.push(`[DIAGNOSTIC] Warning! Delivery rejected by: ${info.rejected.join(', ')}`);
      }

      res.json({
        success: true,
        message: "SMTP is fully operational! Test email has been successfully sent.",
        messageId: info.messageId,
        recipient: recipientEmail,
        diagnostics: diagnosticLog
      });

    } catch (err: any) {
      console.error("[TEST EMAIL ERROR] Diagnostics failed:", err);
      res.json({
        success: false,
        error: err.message || String(err),
        errorCode: err.code || "UNKNOWN",
        diagnostics: [
          ...((err.message && err.message.includes("Timeout")) ? [] : ["SMTP Verification or Handshake Failed!"]),
          `Error Details: ${err.message || String(err)}`,
          `Hint: If you are using Gmail, make sure you enabled 2-Step Verification and generated an active "App Password" (which should be 16 characters long). If you are hosting on cPanel or similar shared hosting, verify with your host provider if outbound SMTP port connections (587 or 465) are blocked.`
        ]
      });
    }
  });

  // Serve static application / dev Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT} with environment ${process.env.NODE_ENV || "development"}`);
  });
}

startServer();
