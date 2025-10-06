const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const https = require('https');

const app = express();
app.use(express.json());

app.use(cors({
  // origin: 'http://localhost:5174', 
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const httpsAgent = new https.Agent({ rejectUnauthorized: false });


const { FM_SERVER, FM_DB, FM_USER, FM_PASS } = process.env;

async function getToken() {
  const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/sessions`;
  const auth = Buffer.from(`${FM_USER}:${FM_PASS}`).toString('base64');

  try {
    const res = await axios.post(url, {}, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      httpsAgent,

    });
    return res.data.response.token;
  } catch (err) {
    console.error("Error getting token:", err.response?.data || err.message);
    throw err;
  }
}

// app.post('/api/register', async (req, res) => {
//   try {
//     const token = await getToken();
//     const layout = 'Employee';

//     const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

//     const payload = {
//       fieldData: {
//         Email: req.body.Email,     
//         ClientID: req.body.ClientId
//       }
//     };

//     const response = await axios.post(url, payload, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     res.json({ success: true, data: response.data });
//   } catch (err) {
//     console.error("Error creating record:", err.response?.data || err.message);
//     res.status(500).json({ error: "Failed to create record" });
//   }
// });


app.post('/api/register', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; // 🔹 Your FileMaker layout

    const { Email, ClientId } = req.body;

    // 1️⃣ Check if ClientID already exists
    const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
    const findPayload = {
      query: [{ ClientID: ClientId }] // 🔹 match field name in FileMaker
    };

    const findResponse = await axios.post(findUrl, findPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (findResponse.data.response.data.length > 0) {
      // Record already exists
      return res.status(400).json({ error: "ClientID already used" });
    }

    // 2️⃣ If not found, create new record
    const createUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;
    const createPayload = {
      fieldData: {
        Email: Email,
        ClientID: ClientId
      }
    };

    const createResponse = await axios.post(createUrl, createPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true, data: createResponse.data });

  } catch (err) {
    // Handle "no records found" safely (FileMaker returns 401 for no match)
    if (err.response?.data?.messages?.[0]?.code === "401") {
      // Not found → go ahead and create
      try {
        const token = await getToken();
        const layout = 'Employee';
        const createUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;
        const createPayload = {
          fieldData: {
            Email: req.body.Email,
            ClientID: req.body.ClientId
          }
        };

        const createResponse = await axios.post(createUrl, createPayload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        return res.json({ success: true, data: createResponse.data });
      } catch (createErr) {
        console.error("Error creating record:", createErr.response?.data || createErr.message);
        return res.status(500).json({ error: "Failed to create record" });
      }
    }

    console.error("Error checking ClientID:", err.response?.data || err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});


// app.post('/api/login', async (req, res) => {
//   const { Email, Password } = req.body;
//   const layout = 'Employee'; 

//   try {
//     const token = await getToken();

//     // 🔍 Use exact match for Email
//     const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
//     const findPayload = { query: [{ "Email": `=${Email}` }] };

//     const findResponse = await axios.post(findUrl, findPayload, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     // If no record
//     if (!findResponse.data.response.data || findResponse.data.response.data.length === 0) {
//       return res.status(400).json({ error: "No user found with this email" });
//     }

//     const userRecord = findResponse.data.response.data[0].fieldData;

//     // Debug
//     console.log("DB Email:", userRecord.Email);
//     console.log("DB Password:", userRecord.Password);

//     // Compare Password
//     if (userRecord.Password !== Password) {
//       return res.status(400).json({ error: "Wrong password" });
//     }

//     // Success
//     return res.json({
//       success: true,
//       message: "Login successful",
//       user: {
//         Email: userRecord.Email,
//       }
//     });

//   } catch (err) {
//     if (err.response?.data?.messages?.[0]?.code === "401") {
//       return res.status(400).json({ error: "No user found with this email" });
//     }
//     console.error("Login error:", err.response?.data || err.message);
//     return res.status(500).json({ error: "Server error during login" });
//   }
// });


app.post('/api/login', async (req, res) => {
  const { Email, Password } = req.body;
  const layout = 'Employee'; // Your FileMaker layout

  try {
    const token = await getToken();

    // 🔍 Exact match on Email
    const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
    // const findPayload = { query: [{ Phone: "8870657822" }] };
    const findPayload = { "query": [
        { "Email": `==${Email}` }
      ] };
    // const findPayload = { query: [{ Email: `=${Email}` }] };

    const findResponse = await axios.post(findUrl, findPayload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // ✅ Check if any record was returned
    const records = findResponse.data.response?.data || [];
    if (records.length === 0) {
      return res.status(400).json({ error: "No user found with this email" });
    }

    const userRecord = records[0].fieldData;

    // Debug logs (remove later in production)
    console.log("DB Email:", userRecord.Email);
    console.log("DB Password:", userRecord.Password);

    // ✅ Check password
    if (!userRecord.Password) {
      return res.status(400).json({ error: "User has no password set" });
    }

    if (userRecord.Password !== Password) {
      return res.status(400).json({ error: "Wrong password" });
    }

    // ✅ Success
    return res.json({
      success: true,
      message: "Login successful",
      user: {
        Email: userRecord.Email,
        ClientID: userRecord.ClientId,
        PrimaryID: userRecord.PrimaryKey
      }
    });

  } catch (err) {
    // Handle "No records found" (FileMaker 401 error)
    if (err.response?.data?.messages?.[0]?.code === "401") {
      return res.status(400).json({ error: "No user found with this email" });
    }

    console.error("Login error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Server error during login" });
  }
});



app.get('/api/allrecords', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/473`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data.response.data);
  } catch (err) {
    console.error("Error fetching records:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// Get Employee record by PrimaryID
app.get('/api/records/:primaryId', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee';
    const { primaryId } = req.params;

    // Use FileMaker "find" endpoint instead of hard-coded /records/:id
    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    const payload = {
      query: [
        { PrimaryKey: primaryId } // field name must exactly match FileMaker field
      ]
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data.response.data);
    console.log(response.data)
  } catch (err) {
    console.error("Error fetching employee record:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch employee record", details: err.response?.data || err.message });
  }
});


// Update record
app.put('/api/records/:recordId', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee';
    const { recordId } = req.params;
    const { fieldData } = req.body; // ✅ correctly pull fieldData

    console.log("Updating Record:", recordId);
    console.log("Payload sent to FileMaker:", fieldData);

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/${recordId}`;

    const response = await axios.patch(url, 
      { fieldData }, // ✅ correct shape: { fieldData: {...} }
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("FileMaker update response:", response.data);

    res.json({ success: true, message: "Record updated", data: response.data });
  } catch (err) {
    console.error("Error updating record:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to update record", details: err.response?.data || err.message });
  }
});


// app.get('/api/d-notes', async (req, res) => {
//   try {
//     const token = await getToken();
//     const layout = 'Employee'; 

//     const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

//     const response = await axios.get(url, {
//       headers: {
//         'Authorization': `Bearer ${token}`
//       }
//     });

//     res.json(response.data.response.data);
//   } catch (err) {
//     console.error("Error fetching records:", err.response?.data || err.message);
//     res.status(500).json({ error: "Failed to fetch records" });
//   }
// });

app.get('/api/client-d-notes/:primaryKey', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 
    const { primaryKey } = req.params;

    console.log(primaryKey)

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    const response = await axios.post(url, {
      query: [{ PrimaryKey: primaryKey }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.response.data.length > 0) {
      const record = response.data.response.data[0];
      res.json(record.portalData["Employee_vs_Accesories|pk"] || []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Error fetching delivery notes:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch delivery notes" });
  }
});

app.get('/api/client-invoices/:primaryKey', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 
    const { primaryKey } = req.params;

    console.log(primaryKey)

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    const response = await axios.post(url, {
      query: [{ PrimaryKey: primaryKey }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.response.data.length > 0) {
      const record = response.data.response.data[0];
      res.json(record.portalData["Employee_vs_Accesories|pk"] || []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Error fetching delivery notes:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch delivery notes" });
  }
});

app.get('/api/client-cust-orders/:primaryKey', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 
    const { primaryKey } = req.params;

    console.log(primaryKey)

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    const response = await axios.post(url, {
      query: [{ PrimaryKey: primaryKey }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.response.data.length > 0) {
      const record = response.data.response.data[0];
      res.json(record.portalData["Employee_vs_Accesories|pk"] || []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Error fetching delivery notes:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch delivery notes" });
  }
});

app.get('/api/client-mat-locations/:primaryKey', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 
    const { primaryKey } = req.params;

    console.log(primaryKey)

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    const response = await axios.post(url, {
      query: [{ PrimaryKey: primaryKey }]
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.response.data.length > 0) {
      const record = response.data.response.data[0];
      res.json(record.portalData["Employee_vs_Accesories|pk"] || []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Error fetching delivery notes:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch delivery notes" });
  }
});

app.get('/api/layout', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee';

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Return field metadata only
    res.json(response.data.response.fieldMetaData);
  } catch (err) {
    console.error("Error fetching layout metadata:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch layout metadata" });
  }
});


app.get('/api/invoices', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data.response.data);
  } catch (err) {
    console.error("Error fetching records:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});



app.get('/api/sitevisit', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee'; 

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data.response.data);
  } catch (err) {
    console.error("Error fetching records:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// app.get('/api/statement', async (req, res) => {
//   try {
//     const token = await getToken();
//     const layout = 'Employee'; 

//     const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/469`;

//     const response = await axios.get(url, {
//       headers: {
//         'Authorization': `Bearer ${token}`
//       }
//     });

//     res.json(response.data.response.data);
//   } catch (err) {
//     console.error("Error fetching records:", err.response?.data || err.message);
//     res.status(500).json({ error: "Failed to fetch records" });
//   }
// });




// app.post('/api/ad-hoc-service', async (req, res) => {
//   try {
//     const token = await getToken();
//     const layout = 'Employee_detail';
//     const { PrimaryID, Date, Message } = req.body;

//     if (!PrimaryID || !Date || !Message) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

//     const payload = {
//       fieldData: {
//         PrimaryID,
//         ServiceDate: Date,
//         ServiceMessage: Message
//       }
//     };

//     const response = await axios.post(url, payload, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     res.json({ success: true, data: response.data });
//   } catch (err) {
//     console.error("Error saving Ad Hoc Service:", err.response?.data || err.message);
//     res.status(500).json({ error: "Failed to save Ad Hoc Service", details: err.response?.data || err.message });
//   }
// });




// app.post("/api/forgot-password", async (req, res) => {
//   const { Email } = req.body;
//   const layout = "Employee";

//   try {
//     const token = await getToken();

//     const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
//     const findPayload = { query: [{ Email: `==${Email}` }] };

//     const findResponse = await axios.post(findUrl, findPayload, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       httpsAgent,

//     });

//     const records = findResponse.data.response?.data || [];
//     if (records.length === 0) {
//       return res.status(400).json({ error: "No account found with this email" });
//     }

//     const recordId = records[0].recordId;

//     console.log(recordId);
//     const resetToken = crypto.randomBytes(32).toString("hex");
//     const expiration = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

//     const editUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/${recordId}`;
//     const updatePayload = {
//       fieldData: {
//         ResetToken: resetToken,
//         TokenExpiration: expiration,
//       },
//     };

//     await axios.patch(editUrl, updatePayload, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "application/json",
//       },
//       httpsAgent,

//     });

//     const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

//     const transporter = nodemailer.createTransport({
//       service: "Gmail",
//       auth: {
//         user: "msrahul7823@gmail.com",
//         pass: "fdlslylrddhksisj", 
//       },
//     });

//     await transporter.sendMail({
//       from: "rahulrahul03651@gmail.com",
//       to: Email,
//       subject: "Password Reset Request",
//       text: `Click this link to reset your password (valid for 12 hours)`,
//     });

//     res.json({ message: "Password reset link sent to your email." });
//   } catch (err) {
//     console.error("Forgot password error:", err.response?.data || err.message);
//     res.status(500).json({ error: "Server error during forgot password" });
//   }
// });

app.get('/api/statement/:primaryKey', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee';
    const { primaryKey } = req.params;
    const { invoiceType, fromDate, toDate } = req.query;

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

    // Find main record by PrimaryKey
    const response = await axios.post(
      url,
      { query: [{ PrimaryKey: primaryKey }] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.response.data?.length) {
      return res.json([]);
    }

    const portalRecords = response.data.response.data[0].portalData["Employee_vs_Accesories|pk"] || [];

    // Filter by date if both fromDate and toDate are provided
    let filteredRecords = portalRecords;
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      filteredRecords = filteredRecords.filter((r) => {
        const [d, m, y] = r["Employee_vs_Accesories|pk::Date"].split("-");
        const recordDate = new Date(`${y}-${m}-${d}`);
        return recordDate >= from && recordDate <= to;
      });
    }

    // Filter by invoiceType
    if (invoiceType === "outstanding") {
      filteredRecords = filteredRecords.filter(
        (r) => r["Employee_vs_Accesories|pk::Status"] === "Outstanding"
      );
    } else if (invoiceType === "paid") {
      filteredRecords = filteredRecords.filter(
        (r) => r["Employee_vs_Accesories|pk::Status"] === "Paid"
      );
    }
    // if invoiceType = "all" or null → no status filtering

    res.json(filteredRecords);
  } catch (err) {
    console.error("Error fetching statement:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch statement" });
  }
});



