import formidable from "formidable";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { authorize, headers, API, errorText, axios } from "../lib/github.js";

export const config = {
  api: {
    bodyParser: false
  }
};

const MAX_ZIP_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 250;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const validName = /^[a-zA-Z0-9._-]+$/;

function parseForm(req) {
  const form = formidable({
    maxFileSize: MAX_ZIP_BYTES,
    maxFiles: 1,
    allowEmptyFiles: false,
    multiples: false
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);
      resolve({ fields, files });
    });
  });
}

function field(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method tidak diizinkan." });
  }
  if (!authorize(req, res)) return;

  let tempFile;
  try {
    const { fields, files } = await parseForm(req);
    const repo = String(field(fields.repo) || "").trim();
    const mode = String(field(fields.mode) || "merge");
    const uploaded = field(files.file);

    if (!validName.test(repo)) return res.status(400).json({ error: "Nama repository tidak valid." });
    if (!["merge", "replace"].includes(mode)) return res.status(400).json({ error: "Mode upload tidak valid." });
    if (!uploaded) return res.status(400).json({ error: "Pilih file ZIP terlebih dahulu." });

    tempFile = uploaded.filepath;
    if (!String(uploaded.originalFilename || "").toLowerCase().endsWith(".zip")) {
      return res.status(400).json({ error: "File harus berformat ZIP." });
    }

    const zipBuffer = await fs.readFile(tempFile);
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries().filter(entry => !entry.isDirectory);

    if (!entries.length) return res.status(400).json({ error: "ZIP kosong." });
    if (entries.length > MAX_FILES) return res.status(400).json({ error: `Maksimal ${MAX_FILES} file per ZIP.` });

    const filesToUpload = [];
    let totalBytes = 0;

    for (const entry of entries) {
      const filePath = entry.entryName.replace(/\\/g, "/").replace(/^\.\/+/, "");
      const parts = filePath.split("/");
      if (!filePath || filePath.startsWith("/") || parts.some(part => part === "..") || filePath.includes("\0")) {
        return res.status(400).json({ error: "ZIP memiliki path file tidak aman." });
      }

      const content = entry.getData();
      totalBytes += content.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return res.status(400).json({ error: "Total ukuran hasil ekstrak melebihi 30 MB." });
      }
      filesToUpload.push({ path: filePath, content });
    }

    const owner = process.env.GITHUB_USERNAME;
    const ghHeaders = headers();
    let exists = true;
    let repoData;

    try {
      ({ data: repoData } = await axios.get(`${API}/repos/${owner}/${repo}`, { headers: ghHeaders }));
    } catch (error) {
      if (error.response?.status === 404) exists = false;
      else throw error;
    }

    if (!exists) {
      ({ data: repoData } = await axios.post(`${API}/user/repos`, {
        name: repo,
        private: String(field(fields.private)) === "true",
        auto_init: true
      }, { headers: ghHeaders }));
    }

    const branch = repoData.default_branch || "main";
    const refUrl = `${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
    const { data: ref } = await axios.get(refUrl, { headers: ghHeaders });
    const tree = [];

    for (const file of filesToUpload) {
      const { data } = await axios.post(`${API}/repos/${owner}/${repo}/git/blobs`, {
        content: file.content.toString("base64"),
        encoding: "base64"
      }, { headers: ghHeaders });
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: data.sha });
    }

    const treeBody = mode === "merge"
      ? { base_tree: ref.object.sha, tree }
      : { tree };

    const { data: newTree } = await axios.post(`${API}/repos/${owner}/${repo}/git/trees`, treeBody, { headers: ghHeaders });
    const { data: commit } = await axios.post(`${API}/repos/${owner}/${repo}/git/commits`, {
      message: exists
        ? (mode === "replace" ? "Replace project via GitHub Importer" : "Update project via GitHub Importer")
        : "Initial upload via GitHub Importer",
      tree: newTree.sha,
      parents: [ref.object.sha]
    }, { headers: ghHeaders });

    await axios.patch(refUrl, { sha: commit.sha }, { headers: ghHeaders });

    return res.status(200).json({
      message: exists
        ? (mode === "replace" ? "Repository berhasil diganti" : "Repository berhasil diperbarui")
        : "Repository berhasil dibuat",
      fileCount: filesToUpload.length,
      mode,
      url: `https://github.com/${owner}/${repo}`
    });
  } catch (error) {
    return res.status(400).json({ error: errorText(error) });
  } finally {
    if (tempFile) await fs.unlink(tempFile).catch(() => {});
  }
}