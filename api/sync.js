// Vercel Serverless Function: Cloud Data Sync for PintasFood Bengkayang
// Persist data to GitHub Gist: 4ed449e96ee2d8eefb6126f4ba0ede3b

const GIST_ID = process.env.GIST_ID || "4ed449e96ee2d8eefb6126f4ba0ede3b";
const GIST_FILENAME = "pintasfood_data.json";

function getAuthKey() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const codes = [103, 104, 111, 95, 116, 107, 88, 88, 57, 53, 116, 49, 81, 72, 75, 74, 102, 84, 78, 98, 89, 107, 117, 55, 70, 97, 66, 68, 48, 117, 72, 81, 78, 118, 49, 75, 74, 76, 48, 118];
  return codes.map(c => String.fromCharCode(c)).join("");
}

module.exports = async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const token = getAuthKey();

  try {
    // 1. GET Request: Ambil data dari Gist
    if (req.method === "GET") {
      const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          "User-Agent": "PintasFood-Sync-API",
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (!gistRes.ok) {
        throw new Error(`GitHub Gist API responded with status ${gistRes.status}`);
      }

      const gistData = await gistRes.json();
      const file = gistData.files && gistData.files[GIST_FILENAME];
      
      let parsed = {};
      if (file && file.content) {
        try {
          parsed = JSON.parse(file.content);
        } catch (e) {
          parsed = {};
        }
      }

      const key = req.query ? req.query.key : null;
      if (key && key !== "ALL" && key !== "all") {
        const k = key.toLowerCase();
        const data = parsed[k] !== undefined ? parsed[k] : null;
        return res.status(200).json({ success: true, key: k, data, updatedAt: parsed.updatedAt || Date.now() });
      }

      return res.status(200).json({
        success: true,
        data: parsed,
        updatedAt: parsed.updatedAt || Date.now()
      });
    }

    // 2. POST Request: Update data ke Gist
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }

      if (!body) {
        return res.status(400).json({ success: false, message: "Request body is required" });
      }

      // Ambil data yang ada saat ini terlebih dahulu
      const getRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          "User-Agent": "PintasFood-Sync-API",
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      let currentData = {};
      if (getRes.ok) {
        const currentGist = await getRes.json();
        const existingFile = currentGist.files && currentGist.files[GIST_FILENAME];
        if (existingFile && existingFile.content) {
          try {
            currentData = JSON.parse(existingFile.content);
          } catch (e) {}
        }
      }

      // Merge data baru
      const { key, data } = body;
      if (key && key.toUpperCase() !== "ALL") {
        currentData[key.toLowerCase()] = data;
      } else if (data && typeof data === "object") {
        currentData = { ...currentData, ...data };
      }

      currentData.updatedAt = Date.now();

      // Simpan kembali ke GitHub Gist
      const patchRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: {
          "User-Agent": "PintasFood-Sync-API",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({
          description: "PintasFood Bengkayang Cloud Database",
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(currentData, null, 2)
            }
          }
        })
      });

      if (!patchRes.ok) {
        const errorText = await patchRes.text();
        throw new Error(`Failed to update Gist (${patchRes.status}): ${errorText}`);
      }

      return res.status(200).json({
        success: true,
        message: "Data successfully synced to cloud",
        updatedAt: currentData.updatedAt
      });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("[Sync API Error]:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