app.post('/api/ad-hoc', async (req, res) => {
  try {
    const token = await getToken();
    const layout = 'Employee_detail'; // or your correct layout name

    const { Date, Message, PrimaryID } = req.body;

    const url = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records`;

    const response = await axios.post(url, {
      fieldData: {
        Date,
        Message,
        PrimaryID
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // const transporter = nodemailer.createTransport({
    //   service: "Gmail",
    //   auth: {
    //     user: process.env.MAIL_USER,
    //     pass: process.env.MAIL_PASSWORD,
    //   },
    //   tls: {
    //     rejectUnauthorized: false, 
    //   },
    // });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD, // App password!
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: process.env.ADMIN_MAIL, 
      subject: "New Ad Hoc Service Request",
      html: `
        <h3>New Service Request</h3>
        <p><b>Date:</b> ${Date}</p>
        <p><b>Message:</b> ${Message}</p>
        <p><b>Client ID:</b> ${PrimaryID}</p>
      `,
    });
   
    res.json({
      success: true,
      message: "Record saved and email sent successfully",
      filemakerResponse: response.data.response,
    });

  } catch (err) {
    // console.error("Error saving  Ad Hoc Service:", err.response?.data || err.message);
    console.error("Error saving Ad Hoc Service:", err);
    res.status(500).json({
      error: "Failed to save Ad Hoc Service",
      details: err.message,
      stack: err.stack,
    });

  }
});

app.post("/api/forgot-password", async (req, res) => {
  const { Email } = req.body;
  const layout = "Employee";

  try {
    const token = await getToken();

    const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
    const findPayload = { query: [{ Email: `==${Email}` }] };

    const findResponse = await axios.post(findUrl, findPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    const records = findResponse.data.response?.data || [];
    if (records.length === 0) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    const recordId = records[0].recordId;
    const existing = records[0].fieldData;

    console.log(existing);
    // Check if already sent and still valid
    // if (existing.ResetToken && existing.TokenExpiration) {
    //   const expirationTime = new Date(existing.TokenExpiration).getTime();
    //   const now = Date.now();
    //   if (now < expirationTime) {
    //     return res
    //       .status(400)
    //       .json({ error: "Reset link already sent. Please check your email." });
    //   }
    // }

    function parseCustomDate(str) {
  // "22/9/2025, 5:49:20 pm"
      const [datePart, timePart, ampm] = str.replace(",", "").split(" ");
      const [day, month, year] = datePart.split("/").map(Number);
      let [hours, minutes, seconds] = timePart.split(":").map(Number);

      if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
      if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;

      return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    // usage
    if (existing.ResetToken && existing.TokenExpiration) {
      const expirationTime = parseCustomDate(existing.TokenExpiration).getTime();
      const now = Date.now();

      if (now < expirationTime) {
        return res.status(400).json({
          error: "Reset link already sent. Please check your email.",
        });
      }
    }


    

    // Generate new token, valid for 5 minutes
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiration = new Date(Date.now() + 5 * 60 * 1000).toLocaleString(); // 5 mins


    const editUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/${recordId}`;
    const updatePayload = {
      fieldData: {
        ResetToken: resetToken,
        TokenExpiration: expiration,
      },
    };

    await axios.patch(editUrl, updatePayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    const resetLink = `${process.env.API_URL_FRONT}/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, 
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: Email,
      subject: "Password Reset Request",
      text: `Click this link to reset your password (valid for 5 minutes): ${resetLink}`,
    });

    res.json({ message: "Password reset link sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err.response?.data || err.message);
    res.status(500).json({ error: "Server error during forgot password" });
  }
});


app.post("/api/reset-password", async (req, res) => {
  const { token, password } = req.body;
  const layout = "Employee";

  try {
    const fmToken = await getToken();

    // 1. Find record by ResetToken
    const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
    const findPayload = { query: [{ ResetToken: `==${token}` }] };

    const findResponse = await axios.post(findUrl, findPayload, {
      headers: {
        Authorization: `Bearer ${fmToken}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    const records = findResponse.data.response?.data || [];
    if (records.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const user = records[0].fieldData;
    const recordId = records[0].recordId;

    // 2. Check if token expired
    const now = Date.now();
    if (new Date(user.TokenExpiration).getTime() < now) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    const editUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/${recordId}`;
    const updatePayload = {
      fieldData: {
        Password: password,
        ResetToken: "",
        TokenExpiration: "",
      },
    };

    await axios.patch(editUrl, updatePayload, {
      headers: {
        Authorization: `Bearer ${fmToken}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err.response?.data || err.message);
        res.status(401).json({ error: "Invalid or expired reset token" });

    res.status(500).json({ error: "Server error during reset password" });
  }
});


// // 2. Validate token
// app.get('/api/validate-reset', async (req, res) => {
//   const { token } = req.query;
//   const layout = 'Employee';

//   try {
//     const fmToken = await getToken();
//     const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;

//     const findPayload = { query: [{ ResetToken: token }] };
//     const findResponse = await axios.post(findUrl, findPayload, {
//       headers: {
//         Authorization: `Bearer ${fmToken}`,
//         "Content-Type": "application/json"
//       }
//     });

//     const records = findResponse.data.response?.data || [];
//     if (records.length === 0) return res.status(400).json({ error: "Invalid token" });

//     const user = records[0].fieldData;
//     if (new Date(user.TokenExpiration) < new Date()) {
//       return res.status(400).json({ error: "Token expired" });
//     }

//     res.json({ valid: true, Email: user.Email });

//   } catch (err) {
//     res.status(500).json({ error: "Server error during token validation" });
//   }
// });

// // 3. Reset password
// app.post('/api/reset-password', async (req, res) => {
//   const { token, newPassword } = req.body;
//   const layout = 'Employee';

//   try {
//     const fmToken = await getToken();
//     const findUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/_find`;
//     const findPayload = { query: [{ ResetToken: token }] };

//     const findResponse = await axios.post(findUrl, findPayload, {
//       headers: {
//         Authorization: `Bearer ${fmToken}`,
//         "Content-Type": "application/json"
//       }
//     });

//     const records = findResponse.data.response?.data || [];
//     if (records.length === 0) return res.status(400).json({ error: "Invalid token" });

//     const recordId = records[0].recordId;

//     // Update password & clear token
//     const editUrl = `${FM_SERVER}/fmi/data/v1/databases/${FM_DB}/layouts/${layout}/records/${recordId}`;
//     const updatePayload = {
//       fieldData: {
//         Password: newPassword,
//         ResetToken: "",
//         TokenExpiration: ""
//       }
//     };

//     await axios.patch(editUrl, updatePayload, {
//       headers: {
//         Authorization: `Bearer ${fmToken}`,
//         "Content-Type": "application/json"
//       }
//     });

//     res.json({ message: "Password has been reset successfully." });

//   } catch (err) {
//     res.status(500).json({ error: "Server error during reset password" });
//   }
// });


app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
